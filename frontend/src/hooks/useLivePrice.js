import { useQuery } from '@tanstack/react-query';

/**
 * Precios en vivo SOLO para criptomonedas → CoinGecko API (gratuita, sin CORS).
 * Las acciones ya no se consultan aquí: su precio viene del snapshot de Supabase
 * (`predicciones.Precio_Actual`) que el workflow GitHub Actions actualiza 4x/día.
 * Esto elimina los proxies CORS lentos (AllOrigins/corsproxy) y el endpoint
 * `/api/precio` eliminado en commit 0fc1835.
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

// ─── Hook principal ───────────────────────────────────────────────────────────
export const useLivePrice = (tickers = []) => {
  return useQuery({
    queryKey: ['livePricesCrypto', [...tickers].sort().join(',')],
    enabled: tickers.some(t => COINGECKO_IDS[t]),
    staleTime: 1 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const cryptoTickers = tickers.filter(t => COINGECKO_IDS[t]);
      return fetchCryptoPrices(cryptoTickers);
    },
  });
};
