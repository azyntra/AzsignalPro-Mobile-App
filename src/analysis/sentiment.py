"""
sentiment.py — Crypto Fear & Greed Index sentiment layer.

Fetches the current Fear & Greed Index from the free alternative.me API
and applies a contrarian bias to signal confidence:
  - Extreme Fear  → boost LONG, penalize SHORT
  - Extreme Greed → boost SHORT, penalize LONG

The index is cached for 1 hour (it updates daily).
"""
import time
from typing import Optional

import requests
from config.settings import SENTIMENT_ENABLED, SENTIMENT_EXTREME_BOOST
from config.logger import get_logger

logger = get_logger(__name__)

FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1"

_cache: dict = {"data": None, "updated_at": 0}
CACHE_TTL = 3600  # 1 hour


def get_fear_greed_index() -> Optional[dict]:
    """
    Fetch the current Crypto Fear & Greed Index.

    Returns:
        {"value": 25, "label": "Extreme Fear"} or None on error.
    """
    if not SENTIMENT_ENABLED:
        return None

    now = time.time()
    if _cache["data"] and (now - _cache["updated_at"]) < CACHE_TTL:
        return _cache["data"]

    try:
        resp = requests.get(FEAR_GREED_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if "data" in data and len(data["data"]) > 0:
            entry = data["data"][0]
            result = {
                "value": int(entry.get("value", 50)),
                "label": entry.get("value_classification", "Neutral"),
            }
            _cache["data"] = result
            _cache["updated_at"] = now
            logger.info(f"Sentiment: Fear & Greed Index = {result['value']} ({result['label']})")
            return result

    except Exception as e:
        logger.warning(f"Sentiment fetch error: {e}")

    return _cache["data"]  # return stale data if available


def apply_sentiment_bias(confidence: int, direction: str,
                         sentiment: Optional[dict] = None) -> int:
    """
    Apply contrarian sentiment adjustment to confidence.

    Extreme Fear  (0-25):  LONG +boost, SHORT -boost
    Fear          (25-45): LONG +half_boost
    Neutral       (45-55): no change
    Greed         (55-75): SHORT +half_boost
    Extreme Greed (75-100): SHORT +boost, LONG -boost

    Returns adjusted confidence clamped to [0, 100].
    """
    if not SENTIMENT_ENABLED or not sentiment:
        return confidence

    value = sentiment.get("value", 50)
    boost = SENTIMENT_EXTREME_BOOST
    half_boost = boost // 2
    adjustment = 0

    if value <= 25:  # Extreme Fear
        if direction == "LONG":
            adjustment = boost
        elif direction == "SHORT":
            adjustment = -boost
    elif value <= 45:  # Fear
        if direction == "LONG":
            adjustment = half_boost
    elif value >= 75:  # Extreme Greed
        if direction == "SHORT":
            adjustment = boost
        elif direction == "LONG":
            adjustment = -boost
    elif value >= 55:  # Greed
        if direction == "SHORT":
            adjustment = half_boost

    if adjustment != 0:
        logger.debug(f"Sentiment adjustment: {direction} {confidence}% "
                     f"{'+'if adjustment>0 else ''}{adjustment}% "
                     f"(F&G={value} {sentiment.get('label', '')})")

    return max(0, min(100, confidence + adjustment))
