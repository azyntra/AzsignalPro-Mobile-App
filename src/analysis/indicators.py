"""
indicators.py — Computes all technical indicators on a price DataFrame.
Uses the `ta` library (pure-Python, arm64-compatible, no TA-Lib compile needed).
Returns a flat dict of indicator values for the scorer to consume.
"""
import pandas as pd
import numpy as np
from typing import Optional

import ta.momentum as tam
import ta.trend    as tat
import ta.volatility as tav
import ta.volume   as tavo

from config.logger import get_logger
from config.settings import (
    RSI_PERIOD, MACD_FAST, MACD_SLOW, MACD_SIGNAL,
    BB_PERIOD, BB_STD, EMA_FAST, EMA_MID, EMA_SLOW, EMA_TREND,
    ADX_PERIOD, ATR_PERIOD, STOCH_K, STOCH_D, OBV_MA_PERIOD,
)

logger = get_logger(__name__)


def _safe(series, idx=-1):
    """Safely extract a value from a pandas Series."""
    try:
        v = series.iloc[idx]
        return None if (v is None or (isinstance(v, float) and np.isnan(v))) else float(v)
    except Exception:
        return None


def compute_indicators(df: pd.DataFrame) -> Optional[dict]:
    """
    Given an OHLCV DataFrame, compute all indicators and return a flat dict.
    Returns None if there is not enough data.
    """
    if df is None or len(df) < 60:
        return None

    try:
        close  = df["close"]
        high   = df["high"]
        low    = df["low"]
        volume = df["volume"]
        open_  = df["open"]
        price  = float(close.iloc[-1])

        # ── RSI ──────────────────────────────────────────────────────────────
        rsi = _safe(tam.RSIIndicator(close, window=RSI_PERIOD).rsi())

        # ── MACD ─────────────────────────────────────────────────────────────
        macd_obj    = tat.MACD(close, window_fast=MACD_FAST, window_slow=MACD_SLOW, window_sign=MACD_SIGNAL)
        macd_line   = _safe(macd_obj.macd())
        macd_signal = _safe(macd_obj.macd_signal())
        macd_hist   = _safe(macd_obj.macd_diff())
        macd_prev   = _safe(macd_obj.macd(), -2)
        macd_sig_p  = _safe(macd_obj.macd_signal(), -2)

        macd_cross_bull = (
            macd_line is not None and macd_signal is not None and
            macd_prev is not None and macd_sig_p is not None and
            macd_line > macd_signal and macd_prev < macd_sig_p
        )
        macd_cross_bear = (
            macd_line is not None and macd_signal is not None and
            macd_prev is not None and macd_sig_p is not None and
            macd_line < macd_signal and macd_prev > macd_sig_p
        )

        # ── Bollinger Bands ───────────────────────────────────────────────────
        bb_obj   = tav.BollingerBands(close, window=BB_PERIOD, window_dev=BB_STD)
        bb_upper = _safe(bb_obj.bollinger_hband())
        bb_mid   = _safe(bb_obj.bollinger_mavg())
        bb_lower = _safe(bb_obj.bollinger_lband())
        bb_pct   = _safe(bb_obj.bollinger_pband())
        bb_wband = _safe(bb_obj.bollinger_wband())
        bb_squeeze = (bb_wband < 0.05) if bb_wband is not None else False

        # ── EMAs ─────────────────────────────────────────────────────────────
        ema9   = _safe(tat.EMAIndicator(close, window=EMA_FAST).ema_indicator())
        ema21  = _safe(tat.EMAIndicator(close, window=EMA_MID).ema_indicator())
        ema50  = _safe(tat.EMAIndicator(close, window=EMA_SLOW).ema_indicator())
        ema200 = _safe(tat.EMAIndicator(close, window=EMA_TREND).ema_indicator()) if len(df) >= 200 else None

        ema_bull = (ema9 is not None and ema21 is not None and ema50 is not None
                    and ema9 > ema21 > ema50)
        ema_bear = (ema9 is not None and ema21 is not None and ema50 is not None
                    and ema9 < ema21 < ema50)
        above_200 = (price > ema200) if ema200 is not None else None

        # ── ADX / DI ─────────────────────────────────────────────────────────
        adx_obj = tat.ADXIndicator(high, low, close, window=ADX_PERIOD)
        adx     = _safe(adx_obj.adx())
        di_pos  = _safe(adx_obj.adx_pos())
        di_neg  = _safe(adx_obj.adx_neg())
        trending  = (adx > 20) if adx is not None else False
        adx_bull  = (adx is not None and di_pos is not None and di_neg is not None
                     and adx > 20 and di_pos > di_neg)
        adx_bear  = (adx is not None and di_pos is not None and di_neg is not None
                     and adx > 20 and di_neg > di_pos)

        # ── ATR ──────────────────────────────────────────────────────────────
        atr     = _safe(tav.AverageTrueRange(high, low, close, window=ATR_PERIOD).average_true_range())
        atr_pct = (atr / price * 100) if (atr and price) else None

        # ── Stochastic ───────────────────────────────────────────────────────
        stoch_obj = tam.StochasticOscillator(high, low, close, window=STOCH_K, smooth_window=STOCH_D)
        stoch_k   = _safe(stoch_obj.stoch())
        stoch_d   = _safe(stoch_obj.stoch_signal())
        stoch_bull = (stoch_k is not None and stoch_d is not None
                      and stoch_k > stoch_d and stoch_k < 30)
        stoch_bear = (stoch_k is not None and stoch_d is not None
                      and stoch_k < stoch_d and stoch_k > 70)

        # ── OBV ──────────────────────────────────────────────────────────────
        obv_series = tavo.OnBalanceVolumeIndicator(close, volume).on_balance_volume()
        obv        = _safe(obv_series)
        obv_ma     = _safe(obv_series.rolling(OBV_MA_PERIOD).mean())
        obv_rising = (obv > obv_ma) if (obv is not None and obv_ma is not None) else None

        # ── Volume analysis ───────────────────────────────────────────────────
        vol_ma20    = float(volume.rolling(20).mean().iloc[-1])
        vol_current = float(volume.iloc[-1])
        vol_ratio   = vol_current / vol_ma20 if vol_ma20 else 1.0
        vol_spike   = vol_ratio > 1.5

        # ── Candle ───────────────────────────────────────────────────────────
        prev_close   = float(close.iloc[-2])
        body         = abs(price - float(open_.iloc[-1]))
        candle_range = float(high.iloc[-1] - low.iloc[-1])
        body_pct     = body / candle_range if candle_range else 0

        # ── RSI divergence detection (lookback 14 candles) ──────────────
        rsi_series = tam.RSIIndicator(close, window=RSI_PERIOD).rsi()
        rsi_bull_div = False
        rsi_bear_div = False
        div_lookback = min(14, len(df) - 2)
        if div_lookback >= 5:
            try:
                recent_close = close.iloc[-div_lookback:]
                recent_rsi   = rsi_series.iloc[-div_lookback:]
                # Bullish divergence: price lower low, RSI higher low
                price_min_idx = recent_close.idxmin()
                price_min_pos = recent_close.index.get_loc(price_min_idx)
                if price_min_pos > 0:
                    prev_low_price = recent_close.iloc[:price_min_pos].min()
                    if float(recent_close.iloc[price_min_pos]) < prev_low_price:
                        rsi_at_new_low  = float(recent_rsi.iloc[price_min_pos])
                        rsi_at_prev_low = float(recent_rsi.iloc[:price_min_pos].min())
                        if rsi_at_new_low > rsi_at_prev_low and rsi_at_new_low < 40:
                            rsi_bull_div = True
                # Bearish divergence: price higher high, RSI lower high
                price_max_idx = recent_close.idxmax()
                price_max_pos = recent_close.index.get_loc(price_max_idx)
                if price_max_pos > 0:
                    prev_high_price = recent_close.iloc[:price_max_pos].max()
                    if float(recent_close.iloc[price_max_pos]) > prev_high_price:
                        rsi_at_new_high  = float(recent_rsi.iloc[price_max_pos])
                        rsi_at_prev_high = float(recent_rsi.iloc[:price_max_pos].max())
                        if rsi_at_new_high < rsi_at_prev_high and rsi_at_new_high > 60:
                            rsi_bear_div = True
            except Exception:
                pass  # divergence detection is best-effort

        return {
            "price":          price,
            "prev_close":     prev_close,
            "change_pct":     (price - prev_close) / prev_close * 100,

            "rsi":            rsi,
            "rsi_bull_div":   rsi_bull_div,
            "rsi_bear_div":   rsi_bear_div,

            "macd_line":      macd_line,
            "macd_signal":    macd_signal,
            "macd_hist":      macd_hist,
            "macd_cross_bull": macd_cross_bull,
            "macd_cross_bear": macd_cross_bear,

            "bb_upper":       bb_upper,
            "bb_mid":         bb_mid,
            "bb_lower":       bb_lower,
            "bb_pct":         bb_pct,
            "bb_width":       bb_wband,
            "bb_squeeze":     bb_squeeze,

            "ema9":           ema9,
            "ema21":          ema21,
            "ema50":          ema50,
            "ema200":         ema200,
            "ema_bull":       ema_bull,
            "ema_bear":       ema_bear,
            "above_200":      above_200,

            "adx":            adx,
            "di_pos":         di_pos,
            "di_neg":         di_neg,
            "trending":       trending,
            "adx_bull":       adx_bull,
            "adx_bear":       adx_bear,

            "atr":            atr,
            "atr_pct":        atr_pct,

            "stoch_k":        stoch_k,
            "stoch_d":        stoch_d,
            "stoch_bull":     stoch_bull,
            "stoch_bear":     stoch_bear,

            "obv":            obv,
            "obv_ma":         obv_ma,
            "obv_rising":     obv_rising,

            "vol_ratio":      vol_ratio,
            "vol_spike":      vol_spike,
            "body_pct":       body_pct,
        }

    except Exception as e:
        logger.error(f"Indicator computation error: {e}")
        return None
