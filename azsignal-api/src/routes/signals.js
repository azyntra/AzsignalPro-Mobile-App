const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const signals = await prisma.signal.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const userTier = req.user.tier || 'free';
    
    const formattedSignals = signals.map(signal => {
      let filteredSignal = { ...signal };
      
      // Free users don't see AI reasoning or exact indicators
      if (userTier === 'free' || userTier === 'basic') {
        delete filteredSignal.ai_reasoning;
        delete filteredSignal.indicators_json;
        delete filteredSignal.reasons_json;
      }
      
      // Elite users only get ML features
      if (userTier !== 'elite') {
        delete filteredSignal.ai_adjusted_conf;
      }
      
      return filteredSignal;
    });

    res.json(formattedSignals);
  } catch (error) {
    console.error('Failed to fetch signals', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
