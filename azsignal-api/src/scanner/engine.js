const { PrismaClient } = require('@prisma/client');
const { fetchTopCoins, getExchangePairs, fetchMultiTimeframe } = require('./fetcher');
const { computeIndicators } = require('./indicators');
const { scoreScalp, scoreSwing } = require('./strategies');
const { validateAndBuild } = require('./validator');
const { getFearGreedIndex, calculateMLProb, reviewSignal } = require('./ai');
const prisma = new PrismaClient();

// Limit signals per hour
const MAX_SIGNALS_PER_HOUR = 10;
let signalsThisHour = [];

// Deduplication
async function isDuplicate(symbol, exchange, direction, style, windowMinutes) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
  const existing = await prisma.signal.findFirst({
    where: {
      symbol,
      exchange,
      direction,
      style,
      created_at: { gte: cutoff }
    }
  });
  return !!existing;
}

// WS Broadcaster
let wsClients = new Set();
function registerWebSocket(ws) {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
}
function broadcastSignal(signalData) {
  const payload = JSON.stringify({ type: 'signal.new', data: signalData });
  for (const client of wsClients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}

async function processScalp(exchangeName, symbol, marketType) {
  const data = await fetchMultiTimeframe(exchangeName, symbol, ['1m', '5m', '15m']);
  if (!data['5m']) return;

  const ind1m = computeIndicators(data['1m']);
  const ind5m = computeIndicators(data['5m']);
  const ind15m = computeIndicators(data['15m']);

  if (!ind5m) return;

  let result = scoreScalp(ind1m, ind5m);
  let tfStr = '1m';
  let dedupWindow = 15;

  if (!result.direction && ind15m) {
    result = scoreScalp(ind5m, ind15m);
    tfStr = '5m';
    dedupWindow = 30;
  }

  if (!result.direction) return;

  const signal = validateAndBuild(result, marketType, 'scalp');
  if (!signal) return;

  if (await isDuplicate(symbol, exchangeName, signal.direction, 'scalp', dedupWindow)) {
    return;
  }

  await saveAndBroadcast(signal, symbol, exchangeName, marketType, 'scalp', tfStr);
}

async function processSwing(exchangeName, symbol, marketType) {
  const data = await fetchMultiTimeframe(exchangeName, symbol, ['1h', '4h', '1d']);
  if (!data['4h']) return;

  const ind1h = computeIndicators(data['1h']);
  const ind4h = computeIndicators(data['4h']);
  const ind1d = computeIndicators(data['1d']);

  if (!ind4h) return;

  let result = scoreSwing(ind1h, ind4h);
  let tfStr = '1h';
  let dedupWindow = 60;

  if (!result.direction && ind1d) {
    result = scoreSwing(ind4h, ind1d);
    tfStr = '4h';
    dedupWindow = 240;
  }

  if (!result.direction) return;

  const signal = validateAndBuild(result, marketType, 'swing');
  if (!signal) return;

  if (await isDuplicate(symbol, exchangeName, signal.direction, 'swing', dedupWindow)) {
    return;
  }

  await saveAndBroadcast(signal, symbol, exchangeName, marketType, 'swing', tfStr);
}

async function saveAndBroadcast(signal, symbol, exchange, marketType, style, timeframe) {
  // Rate limiting check
  const now = Date.now();
  signalsThisHour = signalsThisHour.filter(t => now - t < 3600 * 1000);
  if (signalsThisHour.length >= MAX_SIGNALS_PER_HOUR) {
    console.log('Signal rate limit reached. Skipping.');
    return;
  }
  signalsThisHour.push(now);

  try {
    // AI Analysis Block
    const sentiment = await getFearGreedIndex();
    const mlProb = calculateMLProb(signal);
    
    // ML Probability Filter (same as Python logic)
    if (mlProb < 40) {
      console.log(`Signal ${symbol} ${signal.direction} dropped: ML Win Prob ${mlProb}%`);
      return;
    }

    const aiReview = await reviewSignal(signal, symbol, exchange, style, marketType, sentiment);
    
    // AI Rejection Filter
    if (aiReview.action === 'REJECT') {
      console.log(`Signal ${symbol} ${signal.direction} REJECTED by AI: ${aiReview.reasoning}`);
      return;
    }

    const record = await prisma.signal.create({
      data: {
        symbol,
        exchange,
        market_type: marketType,
        style,
        timeframe,
        direction: signal.direction,
        confidence: aiReview.adjustedConfidence || signal.confidence,
        entry_low: signal.entry_low,
        entry_high: signal.entry_high,
        tp1: signal.tp1,
        tp2: signal.tp2,
        tp3: signal.tp3,
        tp1_pct: signal.tp1_pct,
        tp2_pct: signal.tp2_pct,
        tp3_pct: signal.tp3_pct,
        stop_loss: signal.stop_loss,
        risk_pct: signal.risk_pct,
        rr_ratio: signal.rr_ratio,
        price_at_signal: signal.price_at_signal,
        leverage: marketType === 'futures' ? "20x" : "1x",
        reasons_json: JSON.stringify(signal.reasons),
        indicators_json: JSON.stringify({
          price: signal.indicators.price,
          rsi: signal.indicators.rsi,
          macd: signal.indicators.macd?.MACD,
          ema50: signal.indicators.ema50,
          ml_win_prob: `${mlProb}%`,
          sentiment: sentiment.label,
        }),
        ai_decision: aiReview.action,
        ai_adjusted_conf: aiReview.adjustedConfidence || signal.confidence,
        ai_reasoning: aiReview.reasoning,
      }
    });

    console.log(`✅ [${style.toUpperCase()}] ${symbol} ${signal.direction} CONF=${signal.confidence}%`);
    broadcastSignal(record);

    // Push notifications to devices (respecting user preferences)
    try {
      const tokens = await prisma.deviceToken.findMany({
        where: { is_active: true },
        include: {
          user: {
            include: {
              notification_prefs: true
            }
          }
        }
      });

      let messages = [];
      for (let dt of tokens) {
        if (!dt.expo_push_token.startsWith('ExponentPushToken[')) continue;

        // Check user notification preferences
        const prefs = dt.user?.notification_prefs;
        if (prefs) {
          // Check style preferences
          if (style === 'scalp' && !prefs.enable_scalp) continue;
          if (style === 'swing' && !prefs.enable_swing) continue;

          // Check direction preferences
          if (signal.direction === 'LONG' && !prefs.enable_long) continue;
          if (signal.direction === 'SHORT' && !prefs.enable_short) continue;

          // Check minimum confidence
          if (signal.confidence < prefs.min_confidence) continue;

          // Check exchange filter
          try {
            const allowedExchanges = JSON.parse(prefs.exchanges || '[]');
            if (allowedExchanges.length > 0 && !allowedExchanges.includes(exchange)) continue;
          } catch (e) { /* ignore parse errors */ }

          // Check quiet hours
          if (prefs.quiet_hours_start && prefs.quiet_hours_end) {
            const now = new Date();
            const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const start = prefs.quiet_hours_start;
            const end = prefs.quiet_hours_end;
            // Handle overnight quiet hours (e.g. 22:00 to 07:00)
            if (start > end) {
              if (currentHHMM >= start || currentHHMM < end) continue;
            } else {
              if (currentHHMM >= start && currentHHMM < end) continue;
            }
          }
        }

        const emoji = signal.direction === 'LONG' ? '🟢' : '🔴';

        messages.push({
          to: dt.expo_push_token,
          sound: 'default',
          title: `${emoji} ${signal.direction} ${symbol}`,
          body: `${style.toUpperCase()} | ${exchange.toUpperCase()} | Confidence: ${signal.confidence}% | R:R 1:${signal.rr_ratio}`,
          data: { signalId: record.id },
        });
      }

      if (messages.length > 0) {
        const axios = require('axios');
        await axios.post('https://exp.host/--/api/v2/push/send', messages, {
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          }
        });
      }
    } catch (pushErr) {
      console.error('Failed to send push notification:', pushErr.message);
    }
  } catch (error) {
    console.error('Failed to save signal:', error);
  }
}

