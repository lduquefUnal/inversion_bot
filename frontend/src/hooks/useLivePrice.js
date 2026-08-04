import { useQuery } from '@tanstack/react-query';

/**
 * Estrategia de precios en vivo altamente confiable:
 * 1. Criptos → CoinGecko API
 * 2. Backend Flask / Vercel API `/api/precio` (usando yfinance nativo en Python)
 * 3. Fallback directo en navegador → AllOrigins Proxy + Yahoo Finance chart API
 */

// ─── Mapeo Cripto → CoinGecko IDs ────────────────────────────────────────────
const COINGECKO_IDS = {
  'BTC-USD': 'bitcoin',
  'ETH-USD': 'ethereum',
  'SOL-USD': 'solana',
  'ADA-USD': 'cardano',
  'DOGE-USD': 'dogecoin',
  'XRP-USD': 'ripple',
  'BNB-USD': 'binancecoin',
  'MATIC-USD': 'matic-network',
  'DOT-USD': 'polkadot',
  'AVAX-USD': 'avalanche-2',
};

// ─── Fetch CoinGecko ──────────────────────────────────────────────────────────
const fetchCryptoPrices = async (cryptoTickers) => {
  if (cryptoTickers.length === 0) return {};
  const ids = cryptoTickers.map(t => COINGECKO_IDS[t]).filter(Boolean).join(',');
  if (!ids) return {};

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();

    const result = {};
    cryptoTickers.forEach(ticker => {
      const cgId = COINGECKO_IDS[ticker];
      if (cgId && data[cgId]?.usd != null) {
        result[ticker] = data[cgId].usd;
      }
    });
    return result;
  } catch (e) {
    console.warn('[CoinGecko] Error:', e.message);
    return {};
  }
};

// ─── Fetch Backend Vercel / Flask `/api/precio` ─────────────────────────────
const fetchFlaskPrices = async (tickers) => {
  if (!tickers.length) return {};
  try {
    const res = await fetch(`/api/precio?tickers=${encodeURIComponent(tickers.join(','))}`);
    if (!res.ok) throw new Error(`API HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {};
  }
};

// ─── Fetch Stock Yahoo Finance con Proxy AllOrigins ──────────────────────────
const fetchStockPricesAllOrigins = async (stockTickers) => {
  if (stockTickers.length === 0) return {};

  const results = {};
  await Promise.allSettled(
    stockTickers.map(async (ticker) => {
      try {
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`AllOrigins HTTP ${res.status}`);
        const wrapper = await res.json();
        if (wrapper?.contents) {
          const parsed = JSON.parse(wrapper.contents);
          const meta = parsed?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice != null) {
            results[ticker] = Number(meta.regularMarketPrice);
          }
        }
      } catch (e) {
        console.warn(`[Yahoo AllOrigins] ${ticker}:`, e.message);
      }
    })
  );
  return results;
};

// ─── Hook principal ───────────────────────────────────────────────────────────
export const useLivePrice = (tickers = []) => {
  return useQuery({
    queryKey: ['livePrices', [...tickers].sort().join(',')],
    enabled: tickers.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const cryptoTickers = tickers.filter(t => COINGECKO_IDS[t]);
      const stockTickers  = tickers.filter(t => !COINGECKO_IDS[t]);

      // 1. Intentar Backend API (Vercel / Flask) primero para todos los tickers
      const backendPrices = await fetchFlaskPrices(tickers);

      // 2. Para los que faltan: Criptos → CoinGecko
      const cryptoPrices = await fetchCryptoPrices(cryptoTickers);

      // 3. Para los stocks que sigan sin precio → Yahoo Finance a través de AllOrigins
      const sinPrecioStock = stockTickers.filter(t => backendPrices[t] == null);
      const stockPricesProxy = await fetchStockPricesAllOrigins(sinPrecioStock);

      const combined = {
        ...cryptoPrices,
        ...stockPricesProxy,
        ...backendPrices, // El backend tiene prioridad si está activo
      };

      return combined;
    },
  });
};
