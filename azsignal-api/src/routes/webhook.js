const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to verify webhook secret
const verifyWebhookSecret = (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
  }
  next();
};

router.post('/signal', verifyWebhookSecret, async (req, res) => {
  try {
    const data = req.body;

    // Convert stringified JSON from python to string to store in DB
    const reasons_json = typeof data.reasons === 'string' ? data.reasons : JSON.stringify(data.reasons || []);
    const indicators_json = typeof data.indicators === 'string' ? data.indicators : JSON.stringify(data.indicators || {});

    const entryPrice = data.price_at_signal || data.entry_low || 1;
    const calcPct = (val) => val ? Math.abs((val - entryPrice) / entryPrice) * 100 : 0;

    const signalData = {
      bot_signal_id: data.id,
      symbol: data.symbol,
      exchange: data.exchange,
      market_type: data.market_type,
      style: data.style,
      timeframe: data.timeframe,
      direction: data.direction,
      confidence: data.confidence,
      entry_low: data.entry_low,
      entry_high: data.entry_high,
      tp1: data.tp1,
      tp2: data.tp2,
      tp3: data.tp3,
      tp1_pct: data.tp1_pct || calcPct(data.tp1),
      tp2_pct: data.tp2_pct || calcPct(data.tp2),
      tp3_pct: data.tp3_pct || calcPct(data.tp3),
      stop_loss: data.stop_loss,
      risk_pct: data.risk_pct || calcPct(data.stop_loss),
      rr_ratio: data.rr_ratio,
      leverage: data.leverage,
      price_at_signal: data.price_at_signal,
      reasons_json,
      indicators_json,
      ai_decision: data.ai_decision,
      ai_adjusted_conf: data.ai_adjusted_confidence,
      ai_reasoning: data.ai_reasoning,
      created_at: data.created_at ? new Date(data.created_at) : new Date(),
    };

    const signal = await prisma.signal.upsert({
      where: { bot_signal_id: data.id },
      update: signalData,
      create: signalData,
    });

    console.log(`[Webhook] Stored new signal #${signal.id} (Bot ID: ${data.id}): ${signal.direction} ${signal.symbol}`);

    // Push notifications to devices
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
        title: `${emoji} ${signal.direction} ${signal.symbol}`,
        body: `${signal.style.toUpperCase()} | ${signal.exchange.toUpperCase()} | Confidence: ${signal.confidence}% | R:R 1:${signal.rr_ratio}`,
        data: { signalId: signal.id },
      });
    }

    if (messages.length > 0) {
      const axios = require('axios');
      try {
        await axios.post('https://exp.host/--/api/v2/push/send', messages, {
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          }
        });
      } catch (pushErr) {
        console.error('Error sending push chunk', pushErr.message);
      }
    }
    
    // Broadcast to WebSockets
    if (req.wss) {
      const payload = JSON.stringify({ type: 'signal.new', data: signal });
      req.wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 is WebSocket.OPEN
          client.send(payload);
        }
      });
    }

    res.json({ success: true, received: true, id: signal.id });
  } catch (error) {
    console.error('[Webhook Error]', error);
    res.status(500).json({ success: false, message: 'Failed to process signal' });
  }
});

router.post('/signal-update', verifyWebhookSecret, async (req, res) => {
  try {
    const { id, outcome, profit_pct, price_at_close, closed_at } = req.body;

    const signal = await prisma.signal.update({
      where: { bot_signal_id: id },
      data: {
        outcome,
        profit_pct,
        price_at_close,
        closed_at: closed_at ? new Date(closed_at) : new Date()
      }
    });

    console.log(`[Webhook Update] Signal ${signal.id} (Bot ID: ${id}) -> ${outcome} (${profit_pct}%)`);

    const tokens = await prisma.deviceToken.findMany({
      where: { is_active: true }
    });

    let messages = [];
    for (let dt of tokens) {
      if (!dt.expo_push_token.startsWith('ExponentPushToken[')) continue;
      
      const emoji = outcome.includes('TP') ? '✅' : (outcome === 'SL' ? '❌' : 'ℹ️');
      
      messages.push({
        to: dt.expo_push_token,
        sound: 'default',
        title: `${emoji} ${signal.symbol} — ${outcome} Hit`,
        body: `${profit_pct >= 0 ? '+' : ''}${profit_pct}% profit`,
        data: { signalId: signal.id },
      });
    }

    if (messages.length > 0) {
      const axios = require('axios');
      try {
        await axios.post('https://exp.host/--/api/v2/push/send', messages, {
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          }
        });
      } catch (pushErr) {
        console.error('Error sending push chunk', pushErr.message);
      }
    }

    // Broadcast to WebSockets
    if (req.wss) {
      const payload = JSON.stringify({ type: 'signal.update', data: signal });
      req.wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(payload);
        }
      });
    }

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('[Webhook Update Error]', error);
    res.status(500).json({ success: false, message: 'Failed to process update' });
  }
});

router.post('/revenuecat', async (req, res) => {
  try {
    const data = req.body;
    
    // In production, we should verify the RevenueCat webhook authorization header
    
    if (data && data.event && data.event.app_user_id) {
      const userId = parseInt(data.event.app_user_id, 10);
      const eventType = data.event.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
      
      let newTier = 'free';
      
      // Determine tier based on the product ID that triggered the event
      if (['INITIAL_PURCHASE', 'RENEWAL'].includes(eventType)) {
        const productId = data.event.product_id;
        if (productId.includes('basic')) newTier = 'basic';
        else if (productId.includes('pro')) newTier = 'pro';
        else if (productId.includes('elite')) newTier = 'elite';
        else newTier = 'basic';
      }

      await prisma.user.update({
        where: { id: userId },
        data: { subscription_tier: newTier }
      });
      
      console.log(`[RevenueCat] Updated user ${userId} to tier ${newTier} due to ${eventType}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[RevenueCat Webhook Error]', error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
