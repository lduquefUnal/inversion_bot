/**
 * Single Source of Truth for Strategy ML Parameters & Model Performance Metrics.
 * Dynamic parameters synced directly from MLOps pipeline (/category_params.json).
 */

export let CATEGORY_PARAMS = {
  "⚡ Recup. Rápida": {
    id: "Recup. Rapida",
    catNombre: "⚡ Recup. Rápida",
    label: "⚡ Recup. Rápida",
    shortLabel: "Recup. Rápida",
    emoji: "⚡",
    type: "verde",
    tpPct: 10,
    slPct: 4,
    maxDays: 11,
    confirmacion: "1 Día",
    threshold: "0.44",
    thresholdNum: 0.44,
    f05: 0.3516,
    f05Str: "0.3516",
    winRate: "33.3% OOS",
    winRateNum: 33.3,
    cagr: "+35.2% / año estimado",
    cagrNum: 35.2,
    retornoTrade: "+10.0%",
    totalTrades: 27,
    friccion: "$0.15 USD",
    descripcion: "Recuperación rápida con tendencia primaria alcista.",
  },
  "🎯 Sweet Spot": {
    id: "Sweet Spot",
    catNombre: "🎯 Sweet Spot",
    label: "🎯 Sweet Spot",
    shortLabel: "Sweet Spot",
    emoji: "🎯",
    type: "yellow",
    tpPct: 15,
    slPct: 6,
    maxDays: 11,
    confirmacion: "2 Días",
    threshold: "0.66",
    thresholdNum: 0.66,
    f05: 0.4167,
    f05Str: "0.4167",
    winRate: "75.0% OOS",
    winRateNum: 75.0,
    cagr: "+45.0% / año estimado",
    cagrNum: 45.0,
    retornoTrade: "+15.0%",
    totalTrades: 4,
    friccion: "$0.15 USD",
    descripcion: "Drawdown moderado en tendencia sana.",
  },
  "🔥 Cazador Dips": {
    id: "Cazador Dips",
    catNombre: "🔥 Cazador Dips",
    label: "🔥 Cazador Dips",
    shortLabel: "Cazador Dips",
    emoji: "🔥",
    type: "red",
    tpPct: 12,
    slPct: 5,
    maxDays: 11,
    confirmacion: "3 Días",
    threshold: "0.54",
    thresholdNum: 0.54,
    f05: 0.3333,
    f05Str: "0.3333",
    winRate: "40.0% OOS",
    winRateNum: 40.0,
    cagr: "+18.0% / año estimado",
    cagrNum: 18.0,
    retornoTrade: "+12.0%",
    totalTrades: 10,
    friccion: "$0.15 USD",
    descripcion: "Caídas profundas con sobreventa extrema.",
  },
  "⚠️ Cuchillos Cayendo": {
    id: "Cuchillos Cayendo",
    catNombre: "⚠️ Cuchillos",
    label: "⚠️ Cuchillos",
    shortLabel: "Cuchillos",
    emoji: "⚠️",
    type: "purple",
    tpPct: 8,
    slPct: 4,
    maxDays: 11,
    confirmacion: "1 Día",
    threshold: "0.41",
    thresholdNum: 0.41,
    f05: 0.5952,
    f05Str: "0.5952",
    winRate: "50.6% OOS",
    winRateNum: 50.6,
    cagr: "+25.0% / año estimado",
    cagrNum: 25.0,
    retornoTrade: "+8.0%",
    totalTrades: 79,
    friccion: "$0.15 USD",
    descripcion: "Alta rotación defensiva en tendencia bajista.",
  }
};

// Carga asíncrona de category_params.json generado por sync_artifacts.py
if (typeof window !== 'undefined') {
  fetch('/category_params.json')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && Object.keys(data).length > 0) {
        CATEGORY_PARAMS = { ...CATEGORY_PARAMS, ...data };
      }
    })
    .catch(() => {});
}

/**
 * Normaliza y obtiene los parámetros unificados de una categoría.
 */
export const getCategoryParams = (catName) => {
  if (!catName) return CATEGORY_PARAMS["🎯 Sweet Spot"];
  if (CATEGORY_PARAMS[catName]) return CATEGORY_PARAMS[catName];
  
  const searchStr = String(catName).toLowerCase();
  const entry = Object.values(CATEGORY_PARAMS).find(
    p => p.id.toLowerCase() === searchStr || 
         p.shortLabel.toLowerCase() === searchStr || 
         searchStr.includes(p.shortLabel.toLowerCase()) ||
         p.label.toLowerCase() === searchStr
  );
  
  return entry || CATEGORY_PARAMS["🎯 Sweet Spot"];
};

