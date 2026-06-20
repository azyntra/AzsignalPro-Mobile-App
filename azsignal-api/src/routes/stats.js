const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const signals = await prisma.signal.findMany({
      where: { outcome: { not: null, in: ['WIN', 'LOSS'] } }
    });

    const total = signals.length;
    const wins = signals.filter(s => s.outcome === 'WIN');
    const losses = signals.filter(s => s.outcome === 'LOSS');

    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    
    // Simplistic PNL calc based on risk reward
    let cumulativePnl = 0;
    signals.forEach(s => {
      if (s.outcome === 'WIN') cumulativePnl += (s.risk_pct || 1) * (s.rr_ratio || 2);
      if (s.outcome === 'LOSS') cumulativePnl -= (s.risk_pct || 1);
    });

    const avgProfit = wins.length > 0 ? cumulativePnl / wins.length : 0;

    res.json({
      totalSignals: await prisma.signal.count(),
      closedSignals: total,
      winRate: winRate.toFixed(1),
      avgProfit: avgProfit.toFixed(1),
      cumulativePnl: cumulativePnl.toFixed(1)
    });
  } catch (error) {
    console.error('Failed to fetch stats', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
