/**
 * validator.js - Validates signals and calculates TP/SL levels based on ATR
 */

const MIN_CONFIDENCE_SCALP = 70;
const MIN_CONFIDENCE_SWING = 70;
const MIN_INDICATORS_AGREE = 3;
const MIN_RR_RATIO = 2.0; // The user requested 1:2 in the markdown

function validateAndBuild(rawResult, marketType, style) {
  if (!rawResult || !rawResult.direction) return null;

  const { direction, confidence, reasons, indicators } = rawResult;

  // Validation 1: Confidence
  const minConf = style === 'scalp' ? MIN_CONFIDENCE_SCALP : MIN_CONFIDENCE_SWING;
  if (confidence < minConf) return null;

  // Validation 2: Indicator Agreement
  if (reasons.length < MIN_INDICATORS_AGREE) return null;

  // Calculate SL and TP based on ATR
  const atr = indicators.atr || (indicators.price * 0.005); // fallback to 0.5% if ATR fails
  const atrMultiplier = style === 'scalp' ? 1.5 : 2.5;

  const entry = indicators.price;
  let slDistance = atr * atrMultiplier;

  let stopLoss;
  let tp1, tp2, tp3;

  if (direction === 'LONG') {
    stopLoss = entry - slDistance;
    
    // Check against recent swing low (EMA21) for sanity
    if (indicators.ema21 && stopLoss > indicators.ema21) {
      stopLoss = indicators.ema21 - (atr * 0.5); // Place just below EMA21
      slDistance = entry - stopLoss;
    }

    tp1 = entry + (slDistance * 1.0);
    tp2 = entry + (slDistance * 2.0);
    tp3 = entry + (slDistance * 3.5);
  } else {
    stopLoss = entry + slDistance;
    
    // Check against recent swing high
    if (indicators.ema21 && stopLoss < indicators.ema21) {
      stopLoss = indicators.ema21 + (atr * 0.5); // Place just above EMA21
      slDistance = stopLoss - entry;
    }

    tp1 = entry - (slDistance * 1.0);
    tp2 = entry - (slDistance * 2.0);
    tp3 = entry - (slDistance * 3.5);
  }

  // Round values
  stopLoss = parseFloat(stopLoss.toPrecision(5));
  tp1 = parseFloat(tp1.toPrecision(5));
  tp2 = parseFloat(tp2.toPrecision(5));
  tp3 = parseFloat(tp3.toPrecision(5));

  const rrRatio = (Math.abs(entry - tp2) / Math.abs(entry - stopLoss));

  // Validation 3: R:R ratio
  if (rrRatio < MIN_RR_RATIO) return null;

  const riskPct = (Math.abs(entry - stopLoss) / entry) * 100;
  const tp1Pct = (Math.abs(entry - tp1) / entry) * 100;
  const tp2Pct = (Math.abs(entry - tp2) / entry) * 100;
  const tp3Pct = (Math.abs(entry - tp3) / entry) * 100;

  return {
    direction,
    confidence,
    entry_low: parseFloat((direction === 'LONG' ? entry * 0.999 : entry).toPrecision(5)),
    entry_high: parseFloat((direction === 'LONG' ? entry : entry * 1.001).toPrecision(5)),
    stop_loss: stopLoss,
    tp1,
    tp2,
    tp3,
    tp1_pct: parseFloat(tp1Pct.toPrecision(3)),
    tp2_pct: parseFloat(tp2Pct.toPrecision(3)),
    tp3_pct: parseFloat(tp3Pct.toPrecision(3)),
    risk_pct: parseFloat(riskPct.toPrecision(3)),
    rr_ratio: parseFloat(rrRatio.toFixed(2)),
    price_at_signal: parseFloat(entry.toPrecision(5)),
    reasons,
    indicators,
  };
}

module.exports = {
  validateAndBuild,
};
