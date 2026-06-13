"""
swing.py — Swing trading strategy for 1h / 4h / 1d timeframes.
v2.0: Hardened signal quality with trend guards, mandatory HTF
      confirmation, divergence scoring, and stricter partial weights.

Changes from v1:
  - Trend guard: blocks counter-trend signals when EMA200 exists
  - Higher-TF confirmation is MANDATORY (configurable)
  - RSI used for momentum confirmation, NOT reversal signals
  - RSI divergence detection carries significant weight
  - Partial scores drastically reduced (MACD hist alone = 30% max)
  - ADX minimum raised to 25 for swing signals
  - HTF disagreement applies a penalty (not just zero bonus)
"""
from typing import Optional
from config.settings import (
    RSI_OVERSOLD, RSI_OVERBOUGHT, ADX_TREND_MIN,
    COUNTER_TREND_BLOCK, SWING_HTF_REQUIRED, ADX_SWING_MIN,
)
from config.logger import get_logger

logger = get_logger(__name__)

SWING_WEIGHTS = {
    "ema_trend":   20,
    "adx":         18,
    "macd":        18,
    "rsi":         12,
    "divergence":  12,   # NEW — RSI divergence (high quality)
    "obv":         10,
    "ema200":      10,
}


def score_swing(
    ind_base: Optional[dict],   # primary TF (e.g. 4h)
    ind_high: Optional[dict],   # higher TF confirmation (e.g. 1d)
) -> dict:
    """
    Score a swing trading opportunity using multi-timeframe confluence.
    Returns same structure as score_scalp.
    """
    if not ind_base:
        return _empty()

    long_score  = 0.0
    short_score = 0.0
    long_reasons  = []
    short_reasons = []

    ind = ind_base

    # ━━ HARD TREND GUARD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Block counter-trend signals when EMA200 macro direction is clear.
    # This is the #1 cause of losses — shorting uptrends, longing downtrends.
    if COUNTER_TREND_BLOCK and ind.get("above_200") is not None:
        trend_is_bull = ind["above_200"]  # True = price above EMA200
        # We'll use this below to kill the losing direction after scoring
    else:
        trend_is_bull = None  # unknown — allow both directions

    # ── EMA trend alignment (weight 20) ───────────────────────────────────────
    if ind.get("ema_bull"):
        long_score += SWING_WEIGHTS["ema_trend"]
        long_reasons.append("EMA 9>21>50 bull alignment")
    elif ind.get("ema_bear"):
        short_score += SWING_WEIGHTS["ema_trend"]
        short_reasons.append("EMA 9<21<50 bear alignment")
    # partial: price above/below EMA50 — REDUCED to 30% (was 50%)
    elif ind.get("price") and ind.get("ema50"):
        if ind["price"] > ind["ema50"]:
            long_score  += SWING_WEIGHTS["ema_trend"] * 0.3
        else:
            short_score += SWING_WEIGHTS["ema_trend"] * 0.3

    # ── ADX trend strength (weight 18, minimum 25 for swing) ──────────────────
    adx = ind.get("adx")
    if adx and adx > ADX_SWING_MIN:
        if ind.get("adx_bull"):
            long_score += SWING_WEIGHTS["adx"]
            long_reasons.append(f"ADX trending bull ({adx:.0f})")
        elif ind.get("adx_bear"):
            short_score += SWING_WEIGHTS["adx"]
            short_reasons.append(f"ADX trending bear ({adx:.0f})")
        # Trending but no clear DI direction — very small partial
        else:
            long_score  += SWING_WEIGHTS["adx"] * 0.15
            short_score += SWING_WEIGHTS["adx"] * 0.15
    elif adx and adx > ADX_TREND_MIN:
        # Weakly trending (20-25) — small partial only if EMAs agree
        if ind.get("ema_bull"):
            long_score  += SWING_WEIGHTS["adx"] * 0.25
        elif ind.get("ema_bear"):
            short_score += SWING_WEIGHTS["adx"] * 0.25
    # ADX < 20 → ranging market, no ADX score awarded at all

    # ── MACD (weight 18) ──────────────────────────────────────────────────────
    if ind.get("macd_cross_bull"):
        long_score += SWING_WEIGHTS["macd"]
        long_reasons.append("MACD bullish crossover")
    elif ind.get("macd_cross_bear"):
        short_score += SWING_WEIGHTS["macd"]
        short_reasons.append("MACD bearish crossover")
    elif ind.get("macd_hist") is not None:
        h = ind["macd_hist"]
        # Histogram without crossover — MUCH reduced (was 60-80%, now 30% max)
        if h > 0:
            long_score  += SWING_WEIGHTS["macd"] * 0.3
        else:
            short_score += SWING_WEIGHTS["macd"] * 0.3

    # ── RSI momentum (weight 12) ──────────────────────────────────────────────
    # For swing: RSI CONFIRMS momentum, it does NOT suggest reversals.
    # Oversold/overbought in swing = the trend is strong, not a reversal signal.
    rsi = ind.get("rsi")
    if rsi is not None:
        if 50 < rsi < RSI_OVERBOUGHT and long_score > short_score:
            # RSI in bullish momentum zone — confirms long
            long_score += SWING_WEIGHTS["rsi"]
            long_reasons.append(f"RSI bullish momentum ({rsi:.1f})")
        elif 30 < rsi < 50 and short_score > long_score:
            # RSI in bearish momentum zone — confirms short
            short_score += SWING_WEIGHTS["rsi"]
            short_reasons.append(f"RSI bearish momentum ({rsi:.1f})")
        elif rsi > RSI_OVERBOUGHT:
            # Overbought — mild short bias but NOT full weight
            short_score += SWING_WEIGHTS["rsi"] * 0.5
        elif rsi < RSI_OVERSOLD:
            # Oversold — mild long bias but NOT full weight
            long_score  += SWING_WEIGHTS["rsi"] * 0.5

    # ── RSI divergence (weight 12) — highest quality reversal signal ──────────
    if ind.get("rsi_bull_div"):
        long_score += SWING_WEIGHTS["divergence"]
        long_reasons.append("RSI bullish divergence detected")
    if ind.get("rsi_bear_div"):
        short_score += SWING_WEIGHTS["divergence"]
        short_reasons.append("RSI bearish divergence detected")

    # ── OBV volume confirmation (weight 10) ───────────────────────────────────
    if ind.get("obv_rising") is True:
        long_score += SWING_WEIGHTS["obv"]
        long_reasons.append("OBV rising — accumulation")
    elif ind.get("obv_rising") is False:
        short_score += SWING_WEIGHTS["obv"]
        short_reasons.append("OBV falling — distribution")

    # ── EMA200 bias (weight 10) ───────────────────────────────────────────────
    if ind.get("above_200") is True:
        long_score += SWING_WEIGHTS["ema200"]
        long_reasons.append("Price above EMA200 macro bull")
    elif ind.get("above_200") is False:
        short_score += SWING_WEIGHTS["ema200"]
        short_reasons.append("Price below EMA200 macro bear")

    # ━━ TREND GUARD APPLICATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Kill counter-trend direction entirely
    if trend_is_bull is True:
        # Macro uptrend — kill short signals
        short_score = 0
        short_reasons = []
    elif trend_is_bull is False:
        # Macro downtrend — kill long signals
        long_score = 0
        long_reasons = []

    # ── Higher TF confirmation (mandatory when configured) ────────────────────
    htf_confirms_long  = False
    htf_confirms_short = False

    if ind_high:
        h = ind_high
        # Check if higher TF aligns with signal direction
        if h.get("ema_bull") or (h.get("adx_bull") and (h.get("adx") or 0) > ADX_TREND_MIN):
            htf_confirms_long = True
        if h.get("ema_bear") or (h.get("adx_bear") and (h.get("adx") or 0) > ADX_TREND_MIN):
            htf_confirms_short = True

        # Apply bonus for confirmation
        if htf_confirms_long and long_score > short_score:
            long_score = min(long_score + 12, 100)
            long_reasons.append("Higher TF confirms bull trend")
        if htf_confirms_short and short_score > long_score:
            short_score = min(short_score + 12, 100)
            short_reasons.append("Higher TF confirms bear trend")

        # PENALTY: if HTF actively disagrees, cut score by 40%
        if long_score > short_score and htf_confirms_short and not htf_confirms_long:
            long_score *= 0.6
            long_reasons.append("⚠ Higher TF disagrees — score penalized")
        if short_score > long_score and htf_confirms_long and not htf_confirms_short:
            short_score *= 0.6
            short_reasons.append("⚠ Higher TF disagrees — score penalized")

    # ── MANDATORY HTF CHECK ───────────────────────────────────────────────────
    # If configured, kill signals that have no higher-TF confirmation at all
    if SWING_HTF_REQUIRED and ind_high:
        if long_score > short_score and not htf_confirms_long:
            logger.debug("Swing long rejected: no higher-TF confirmation")
            return _empty()
        if short_score > long_score and not htf_confirms_short:
            logger.debug("Swing short rejected: no higher-TF confirmation")
            return _empty()

    # ── Determine direction ───────────────────────────────────────────────────
    direction  = None
    confidence = 0
    reasons    = []

    if long_score > short_score and long_score >= 50:
        direction  = "LONG"
        confidence = min(round(long_score), 100)
        reasons    = long_reasons
    elif short_score > long_score and short_score >= 50:
        direction  = "SHORT"
        confidence = min(round(short_score), 100)
        reasons    = short_reasons

    return {
        "direction":   direction,
        "confidence":  confidence,
        "reasons":     reasons,
        "long_score":  round(long_score, 1),
        "short_score": round(short_score, 1),
        "indicators":  ind,
    }


def _empty():
    return {"direction": None, "confidence": 0, "reasons": [], "long_score": 0, "short_score": 0, "indicators": {}}
