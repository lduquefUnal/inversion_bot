import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const PREDICCIONES_URL = '/predicciones_v2.json';

const fetchMarketData = async () => {
  let localData = null;
  try {
    const res = await fetch(`${PREDICCIONES_URL}?t=${Date.now()}`);
    if (res.ok) {
      const text = await res.text();
      const sanitized = text.replace(/:\s*NaN\b/g, ': null').replace(/:\s*Infinity\b/g, ': null');
      localData = JSON.parse(sanitized);
      localData.predicciones = localData.predicciones || localData.TOP_25_DIPS || [];
      localData.TOP_25_DIPS = localData.predicciones;
      localData._fuente = 'json_local';
    }
  } catch (e) {
    console.warn('No se pudo cargar local predicciones_v2.json:', e);
  }

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

        payloadData.predicciones = payloadData.predicciones || payloadData.TOP_25_DIPS || [];
        payloadData.TOP_25_DIPS = payloadData.predicciones;
        payloadData._fuente = 'supabase';
        payloadData._fecha_db = data.fecha;

        // Si tenemos datos locales y su fecha de inferencia es MÁS RECIENTE que la fecha de DB, preferir local
        const dbTime = new Date(data.fecha).getTime();
        const localTime = localData?.fecha_inferencia ? new Date(localData.fecha_inferencia).getTime() : 0;

        if (localTime > dbTime) {
          return localData;
        }

        return payloadData;
      }
    } catch (e) {
      console.warn('Fallback a JSON local por error al consultar Supabase:', e);
    }
  }

  return localData || { predicciones: [], TOP_25_DIPS: [] };
};

export const useMarketData = () =>
  useQuery({
    queryKey: ['marketData'],
    queryFn: fetchMarketData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
