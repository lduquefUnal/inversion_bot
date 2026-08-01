import { useQuery } from '@tanstack/react-query';

const PREDICCIONES_URL = '/predicciones_v2.json';

const fetchMarketData = async () => {
  const res = await fetch(`${PREDICCIONES_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error('No se pudo cargar predicciones_v2.json');
  const text = await res.text();
  const sanitized = text.replace(/:\s*NaN\b/g, ': null').replace(/:\s*Infinity\b/g, ': null');
  const data = JSON.parse(sanitized);
  // Normaliza: expone array como TOP_25_DIPS para compatibilidad con AssetGrid
  data.TOP_25_DIPS = data.predicciones || [];
  return data;
};

export const useMarketData = () =>
  useQuery({
    queryKey: ['marketData'],
    queryFn: fetchMarketData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
