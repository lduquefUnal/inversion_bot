import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const PREDICCIONES_URL = '/predicciones_v2.json';

const fetchMarketData = async () => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('predicciones')
        .select('payload, fecha')
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && data.payload) {
        const payloadData = typeof data.payload === 'string'
          ? JSON.parse(data.payload)
          : data.payload;

        payloadData.TOP_25_DIPS = payloadData.predicciones || [];
        payloadData._fuente = 'supabase';
        payloadData._fecha_db = data.fecha;
        return payloadData;
      }
    } catch (e) {
      console.warn('Fallback a JSON estático por error al consultar Supabase:', e);
    }
  }

  // Fallback a JSON estático local si Supabase no está activo o falla
  const res = await fetch(`${PREDICCIONES_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error('No se pudo cargar predicciones_v2.json');
  const text = await res.text();
  const sanitized = text.replace(/:\s*NaN\b/g, ': null').replace(/:\s*Infinity\b/g, ': null');
  const data = JSON.parse(sanitized);
  data.TOP_25_DIPS = data.predicciones || [];
  data._fuente = 'json_local';
  return data;
};

export const useMarketData = () =>
  useQuery({
    queryKey: ['marketData'],
    queryFn: fetchMarketData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
