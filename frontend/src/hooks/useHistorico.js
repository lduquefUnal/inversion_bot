import { useQuery } from '@tanstack/react-query';

const rangeMap = { '1S': '5d', '1M': '1mo', '3M': '3mo', '1A': '1y', '3A': '3y', '5A': '5y' };

const parseYahooChartData = (json) => {
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp) return { data: [] };

  const timestamps = result.timestamp;
  const quotes = result.indicators?.quote?.[0] || {};
  const opens = quotes.open || [];
  const highs = quotes.high || [];
  const lows = quotes.low || [];
  const closes = quotes.close || [];
  const volumes = quotes.volume || [];

  const data = timestamps.map((ts, i) => {
    const d = new Date(ts * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const c = closes[i] ?? 0;
    const o = opens[i] ?? c;
    const h = highs[i] ?? c;
    const l = lows[i] ?? c;
    const v = volumes[i] ?? 0;
    return {
      date: dateStr,
      open: Number(o.toFixed(2)),
      high: Number(h.toFixed(2)),
      low: Number(l.toFixed(2)),
      close: Number(c.toFixed(2)),
      volume: Number(v),
    };
  }).filter(item => item.close > 0);

  return { data };
};

const fetchHistorico = async (ticker, period = '1A') => {
  if (!ticker) return { data: [] };
  const range = rangeMap[period] || '1y';

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const parsed = parseYahooChartData(json);
      if (parsed.data.length > 0) return parsed;
    }
    
    // Fallback URL
    const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
    const res2 = await fetch(url2);
    if (res2.ok) {
      const json2 = await res2.json();
      return parseYahooChartData(json2);
    }
  } catch (e) {
    console.warn(`[useHistorico] Error consultando histórico para ${ticker}:`, e);
  }

  return { data: [] };
};

export const useHistorico = (ticker, period = '1A', enabled = true) => {
  return useQuery({
    queryKey: ['historico', ticker, period],
    queryFn: () => fetchHistorico(ticker, period),
    staleTime: 5 * 60 * 1000, 
    enabled: enabled && !!ticker
  });
};
