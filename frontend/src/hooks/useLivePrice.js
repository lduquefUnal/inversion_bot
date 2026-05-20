import { useQuery } from '@tanstack/react-query';

/**
 * Estrategia de precios en vivo (sin necesidad de Flask para el MVP):
 *
 *  CRIPTO → CoinGecko API (gratuita, sin API key, CORS permitido)
 *  ACCIONES → Yahoo Finance query endpoint (público, sin key, puede fallar por CORS)
 *             fallback → Flask /api/precio si está corriendo en local
 *
 * Si todos fallan → el precio queda como null y el Oráculo muestra SIN_DATA.
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

    // Invertir el mapa: { bitcoin: { usd: 95000 } } → { 'BTC-USD': 95000 }
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

// ─── Fetch Yahoo Finance (acciones) ──────────────────────────────────────────
// Usa el endpoint público de Yahoo Finance v8 chart.
// Nota: en algunos navegadores/redes puede tener CORS. En ese caso cae al Flask fallback.
const fetchStockPrices = async (stockTickers) => {
  if (stockTickers.length === 0) return {};

  const results = {};
  await Promise.allSettled(
    stockTickers.map(async (ticker) => {
      try {
        // Intentar Yahoo Finance directo
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`YF HTTP ${res.status}`);
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          results[ticker] = meta.regularMarketPrice;
        }
      } catch (e) {
        // Silencioso — el fallback al Flask lo maneja Portfolio.jsx
        console.warn(`[Yahoo Finance] ${ticker}:`, e.message);
      }
    })
  );
  return results;
};

// ─── Fetch Flask fallback ─────────────────────────────────────────────────────
const API_BASE = import.meta.env.DEV ? 'http://localhost:5000' : '';

const fetchFlaskPrices = async (tickers) => {
  if (!tickers.length) return {};
  try {
    const res = await fetch(`${API_BASE}/api/precio?tickers=${encodeURIComponent(tickers.join(','))}`);
    if (!res.ok) throw new Error(`Flask HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {};
  }
};

// ─── Hook principal ───────────────────────────────────────────────────────────
/**
 * @param {string[]} tickers - Tickers que NO están en mercado.json
 * @returns {{ data: Record<string, number|null>, isLoading }}
 */
export const useLivePrice = (tickers = []) => {
  return useQuery({
    queryKey: ['livePrices', [...tickers].sort().join(',')],
    enabled: tickers.length > 0,
    staleTime: 4 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const cryptoTickers = tickers.filter(t => COINGECKO_IDS[t]);
      const stockTickers  = tickers.filter(t => !COINGECKO_IDS[t]);

      // Lanzar en paralelo
      const [cryptoPrices, stockPrices] = await Promise.all([
        fetchCryptoPrices(cryptoTickers),
        fetchStockPrices(stockTickers),
      ]);

      const combined = { ...cryptoPrices, ...stockPrices };

      // Para los que siguen sin precio → intentar Flask como último recurso
      const sinPrecio = tickers.filter(t => combined[t] == null);
      if (sinPrecio.length > 0) {
        const flaskPrices = await fetchFlaskPrices(sinPrecio);
        Object.assign(combined, flaskPrices);
      }

      return combined;
    },
  });
};
