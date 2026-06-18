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

    const signal = await prisma.signal.create({
      data: {
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
        tp1_pct: data.tp1_pct,
        tp2_pct: data.tp2_pct,
        tp3_pct: data.tp3_pct,
        stop_loss: data.stop_loss,
        risk_pct: data.risk_pct,
        rr_ratio: data.rr_ratio,
        leverage: data.leverage,
        price_at_signal: data.price_at_signal,
        reasons_json,
        indicators_json,
        ai_decision: data.ai_decision,
        ai_adjusted_conf: data.ai_adjusted_confidence,
        ai_reasoning: data.ai_reasoning,
        created_at: data.created_at ? new Date(data.created_at) : new Date(),
      }
    });

    console.log(`[Webhook] Stored new signal #${signal.id} (Bot ID: ${data.id}): ${signal.direction} ${signal.symbol}`);

    // TODO: Phase 2 - Push notifications to devices
    // TODO: Phase 3 - Broadcast to WebSockets

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

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('[Webhook Update Error]', error);
    res.status(500).json({ success: false, message: 'Failed to process update' });
  }
});

module.exports = router;
