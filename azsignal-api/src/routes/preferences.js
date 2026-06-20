const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/preferences — fetch the logged-in user's notification preferences
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    let prefs = await prisma.notificationPreference.findUnique({
      where: { user_id: userId }
    });

    // If no prefs exist yet, create defaults
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          user_id: userId,
          enable_scalp: true,
          enable_swing: true,
          enable_long: true,
          enable_short: true,
          min_confidence: 70,
        }
      });
    }

    res.json({
      allPush: prefs.enable_scalp || prefs.enable_swing || prefs.enable_long || prefs.enable_short,
      scalpSignals: prefs.enable_scalp,
      swingSignals: prefs.enable_swing,
      longSignals: prefs.enable_long,
      shortSignals: prefs.enable_short,
      minConfidence: prefs.min_confidence,
      exchanges: JSON.parse(prefs.exchanges || '["okx","bybit","binance","kucoin"]'),
      quietHoursStart: prefs.quiet_hours_start,
      quietHoursEnd: prefs.quiet_hours_end,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/preferences — update the logged-in user's notification preferences
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      allPush,
      scalpSignals,
      swingSignals,
      longSignals,
      shortSignals,
      minConfidence,
      exchanges,
      quietHoursStart,
      quietHoursEnd,
    } = req.body;

    // Build the update data, only including fields that were actually sent
    const updateData = {};
    if (typeof scalpSignals === 'boolean') updateData.enable_scalp = scalpSignals;
    if (typeof swingSignals === 'boolean') updateData.enable_swing = swingSignals;
    if (typeof longSignals === 'boolean') updateData.enable_long = longSignals;
    if (typeof shortSignals === 'boolean') updateData.enable_short = shortSignals;
    if (typeof minConfidence === 'number') updateData.min_confidence = minConfidence;
    if (Array.isArray(exchanges)) updateData.exchanges = JSON.stringify(exchanges);
    if (typeof quietHoursStart === 'string') updateData.quiet_hours_start = quietHoursStart;
    if (typeof quietHoursEnd === 'string') updateData.quiet_hours_end = quietHoursEnd;

    // If allPush is explicitly set to false, disable everything
    if (allPush === false) {
      updateData.enable_scalp = false;
      updateData.enable_swing = false;
      updateData.enable_long = false;
      updateData.enable_short = false;
    }

    const prefs = await prisma.notificationPreference.upsert({
      where: { user_id: userId },
      update: updateData,
      create: {
        user_id: userId,
        enable_scalp: scalpSignals ?? true,
        enable_swing: swingSignals ?? true,
        enable_long: longSignals ?? true,
        enable_short: shortSignals ?? false,
        min_confidence: minConfidence ?? 70,
        exchanges: exchanges ? JSON.stringify(exchanges) : '["okx","bybit","binance","kucoin"]',
        quiet_hours_start: quietHoursStart || null,
        quiet_hours_end: quietHoursEnd || null,
      }
    });

    res.json({
      success: true,
      message: 'Preferences updated',
      data: {
        allPush: prefs.enable_scalp || prefs.enable_swing || prefs.enable_long || prefs.enable_short,
        scalpSignals: prefs.enable_scalp,
        swingSignals: prefs.enable_swing,
        longSignals: prefs.enable_long,
        shortSignals: prefs.enable_short,
        minConfidence: prefs.min_confidence,
        exchanges: JSON.parse(prefs.exchanges || '[]'),
      }
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
