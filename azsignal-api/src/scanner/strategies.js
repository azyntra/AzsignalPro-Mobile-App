/**
 * strategies.js - Translates technical indicators into trade signals and confidence scores
 */

function scoreScalp(indFast, indMid) {
  let score = 0;
  let direction = null;
  const reasons = [];

  if (!indFast || !indMid) return { direction: null, confidence: 0, reasons: [] };

  // Fast TF: 1m or 5m
  // Mid TF: 5m or 15m

  // 1. Core Trend Alignment
  if (indFast.ema9 > indFast.ema21 && indFast.price > indFast.ema50) {
    direction = 'LONG';
    score += 20;
    reasons.push('Fast EMA aligned Bullish');
  } else if (indFast.ema9 < indFast.ema21 && indFast.price < indFast.ema50) {
    direction = 'SHORT';
    score += 20;
    reasons.push('Fast EMA aligned Bearish');
  } else {
    return { direction: null, confidence: 0, reasons: [] }; // No clear trend
  }

  // Counter trend block (don't short above EMA200, don't long below EMA200)
  if (direction === 'LONG' && indFast.price < indFast.ema200) return { direction: null, confidence: 0, reasons: [] };
  if (direction === 'SHORT' && indFast.price > indFast.ema200) return { direction: null, confidence: 0, reasons: [] };

  // 2. Momentum (MACD)
  if (direction === 'LONG' && indFast.macd && indFast.macd.MACD > indFast.macd.signal) {
    score += 15;
    reasons.push('MACD Bullish Cross');
  }
  if (direction === 'SHORT' && indFast.macd && indFast.macd.MACD < indFast.macd.signal) {
    score += 15;
    reasons.push('MACD Bearish Cross');
  }

  // 3. RSI
  if (direction === 'LONG' && indFast.rsi > 40 && indFast.rsi < 70) {
    score += 10;
    reasons.push('RSI Healthy Bullish');
  }
  if (direction === 'SHORT' && indFast.rsi < 60 && indFast.rsi > 30) {
    score += 10;
    reasons.push('RSI Healthy Bearish');
  }

  // 4. Higher Timeframe Confirmation
  if (direction === 'LONG' && indMid.price > indMid.ema50) {
    score += 25;
    reasons.push('Mid TF Bullish Confirmation');
  }
  if (direction === 'SHORT' && indMid.price < indMid.ema50) {
    score += 25;
    reasons.push('Mid TF Bearish Confirmation');
  }

  // 5. Stochastic
  if (direction === 'LONG' && indFast.stoch && indFast.stoch.k > indFast.stoch.d && indFast.stoch.k < 80) {
    score += 10;
    reasons.push('Stoch Bullish');
  }
  if (direction === 'SHORT' && indFast.stoch && indFast.stoch.k < indFast.stoch.d && indFast.stoch.k > 20) {
    score += 10;
    reasons.push('Stoch Bearish');
  }

  // 6. ADX Filter (Trend strength)
  if (indFast.adx && indFast.adx.adx > 20) {
    score += 10;
    reasons.push('Strong ADX Trend');
  }

  // Confidence is a max of 100
  const confidence = Math.min(100, Math.round(score * 1.1));

  return {
    direction,
    confidence,
    reasons,
    indicators: indFast
  };
}


function scoreSwing(indBase, indHigh) {
  let score = 0;
  let direction = null;
  const reasons = [];

  if (!indBase || !indHigh) return { direction: null, confidence: 0, reasons: [] };

  // Base TF: 1h or 4h
  // High TF: 4h or 1d

  // 1. Core Trend Alignment
  if (indBase.price > indBase.ema50 && indBase.ema50 > indBase.ema200) {
    direction = 'LONG';
    score += 25;
    reasons.push('Base EMA strongly Bullish');
  } else if (indBase.price < indBase.ema50 && indBase.ema50 < indBase.ema200) {
    direction = 'SHORT';
    score += 25;
    reasons.push('Base EMA strongly Bearish');
  } else {
    return { direction: null, confidence: 0, reasons: [] }; 
  }

  // 2. Momentum (MACD)
  if (direction === 'LONG' && indBase.macd && indBase.macd.MACD > indBase.macd.signal) {
    score += 20;
    reasons.push('MACD Bullish Cross');
  }
  if (direction === 'SHORT' && indBase.macd && indBase.macd.MACD < indBase.macd.signal) {
    score += 20;
    reasons.push('MACD Bearish Cross');
  }

  // 3. RSI
  if (direction === 'LONG' && indBase.rsi > 45 && indBase.rsi < 65) {
    score += 15;
    reasons.push('RSI Healthy Bullish');
  }
  if (direction === 'SHORT' && indBase.rsi < 55 && indBase.rsi > 35) {
    score += 15;
    reasons.push('RSI Healthy Bearish');
  }

  // 4. Higher Timeframe Confirmation
  if (direction === 'LONG' && indHigh.price > indHigh.ema50) {
    score += 20;
    reasons.push('High TF Bullish Confirmation');
  }
  if (direction === 'SHORT' && indHigh.price < indHigh.ema50) {
    score += 20;
    reasons.push('High TF Bearish Confirmation');
  }

  // 5. ADX Trend Filter
  if (indBase.adx && indBase.adx.adx > 25) {
    score += 15;
    reasons.push('Strong Swing ADX Trend');
  } else {
    // We require stronger trends for swing
    return { direction: null, confidence: 0, reasons: [] };
  }

  const confidence = Math.min(100, Math.round(score * 1.05));

  return {
    direction,
    confidence,
    reasons,
    indicators: indBase
  };
}

module.exports = {
  scoreScalp,
  scoreSwing,
};
