import asyncio
import json
from src.data.fetcher import fetch_multi_timeframe
from src.data.coin_universe import fetch_top_coins, build_pairs
from src.data.fetcher import get_exchange_symbols
from src.analysis.indicators import compute_indicators
from src.analysis.scalping import score_scalp
from src.signals.validator import validate_and_build
from config.settings import SCALPING_TIMEFRAMES

async def test():
    exchange = "binance"
    market_type = "futures"
    
    top_coins = fetch_top_coins()
    ex_symbols = await get_exchange_symbols(exchange, market_type)
    pairs = build_pairs(ex_symbols, top_coins)
    
    print(f"Scanning {len(pairs)} pairs on {exchange}/{market_type}...\n")
    
    max_score = 0
    best_pair = None
    
    for symbol in pairs:
        try:
            data = await fetch_multi_timeframe(exchange, symbol, SCALPING_TIMEFRAMES, market_type)
            if "5m" not in data or "15m" not in data: continue
            
            ind_5m = compute_indicators(data.get("5m"))
            ind_15m = compute_indicators(data.get("15m"))
            if not ind_5m: continue
                
            res = score_scalp(ind_5m, ind_15m)
            long_s = res.get("long_score", 0)
            short_s = res.get("short_score", 0)
            score = max(long_s, short_s)
            
            if score > max_score:
                max_score = score
                best_pair = symbol
                
            if score >= 40:
                print(f"[{symbol}] {res.get('direction', 'NONE')} Score: {score}")
                print(f"  Regime: {ind_5m.get('market_regime')}")
                print(f"  Reasons: {res.get('reasons')}")
                print(f"  RSI: {ind_5m.get('rsi'):.1f}")
                print("-" * 40)
                
            await asyncio.sleep(0.2)
        except Exception as e:
            print(f"Error {symbol}: {e}")
            
    print(f"\nHighest score seen: {max_score} on {best_pair}")

if __name__ == "__main__":
    asyncio.run(test())
