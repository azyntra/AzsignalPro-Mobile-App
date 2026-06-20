const axios = require('axios');

// Cache top coins
let cachedTopCoins = [];
let lastTopCoinsFetch = 0;

/**
 * Fetches top 100 coins by market cap from CoinGecko.
 * Caches the result for 30 minutes.
 */
async function fetchTopCoins(limit = 100) {
  const now = Date.now();
  if (cachedTopCoins.length > 0 && now - lastTopCoinsFetch < 30 * 60 * 1000) {
    return cachedTopCoins;
  }

  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
        sparkline: false,
      },
      timeout: 10000,
    });
    
    // Convert symbols to uppercase (e.g., 'BTC', 'ETH')
    let symbols = response.data.map(coin => coin.symbol.toUpperCase());
    
    // Filter out common stablecoins and fiat-pegged tokens
    const stablecoins = ['USDT', 'USDC', 'FDUSD', 'DAI', 'USDD', 'USDE', 'PYUSD', 'TUSD', 'USD1', 'USDB', 'BUSD'];
    symbols = symbols.filter(sym => !stablecoins.includes(sym));

    // Always include a few majors just in case
    if (!symbols.includes('BTC')) symbols.push('BTC');
    if (!symbols.includes('ETH')) symbols.push('ETH');
    
    cachedTopCoins = symbols;
    lastTopCoinsFetch = now;
    console.log(`Fetched ${symbols.length} top coins from CoinGecko.`);
    return cachedTopCoins;
  } catch (error) {
    console.error('Failed to fetch top coins from CoinGecko:', error.message);
    if (cachedTopCoins.length > 0) return cachedTopCoins;
    return ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'MATIC']; // Fallback
  }
}

let exchanges = null;

async function getExchanges() {
  if (exchanges) return exchanges;
  const ccxtModule = await import('ccxt');
  const ccxt = ccxtModule.default || ccxtModule;
  
  exchanges = {
    binance: new ccxt.binance({ enableRateLimit: true, options: { defaultType: 'future' } }),
    bybit: new ccxt.bybit({ enableRateLimit: true, options: { defaultType: 'linear' } }),
    okx: new ccxt.okx({ enableRateLimit: true, options: { defaultType: 'swap' } }),
    kucoin: new ccxt.kucoin({ enableRateLimit: true, options: { defaultType: 'future' } }),
  };
  return exchanges;
}

// Cache loaded markets
const marketLoaded = {
  binance: false,
  bybit: false,
  okx: false,
  kucoin: false,
};

async function getExchangePairs(exchangeName) {
  const exMap = await getExchanges();
  const exchange = exMap[exchangeName];
  if (!exchange) return [];

  try {
    if (!marketLoaded[exchangeName]) {
      await exchange.loadMarkets();
      marketLoaded[exchangeName] = true;
    }
    
    const topCoins = await fetchTopCoins();
    const availableSymbols = Object.keys(exchange.markets);
    
    const pairs = [];
    for (const coin of topCoins) {
      const targetSymbol = `${coin}/USDT:USDT`; // Future format for ccxt
      const spotSymbol = `${coin}/USDT`;
      
      if (availableSymbols.includes(targetSymbol)) {
        pairs.push({ symbol: targetSymbol, marketType: 'futures' });
      } else if (availableSymbols.includes(spotSymbol)) {
        pairs.push({ symbol: spotSymbol, marketType: 'spot' });
      }
    }
    
    return pairs;
  } catch (error) {
    console.error(`Failed to get pairs for ${exchangeName}:`, error.message);
    return [];
  }
}

/**
 * Fetches OHLCV data for multiple timeframes for a given symbol
 * Returns an object: { '1m': [...], '5m': [...], '15m': [...] }
 */
async function fetchMultiTimeframe(exchangeName, symbol, timeframes) {
  const exMap = await getExchanges();
  const exchange = exMap[exchangeName];
  if (!exchange) return {};

  const results = {};
  
  // To avoid hitting rate limits instantly, fetch sequentially
  for (const tf of timeframes) {
    try {
      // Fetch 200 candles
      const ohlcv = await exchange.fetchOHLCV(symbol, tf, undefined, 200);
      
      // Map to standard array of objects
      results[tf] = ohlcv.map(candle => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      // console.error(`Failed to fetch ${tf} for ${symbol} on ${exchangeName}: ${error.message}`);
    }
  }
  
  return results;
}

module.exports = {
  fetchTopCoins,
  getExchangePairs,
  fetchMultiTimeframe,
};
