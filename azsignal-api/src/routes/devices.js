const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { expoPushToken, platform } = req.body;
    const userId = req.user.userId;

    if (!expoPushToken) {
      return res.status(400).json({ success: false, message: 'expoPushToken is required' });
    }

    // Upsert the token for the user
    const existing = await prisma.deviceToken.findFirst({
      where: { user_id: userId, expo_push_token: expoPushToken }
    });

    if (!existing) {
      await prisma.deviceToken.create({
        data: {
          user_id: userId,
          expo_push_token: expoPushToken,
          platform: platform || 'unknown',
          is_active: true
        }
      });
    } else if (!existing.is_active) {
      await prisma.deviceToken.update({
        where: { id: existing.id },
        data: { is_active: true }
      });
    }

    res.json({ success: true, message: 'Device registered for push notifications' });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/unregister', authenticateToken, async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    const userId = req.user.userId;

    await prisma.deviceToken.updateMany({
      where: { user_id: userId, expo_push_token: expoPushToken },
      data: { is_active: false }
    });

    res.json({ success: true, message: 'Device unregistered' });
  } catch (error) {
    console.error('Error unregistering device token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