async function runScalpScan() {
  console.log('═══ SCALP SCAN STARTED ═══');
  const exchangesToScan = ['binance', 'bybit', 'okx', 'kucoin'];
  for (const ex of exchangesToScan) {
    const pairs = await getExchangePairs(ex);
    for (const { symbol, marketType } of pairs) {
      await processScalp(ex, symbol, marketType);
      await new Promise(r => setTimeout(r, 100)); // sleep to avoid immediate rate limit ban
    }
  }
  console.log('═══ SCALP SCAN COMPLETE ═══');
}

async function runSwingScan() {
  console.log('═══ SWING SCAN STARTED ═══');
  const exchangesToScan = ['binance', 'bybit', 'okx', 'kucoin'];
  for (const ex of exchangesToScan) {
    const pairs = await getExchangePairs(ex);
    for (const { symbol, marketType } of pairs) {
      await processSwing(ex, symbol, marketType);
      await new Promise(r => setTimeout(r, 200)); // sleep to avoid immediate rate limit ban
    }
  }
  console.log('═══ SWING SCAN COMPLETE ═══');
}

/**
 * Outcome Tracker — runs every 60 seconds.
 * For each open signal (no outcome), fetches the current price and checks
 * whether TP1, TP2, TP3, or Stop Loss has been hit. Updates the DB and
 * broadcasts signal.update over WebSocket.
 */
