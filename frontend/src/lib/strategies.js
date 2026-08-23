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
    tpPct: 8.95,
    slPct: 4.07,
    maxDays: 11,
    confirmacion: "1 Día",
    threshold: "0.45",
    thresholdNum: 0.45,
    f05: 0.3409,
    f05Str: "0.3409",
    winRate: "32.1% OOS",
    winRateNum: 32.1,
    cagr: "+35.2% / año (EA)",
    cagrNum: 35.2,
    retornoTrade: "+0.11%",
    totalTrades: 28,
    friccion: "$0.15 USD",
    descripcion: "Recuperación rápida con tendencia primaria alcista e impulso EMA20 sobre SMA50.",
  },
  "🎯 Sweet Spot": {
    id: "Sweet Spot",
    catNombre: "🎯 Sweet Spot",
    label: "🎯 Sweet Spot",
    shortLabel: "Sweet Spot",
    emoji: "🎯",
    type: "yellow",
    tpPct: 10.5,
    slPct: 4.5,
    maxDays: 11,
    confirmacion: "1 Día",
    threshold: "0.45",
    thresholdNum: 0.45,
    f05: 0.3125,
    f05Str: "0.3125",
    winRate: "36.4% OOS",
    winRateNum: 36.4,
    cagr: "+148.5% / año (EA)",
    cagrNum: 148.5,
    retornoTrade: "+0.96%",
    totalTrades: 11,
    friccion: "$0.15 USD",
    descripcion: "Drawdown moderado en tendencia sana sobre la SMA200 con ratio TP/ATR de 2.4x.",
  },
  "🔥 Cazador Dips": {
    id: "Cazador Dips",
    catNombre: "🔥 Cazador Dips",
    label: "🔥 Cazador Dips",
    shortLabel: "Cazador Dips",
    emoji: "🔥",
    type: "red",
    tpPct: 9.5,
    slPct: 4.2,
    maxDays: 11,
    confirmacion: "1 Día",
    threshold: "0.45",
    thresholdNum: 0.45,
    f05: 0.2604,
    f05Str: "0.2604",
    winRate: "26.3% OOS",
    winRateNum: 26.3,
    cagr: "-18.2% / año (EA)",
    cagrNum: -18.2,
    retornoTrade: "-0.59%",
    totalTrades: 19,
    friccion: "$0.15 USD",
    descripcion: "Caídas profundas con sobreventa Connors RSI 2D y compresiones GARCH.",
  },
  "⚠️ Cuchillos Cayendo": {
    id: "Cuchillos Cayendo",
    catNombre: "⚠️ Cuchillos",
    label: "⚠️ Cuchillos",
    shortLabel: "Cuchillos",
    emoji: "⚠️",
    type: "purple",
    tpPct: 8.0,
    slPct: 4.0,
    maxDays: 11,
    confirmacion: "1 Día",
    threshold: "0.45",
    thresholdNum: 0.45,
    f05: 0.5682,
    f05Str: "0.5682",
    winRate: "49.2% OOS",
    winRateNum: 49.2,
    cagr: "+312.4% / año (EA)",
    cagrNum: 312.4,
    retornoTrade: "+1.91%",
    totalTrades: 61,
    friccion: "$0.15 USD",
    descripcion: "Alta rotación táctica defensiva en activos con drawdown acentuado.",
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

