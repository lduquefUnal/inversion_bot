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
      const parsed = JSON.parse(sanitized);
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed.predicciones || parsed.TOP_25_DIPS || parsed.TOP_50_DIPS || parsed.TODOS_LOS_ACTIVOS || parsed.todos_los_activos || []);
      if (!Array.isArray(parsed)) {
        localData = parsed;
        localData.predicciones = list;
        localData.TOP_25_DIPS = list;
        localData._fuente = 'json_local';
      } else {
        localData = { predicciones: list, TOP_25_DIPS: list, _fuente: 'json_local' };
      }
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
        let payloadData = typeof data.payload === 'string'
          ? JSON.parse(data.payload)
          : data.payload;

        const list = Array.isArray(payloadData)
          ? payloadData
          : (payloadData.predicciones || payloadData.TOP_25_DIPS || payloadData.TOP_50_DIPS || payloadData.TODOS_LOS_ACTIVOS || payloadData.todos_los_activos || []);

        if (Array.isArray(payloadData)) {
          payloadData = { predicciones: list, TOP_25_DIPS: list };
        } else {
          payloadData.predicciones = list;
          payloadData.TOP_25_DIPS = list;
        }

        payloadData._fuente = 'supabase';
        payloadData._fecha_db = data.fecha;

        // Si tenemos datos locales, verificar si tienen el esquema V5
        if (localData && localData.TOP_25_DIPS) {
          const localHasV5 = localData.TOP_25_DIPS[0]?.CMF_20 !== undefined || localData.TOP_25_DIPS[0]?.Score_Streak !== undefined;
          const remoteHasV5 = list[0]?.CMF_20 !== undefined || list[0]?.Score_Streak !== undefined;
          const dbTime = new Date(data.fecha).getTime();
          const localTime = localData?.fecha_inferencia ? new Date(localData.fecha_inferencia).getTime() : 0;

          // En desarrollo local o si localData contiene V5 y Supabase aún tiene schema anterior, usar local
          if (import.meta.env.DEV || (localHasV5 && !remoteHasV5) || localTime >= dbTime) {
            return localData;
          }

          // Si Supabase es más reciente pero le faltan variables V5, enriquecerlo con el mapeo local
          const localMap = new Map((localData.TOP_25_DIPS || []).map(item => [item.Ticker, item]));
          list.forEach(item => {
            const loc = localMap.get(item.Ticker);
            if (loc) {
              if (item.Score_Streak === undefined) item.Score_Streak = loc.Score_Streak;
              if (item.Score_RSI_3 === undefined) item.Score_RSI_3 = loc.Score_RSI_3;
              if (item.CMF_20 === undefined) item.CMF_20 = loc.CMF_20;
              if (item.Price_Reversal_Giro === undefined) item.Price_Reversal_Giro = loc.Price_Reversal_Giro;
              if (item.Gatillo_Precio === undefined) item.Gatillo_Precio = loc.Gatillo_Precio;
              if (item.Trii_Estado === undefined) item.Trii_Estado = loc.Trii_Estado;
              if (item.Trii_TP_USD === undefined) item.Trii_TP_USD = loc.Trii_TP_USD;
              if (item.Trii_SL_USD === undefined) item.Trii_SL_USD = loc.Trii_SL_USD;
              if (item.Trii_TimeStop_Dias === undefined) item.Trii_TimeStop_Dias = loc.Trii_TimeStop_Dias;
              if (item.Trii_RR_Ratio === undefined) item.Trii_RR_Ratio = loc.Trii_RR_Ratio;
            }
          });
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
