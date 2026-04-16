import { useQuery } from '@tanstack/react-query';

const fetchHistorico = async (ticker, period) => {
  // Cuando se mueva a producción, esto será '/api/historico'
  // Por ahora Vite proxy se encargará de local
  const url = `/api/historico?ticker=${ticker}&period=${period}`;
  
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
