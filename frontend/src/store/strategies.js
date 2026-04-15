export const STRATEGIES = {
    valiente: {
      id: 'valiente',
      label: 'Valiente',
      emoji: '🔥',
      description: 'Dips agresivos >40%. Alto riesgo, alta recompensa.',
      available: true,
      // Retorna true si un activo pasa esta estrategia. (En Fase 2.5 puliremos esto)
      filter: (asset) => true 
    },
    moderado: {
      id: 'moderado',
      label: 'Smart DCA Moderado',
      emoji: '🎯',
      description: 'Dips medios, SMA200 alcista. Balance riesgo/retorno.',
      available: false,
      filter: (asset) => asset.tipo_dip === 'Medio'
    },
    conservador: {
      id: 'conservador',
      label: 'Conservador',
      emoji: '🛡️',
      description: 'ETFs y Blue Chips con dip leve <20%. Mínimo riesgo.',
      available: false,
      filter: (asset) => asset.tipo_dip === 'Leve' && asset.categoria === 'Recuperacion Rapida'
    }
  };
  
