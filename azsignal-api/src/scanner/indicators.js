const TI = require('technicalindicators');

/**
 * Computes all technical indicators for an array of OHLCV candles.
 * Returns an object with the latest values (for the most recently closed candle).
 */
function computeIndicators(candles) {
  if (!candles || candles.length < 200) return null;

  // We only care about the most recently closed candle, which is index `length - 2` 
  // (index `length - 1` is usually the currently open, unfinished candle)
  // For safety, we just pass the whole array to TI and grab the last computed value.
  // Actually, to be precise, we pop the unfinished candle.
  const closedCandles = candles.slice(0, candles.length - 1);
  
  const close = closedCandles.map(c => c.close);
  const high = closedCandles.map(c => c.high);
  const low = closedCandles.map(c => c.low);
  const volume = closedCandles.map(c => c.volume);
  
  // EMA
  const ema9 = TI.EMA.calculate({ period: 9, values: close });
  const ema21 = TI.EMA.calculate({ period: 21, values: close });
  const ema50 = TI.EMA.calculate({ period: 50, values: close });
  const ema200 = TI.EMA.calculate({ period: 200, values: close });
  
  // RSI
  const rsi14 = TI.RSI.calculate({ period: 14, values: close });
  
  // MACD
  const macd = TI.MACD.calculate({
    values: close,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  
  // Bollinger Bands
  const bb = TI.BollingerBands.calculate({ period: 20, values: close, stdDev: 2 });
  
  // ADX
  const adx = TI.ADX.calculate({ high, low, close, period: 14 });
  
  // ATR
  const atr = TI.ATR.calculate({ high, low, close, period: 14 });
  
  // Stochastic
  const stoch = TI.Stochastic.calculate({
    high, low, close, period: 14, signalPeriod: 3
  });
  
  // OBV
  const obv = TI.OBV.calculate({ close, volume });
  
  // Grab the very last computed value for each
  const getL = (arr) => arr && arr.length > 0 ? arr[arr.length - 1] : null;

  return {
    price: close[close.length - 1],
    ema9: getL(ema9),
    ema21: getL(ema21),
    ema50: getL(ema50),
    ema200: getL(ema200),
    rsi: getL(rsi14),
    macd: getL(macd), // has .MACD, .signal, .histogram
    bb: getL(bb),     // has .upper, .middle, .lower
    adx: getL(adx),   // has .adx, .pdi, .mdi
    atr: getL(atr),
    stoch: getL(stoch), // has .k, .d
    obv: getL(obv),
  };
}

module.exports = {
  computeIndicators,
};
