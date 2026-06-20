const { PrismaClient } = require('@prisma/client');
const { fetchTopCoins, getExchangePairs, fetchMultiTimeframe } = require('./fetcher');
const { computeIndicators } = require('./indicators');
const { scoreScalp, scoreSwing } = require('./strategies');
const { validateAndBuild } = require('./validator');

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
    const record = await prisma.signal.create({
      data: {
        symbol,
        exchange,
        market_type: marketType,
        style,
        timeframe,
        direction: signal.direction,
        confidence: signal.confidence,
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
        }),
      }
    });

    console.log(`✅ [${style.toUpperCase()}] ${symbol} ${signal.direction} CONF=${signal.confidence}%`);
    broadcastSignal(record);

    // Push notifications to devices
    try {
      const tokens = await prisma.deviceToken.findMany({
        where: { is_active: true }
      });

      let messages = [];
      for (let dt of tokens) {
        if (!dt.expo_push_token.startsWith('ExponentPushToken[')) continue;
        
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

module.exports = {
  runScalpScan,
  runSwingScan,
  registerWebSocket,
};
