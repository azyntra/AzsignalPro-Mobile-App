import asyncio
import json
from src.data.fetcher import fetch_multi_timeframe
from src.analysis.indicators import compute_indicators
from src.analysis.scalping import score_scalp
from src.signals.validator import validate_and_build
from config.settings import SCALPING_TIMEFRAMES

async def test():
    symbol = "SOL/USDT"
    exchange = "binance"
    market_type = "futures"
    
    print(f"Fetching data for {symbol}...")
    data = await fetch_multi_timeframe(exchange, symbol, SCALPING_TIMEFRAMES, market_type)
    
    ind_5m = compute_indicators(data.get("5m"))
    ind_15m = compute_indicators(data.get("15m"))
    
    if not ind_5m:
        print("No 5m indicators")
        return
        
    print(f"\n--- {symbol} Indicators ---")
    print(f"Price: {ind_5m.get('price')}")
    print(f"RSI: {ind_5m.get('rsi')}")
    print(f"Regime: {ind_5m.get('market_regime')}")
    print(f"Body Pct: {ind_5m.get('body_pct')}")
    print(f"Above 200 EMA: {ind_5m.get('above_200')}")
    print(f"VWAP: {ind_5m.get('vwap')}")
    print(f"Above VWAP: {ind_5m.get('above_vwap')}")
    
    res = score_scalp(ind_5m, ind_15m)
    print("\n--- Scalp Score ---")
    
    # Strip the big indicators dict for clean printing
    if "indicators" in res:
        del res["indicators"]
        
    print(json.dumps(res, indent=2, default=str))
    
    if res.get("direction"):
        val = validate_and_build(res, market_type, "scalp")
        print("\n--- Validator Result ---")
        if val:
            print("VALIDATED! Confidence:", val.get("confidence"))
        else:
            print("REJECTED by validator (check MIN_CONFIDENCE, MIN_RR_RATIO, etc)")
    else:
        print("\nNo direction triggered.")
        
if __name__ == "__main__":
    asyncio.run(test())
