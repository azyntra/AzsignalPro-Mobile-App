"""
scalping.py — Scalping strategy for 1m / 5m / 15m timeframes.
v2.0: Tighter partial scores, candle quality filter, higher-TF
      penalty for disagreement, divergence support.

Changes from v1:
  - MACD histogram without crossover: 30% weight (was 50%)
  - Partial EMA signal: 30% weight (was 40%)
  - Added candle body filter: skip doji/indecision candles
  - Higher-TF disagreement applies a PENALTY (cuts score)
  - RSI divergence support for high-quality entries
"""
from typing import Optional
from config.settings import RSI_OVERSOLD, RSI_OVERBOUGHT, STOCH_OVERSOLD, STOCH_OVERBOUGHT
from config.logger import get_logger

logger = get_logger(__name__)

# Indicator weights for scalp voting  (must sum ≈ 100 per direction)
SCALP_WEIGHTS = {
    "rsi":        18,
    "macd":       18,
    "ema":        15,
    "bb":         15,
    "stoch":      12,
    "volume":     12,
    "divergence": 10,   # NEW — RSI divergence
}


def score_scalp(
    ind_fast: Optional[dict],   # 5m
    ind_mid:  Optional[dict],   # 15m (confirmation)
) -> dict:
    """
    Score a scalping opportunity.
    Returns a result dict with:
        direction: 'LONG' | 'SHORT' | None
        confidence: 0-100
        reasons: list of triggered conditions
        raw_scores: dict of per-indicator contribution
    """
    if not ind_fast:
        return _empty()

    long_score  = 0
    short_score = 0
    long_reasons  = []
    short_reasons = []

    ind = ind_fast
    conf = ind_mid  # optional confirmation on higher TF

    # ── Candle quality filter ─────────────────────────────────────────────────
    # Skip doji / indecision candles (body < 40% of range)
    body_pct = ind.get("body_pct", 0)
    if body_pct < 0.35:
        logger.debug("Scalp skipped: doji/indecision candle (body_pct={:.2f})".format(body_pct))
        return _empty()

    # ── RSI (weight 18) ──────────────────────────────────────────────────────
    if ind.get("rsi") is not None:
        rsi = ind["rsi"]
        if rsi < RSI_OVERSOLD:
            long_score += SCALP_WEIGHTS["rsi"]
            long_reasons.append(f"RSI oversold ({rsi:.1f})")
        elif rsi > RSI_OVERBOUGHT:
            short_score += SCALP_WEIGHTS["rsi"]
            short_reasons.append(f"RSI overbought ({rsi:.1f})")
        elif rsi < 40:
            long_score += SCALP_WEIGHTS["rsi"] * 0.3
        elif rsi > 60:
            short_score += SCALP_WEIGHTS["rsi"] * 0.3

    # ── MACD cross (weight 18) ────────────────────────────────────────────────
    if ind.get("macd_cross_bull"):
        long_score += SCALP_WEIGHTS["macd"]
        long_reasons.append("MACD bullish cross")
    elif ind.get("macd_cross_bear"):
        short_score += SCALP_WEIGHTS["macd"]
        short_reasons.append("MACD bearish cross")
    elif ind.get("macd_hist") is not None:
        h = ind["macd_hist"]
        # Histogram without crossover — reduced to 30% (was 50%)
        if h > 0:
            long_score  += SCALP_WEIGHTS["macd"] * 0.3
        elif h < 0:
            short_score += SCALP_WEIGHTS["macd"] * 0.3

    # ── EMA alignment (weight 15) ─────────────────────────────────────────────
    if ind.get("ema_bull"):
        long_score += SCALP_WEIGHTS["ema"]
        long_reasons.append("EMA 9>21>50 bullish stack")
    elif ind.get("ema_bear"):
        short_score += SCALP_WEIGHTS["ema"]
        short_reasons.append("EMA 9<21<50 bearish stack")
    # Price vs EMA9 — reduced to 30% (was 40%)
    elif ind.get("price") and ind.get("ema9"):
        if ind["price"] > ind["ema9"]:
            long_score  += SCALP_WEIGHTS["ema"] * 0.3
        else:
            short_score += SCALP_WEIGHTS["ema"] * 0.3

    # ── Bollinger Band (weight 15) ────────────────────────────────────────────
    if ind.get("bb_lower") and ind.get("price") and ind.get("bb_upper"):
        price   = ind["price"]
        bb_low  = ind["bb_lower"]
        bb_high = ind["bb_upper"]
        squeeze = ind.get("bb_squeeze", False)

        if price <= bb_low:
            long_score += SCALP_WEIGHTS["bb"]
            long_reasons.append("Price at BB lower band")
        elif price >= bb_high:
            short_score += SCALP_WEIGHTS["bb"]
            short_reasons.append("Price at BB upper band")
        elif squeeze:
            # BB squeeze — direction determined by EMA lean
            if ind.get("ema_bull"):
                long_score  += SCALP_WEIGHTS["bb"] * 0.6
                long_reasons.append("BB squeeze (bull bias)")
            elif ind.get("ema_bear"):
                short_score += SCALP_WEIGHTS["bb"] * 0.6
                short_reasons.append("BB squeeze (bear bias)")

    # ── Stochastic (weight 12) ────────────────────────────────────────────────
    if ind.get("stoch_k") is not None and ind.get("stoch_d") is not None:
        sk, sd = ind["stoch_k"], ind["stoch_d"]
        if ind.get("stoch_bull") or (sk < STOCH_OVERSOLD):
            long_score += SCALP_WEIGHTS["stoch"]
            long_reasons.append(f"Stochastic oversold ({sk:.1f})")
        elif ind.get("stoch_bear") or (sk > STOCH_OVERBOUGHT):
            short_score += SCALP_WEIGHTS["stoch"]
            short_reasons.append(f"Stochastic overbought ({sk:.1f})")

    # ── RSI divergence (weight 10) — high quality reversal signal ─────────────
    if ind.get("rsi_bull_div"):
        long_score += SCALP_WEIGHTS["divergence"]
        long_reasons.append("RSI bullish divergence")
    if ind.get("rsi_bear_div"):
        short_score += SCALP_WEIGHTS["divergence"]
        short_reasons.append("RSI bearish divergence")

    # ── Volume spike (weight 12) ──────────────────────────────────────────────
    if ind.get("vol_spike"):
        vr = ind.get("vol_ratio", 1)
        # Amplify whichever direction is already winning
        bonus = min(SCALP_WEIGHTS["volume"] * min(vr - 1, 1), SCALP_WEIGHTS["volume"])
        if long_score >= short_score:
            long_score  += bonus
            long_reasons.append(f"Volume spike ×{vr:.1f}")
        else:
            short_score += bonus
            short_reasons.append(f"Volume spike ×{vr:.1f}")

    # ── Higher-TF confirmation / penalty ──────────────────────────────────────
    if conf:
        htf_bull = conf.get("ema_bull") or (conf.get("macd_hist", 0) or 0) > 0
        htf_bear = conf.get("ema_bear") or (conf.get("macd_hist", 0) or 0) < 0

        # Bonus if HTF agrees
        if htf_bull and long_score > short_score:
            long_score  = min(long_score  + 8, 100)
            long_reasons.append("15m TF confirms bull")
        if htf_bear and short_score > long_score:
            short_score = min(short_score + 8, 100)
            short_reasons.append("15m TF confirms bear")

        # PENALTY if HTF actively disagrees — cut winning score by 30%
        if long_score > short_score and htf_bear and not htf_bull:
            long_score *= 0.7
        if short_score > long_score and htf_bull and not htf_bear:
            short_score *= 0.7

    # ── Determine direction ───────────────────────────────────────────────────
    direction = None
    confidence = 0
    reasons = []

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