async function runOutcomeTracker() {
  try {
    const openSignals = await prisma.signal.findMany({
      where: { outcome: null },
      orderBy: { created_at: 'desc' },
    });

    if (openSignals.length === 0) return;

    // Group signals by exchange+symbol to minimize API calls
    const groups = {};
    for (const sig of openSignals) {
      const key = `${sig.exchange}|${sig.symbol}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sig);
    }

    const exMap = await getExchanges();

    for (const [key, signals] of Object.entries(groups)) {
      const [exchangeName, symbol] = key.split('|');
      const exchange = exMap[exchangeName];
      if (!exchange) continue;

      let currentPrice = null;
      try {
        if (!exchange.markets || Object.keys(exchange.markets).length === 0) {
          await exchange.loadMarkets();
        }
        const ticker = await exchange.fetchTicker(symbol);
        currentPrice = ticker.last;
      } catch (e) {
        // If we can't fetch the price, skip this group
        continue;
      }

      if (!currentPrice) continue;

      for (const sig of signals) {
        // Check expiry first
        const ageMs = Date.now() - new Date(sig.created_at).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        const isScalp = sig.style === 'scalp';
        const maxAge = isScalp ? 1 : 72; // 1 hour for scalp, 72 hours for swing

        if (ageHours > maxAge) {
          // Auto-expire
          await updateSignalOutcome(sig, 'EXPIRED', currentPrice, 0);
          continue;
        }

        // Check TP/SL hits
        let outcome = null;
        let profitPct = 0;

        if (sig.direction === 'LONG') {
          if (currentPrice <= sig.stop_loss) {
            outcome = 'SL';
            profitPct = -sig.risk_pct;
          } else if (currentPrice >= sig.tp3) {
            outcome = 'TP3';
            profitPct = sig.tp3_pct;
          } else if (currentPrice >= sig.tp2) {
            outcome = 'TP2';
            profitPct = sig.tp2_pct;
          } else if (currentPrice >= sig.tp1) {
            outcome = 'TP1';
            profitPct = sig.tp1_pct;
          }
        } else {
          // SHORT
          if (currentPrice >= sig.stop_loss) {
            outcome = 'SL';
            profitPct = -sig.risk_pct;
          } else if (currentPrice <= sig.tp3) {
            outcome = 'TP3';
            profitPct = sig.tp3_pct;
          } else if (currentPrice <= sig.tp2) {
            outcome = 'TP2';
            profitPct = sig.tp2_pct;
          } else if (currentPrice <= sig.tp1) {
            outcome = 'TP1';
            profitPct = sig.tp1_pct;
          }
        }

        if (outcome) {
          await updateSignalOutcome(sig, outcome, currentPrice, profitPct);
        }
      }

      // Small delay between exchange+symbol fetches to avoid rate limits
      await new Promise(r => setTimeout(r, 150));
    }
  } catch (error) {
    console.error('Outcome tracker error:', error.message);
  }
}

async function updateSignalOutcome(signal, outcome, closePrice, profitPct) {
  try {
    const updated = await prisma.signal.update({
      where: { id: signal.id },
      data: {
        outcome,
        price_at_close: closePrice,
        profit_pct: parseFloat(profitPct.toFixed(2)),
        closed_at: new Date(),
      },
    });

    const isWin = ['TP1', 'TP2', 'TP3'].includes(outcome);
    const emoji = isWin ? '🎯' : outcome === 'SL' ? '❌' : '⏰';
    console.log(`${emoji} [OUTCOME] ${signal.symbol} ${signal.direction} → ${outcome} (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)`);

    // Broadcast to mobile app via WebSocket
    broadcastSignal({ ...updated, _type: 'update' });

    // Also broadcast with explicit signal.update type for stores that listen for it
    const payload = JSON.stringify({ type: 'signal.update', data: updated });
    for (const client of wsClients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  } catch (error) {
    console.error(`Failed to update outcome for signal ${signal.id}:`, error.message);
  }
}

module.exports = {
  runScalpScan,
  runSwingScan,
  runOutcomeTracker,
  registerWebSocket,
};

