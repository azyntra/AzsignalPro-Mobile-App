const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/stats?range=7D|30D|90D|All
 * Returns comprehensive performance stats filtered by time range.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const range = req.query.range || 'All';

    // Calculate date filter based on range
    let dateFilter = undefined;
    const now = new Date();
    if (range === '7D') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30D') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === '90D') {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    // 'All' => no date filter

    const whereClause = {
      outcome: { not: null, in: ['WIN', 'LOSS'] },
      ...(dateFilter ? { created_at: { gte: dateFilter } } : {}),
    };

    const signals = await prisma.signal.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
    });

    const totalSignals = await prisma.signal.count({
      where: dateFilter ? { created_at: { gte: dateFilter } } : {},
    });

    const total = signals.length;
    const wins = signals.filter(s => s.outcome === 'WIN');
    const losses = signals.filter(s => s.outcome === 'LOSS');

    const winRate = total > 0 ? (wins.length / total) * 100 : 0;

    // Cumulative PnL calc
    let cumulativePnl = 0;
    signals.forEach(s => {
      if (s.outcome === 'WIN') cumulativePnl += (s.risk_pct || 1) * (s.rr_ratio || 2);
      if (s.outcome === 'LOSS') cumulativePnl -= (s.risk_pct || 1);
    });

    const avgProfit = wins.length > 0 ? cumulativePnl / wins.length : 0;

    // --- Daily breakdown (last 7 calendar days) ---
    const dailyBreakdown = [];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const daySignals = signals.filter(s => {
        const d = new Date(s.created_at);
        return d >= dayStart && d <= dayEnd;
      });

      dailyBreakdown.push({
        day: dayNames[dayStart.getDay()],
        date: dayStart.toISOString().split('T')[0],
        wins: daySignals.filter(s => s.outcome === 'WIN').length,
        losses: daySignals.filter(s => s.outcome === 'LOSS').length,
      });
    }

    // --- By exchange breakdown ---
    const exchangeMap = {};
    signals.forEach(s => {
      const ex = (s.exchange || 'Unknown').toLowerCase();
      if (!exchangeMap[ex]) exchangeMap[ex] = { wins: 0, losses: 0, total: 0 };
      exchangeMap[ex].total++;
      if (s.outcome === 'WIN') exchangeMap[ex].wins++;
      if (s.outcome === 'LOSS') exchangeMap[ex].losses++;
    });

    const byExchange = Object.entries(exchangeMap)
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        signals: data.total,
        wins: data.wins,
        losses: data.losses,
        winRate: data.total > 0 ? ((data.wins / data.total) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.signals - a.signals);

    // --- Best performing pair ---
    const pairMap = {};
    signals.forEach(s => {
      const sym = s.symbol || 'Unknown';
      if (!pairMap[sym]) pairMap[sym] = { wins: 0, total: 0 };
      pairMap[sym].total++;
      if (s.outcome === 'WIN') pairMap[sym].wins++;
    });

    let bestPair = null;
    let bestPairWinRate = 0;
    Object.entries(pairMap).forEach(([symbol, data]) => {
      if (data.total >= 3) { // Minimum 3 trades to qualify
        const wr = (data.wins / data.total) * 100;
        if (wr > bestPairWinRate) {
          bestPairWinRate = wr;
          bestPair = {
            symbol,
            winRate: wr.toFixed(1),
            trades: data.total,
            wins: data.wins,
          };
        }
      }
    });

    // --- Win/Loss streak ---
    let currentStreak = 0;
    let streakType = null;
    for (const s of signals) {
      if (streakType === null) {
        streakType = s.outcome;
        currentStreak = 1;
      } else if (s.outcome === streakType) {
        currentStreak++;
      } else {
        break;
      }
    }

    // --- Recent closed trades (last 5) ---
    const recentTrades = signals.slice(0, 5).map(s => ({
      id: s.id,
      symbol: s.symbol,
      direction: s.direction,
      exchange: s.exchange,
      outcome: s.outcome,
      profitPct: s.profit_pct ?? (s.outcome === 'WIN' 
        ? ((s.risk_pct || 1) * (s.rr_ratio || 2)).toFixed(2) 
        : (-1 * (s.risk_pct || 1)).toFixed(2)),
      closedAt: s.closed_at || s.created_at,
    }));

    res.json({
      totalSignals,
      closedSignals: total,
      wins: wins.length,
      losses: losses.length,
      winRate: winRate.toFixed(1),
      avgProfit: avgProfit.toFixed(1),
      cumulativePnl: cumulativePnl.toFixed(1),
      dailyBreakdown,
      byExchange,
      bestPair,
      streak: {
        count: currentStreak,
        type: streakType, // 'WIN' or 'LOSS' or null
      },
      recentTrades,
    });
  } catch (error) {
    console.error('Failed to fetch stats', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
