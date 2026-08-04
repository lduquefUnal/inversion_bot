import { useQuery } from '@tanstack/react-query';

/**
 * Estrategia de precios en vivo altamente confiable sin spam de consola:
 * 1. Criptos → CoinGecko API (gratuita, sin CORS)
 * 2. Acciones → Yahoo Finance chart API vía AllOrigins Proxy
 * 3. Producción (Vercel) → /api/precio fallback
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

// ─── Fetch Backend Vercel `/api/precio` (solo producción) ───────────────────
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

      // 1. Criptos en vivo → CoinGecko API
      const cryptoPrices = await fetchCryptoPrices(cryptoTickers);

      // 2. Acciones en vivo → Yahoo Finance vía AllOrigins Proxy
      const stockPricesProxy = await fetchStockPricesAllOrigins(stockTickers);

      const combined = {
        ...cryptoPrices,
        ...stockPricesProxy,
      };

      // 3. En Producción (Vercel) se usa /api/precio solo si algún activo quedó sin precio
      const sinPrecio = tickers.filter(t => combined[t] == null);
      if (sinPrecio.length > 0 && !import.meta.env.DEV) {
        const backendPrices = await fetchFlaskPrices(sinPrecio);
        Object.assign(combined, backendPrices);
      }

      return combined;
    },
  });
};
