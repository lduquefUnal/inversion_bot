import { useQuery } from '@tanstack/react-query';

const fetchHistorico = async (ticker, period) => {
  // Cuando se mueva a producción, esto será '/api/historico'
  // Por ahora lo forzamos al servidor de flask de desarrollo local
  const url = `http://localhost:5000/api/historico?ticker=${ticker}&period=${period}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudo cargar la data histórica');
  }
  
  return response.json();
};

export const useHistorico = (ticker, period = '5A', enabled = true) => {
  return useQuery({
    queryKey: ['historico', ticker, period],
    queryFn: () => fetchHistorico(ticker, period),
    staleTime: 5 * 60 * 1000, 
    enabled: enabled && !!ticker
  });
};
