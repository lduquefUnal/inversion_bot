import { useQuery } from '@tanstack/react-query';

// Usamos el archivo 'mercado.json' copiado localmente para facilitar el desarrollo en React
// Luego en producción conectaremos esto al endpoint del Flask API
const MARKET_DATA_URL = '/mercado.json';
const REPORT_URL = '/ultimo_reporte.md';

const fetchMarketData = async () => {
  try {
    const response = await fetch(`${MARKET_DATA_URL}?t=${new Date().getTime()}`);
    if (!response.ok) throw new Error('No se pudo cargar la data del mercado');
    const data = await response.json();

    // Normalizar la llave generada por el bot (TOP_50 o TOP_25)
    if (data.TOP_50_DIPS && !data.TOP_25_DIPS) {
      data.TOP_25_DIPS = data.TOP_50_DIPS;
    }

    // Intentamos cargar el reporte
    try {
      const repRes = await fetch(`${REPORT_URL}?t=${new Date().getTime()}`);
      if (repRes.ok) {
        const mdText = await repRes.text();
        // Parsear el Markdown usando la misma lógica del bot
        const pattern = /\*\*(\d+)\.\s+([A-Z0-9\^\-]+)\s+(.*?)\*\*\n(.*?)(?=\*\*\d+\.|\n#|$)/gs;
        
        let match;
        const parsedReport = {};
        
        while ((match = pattern.exec(mdText)) !== null) {
          const ticker = match[2];
          let details = match[4].trim();
          
          parsedReport[ticker] = details;
        }

        // Anexarlo al JSON
        if (data.TOP_25_DIPS) {
           data.TOP_25_DIPS = data.TOP_25_DIPS.map(asset => {
              return { ...asset, AI_Details: parsedReport[asset.Ticker] || null };
           });
        }
      }
    } catch (e) {
      console.error("Error cargando reporte Markdown", e);
    }

    return data;
  } catch (err) {
    console.error('Error fetching market data:', err);
    throw err;
  }
};

export const useMarketData = () => {
  return useQuery({
    queryKey: ['marketData'],
    queryFn: fetchMarketData,
    staleTime: 5 * 60 * 1000, 
    refetchInterval: 30 * 60 * 1000 // Refresca cada 30 min extra precaución
  });
};
