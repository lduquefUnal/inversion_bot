/**
 * Single Source of Truth for Strategy ML Parameters & Model Performance Metrics.
 * Baseline metrics derived from the honest Out-Of-Sample (OOS) Walk-Forward validation
 * of LightGBM V3.7 specialized models (Modelos/lightgbm_cat_*.pkl & Modelos/modelo_metadata_v3_cat.json).
 * 
 * Target Optimization: F0.5-Score (Precision > Recall) with 100% Reinvestment Compound Interest:
 * EA_compuesto = (1 + E_trade)^N_trades - 1
 */

export const CATEGORY_PARAMS = {
  "⚡ Recup. Rápida": {
    id: "Recup. Rapida",
    catNombre: "⚡ Recup. Rápida",
    label: "⚡ Recup. Rápida",
    shortLabel: "Recup. Rápida",
    emoji: "⚡",
    type: "verde",
    tpPct: 15,
    slPct: 5,
    maxDays: 7,
    confirmacion: "1 Día",
    threshold: "0.40",
    thresholdNum: 0.40,
    f05: 0.4514,
    f05Str: "0.4514",
    winRate: "46.7% OOS",
    winRateNum: 46.7,
    cagr: "+107.2% / año compuesto",
    cagrNum: 107.2,
    retornoTrade: "+2.37%",
    totalTrades: 31,
    friccion: "$0.15 USD",
    descripcion: "Tendencia alcista primaria (precio > SMA200) con corrección corta. (1+0.0237)^31 - 1 = +107.2% compuesto anual.",
  },
  "🎯 Sweet Spot": {
    id: "Sweet Spot",
    catNombre: "🎯 Sweet Spot",
    label: "🎯 Sweet Spot",
    shortLabel: "Sweet Spot",
    emoji: "🎯",
    type: "yellow",
    tpPct: 15,
    slPct: 8,
    maxDays: 14,
    confirmacion: "2 Días",
    threshold: "0.36",
    thresholdNum: 0.36,
    f05: 0.2941,
    f05Str: "0.2941",
    winRate: "44.4% OOS",
    winRateNum: 44.4,
    cagr: "+78.9% / año compuesto",
    cagrNum: 78.9,
    retornoTrade: "+3.29%",
    totalTrades: 18,
    friccion: "$0.15 USD",
    descripcion: "Drawdown moderado (-20% a -35%) en tendencia sana. Expectancia +3.29%/trade. (1+0.0329)^18 - 1 = +78.9% compuesto anual.",
  },
  "🔥 Cazador Dips": {
    id: "Cazador Dips",
    catNombre: "🔥 Cazador Dips",
    label: "🔥 Cazador Dips",
    shortLabel: "Cazador Dips",
    emoji: "🔥",
    type: "red",
    tpPct: 12,
    slPct: 8,
    maxDays: 21,
    confirmacion: "1 Día",
    threshold: "0.51",
    thresholdNum: 0.51,
    f05: 0.3906,
    f05Str: "0.3906",
    winRate: "45.5% OOS",
    winRateNum: 45.5,
    cagr: "+15.4% / año compuesto",
    cagrNum: 15.4,
    retornoTrade: "+0.90%",
    totalTrades: 16,
    friccion: "$0.15 USD",
    descripcion: "Caídas profundas (>35%) con sobreventa RSI14 < 32. Expectancia +0.90%/trade. (1+0.0090)^16 - 1 = +15.4% compuesto anual.",
  },
  "⚠️ Cuchillos Cayendo": {
    id: "Cuchillos Cayendo",
    catNombre: "⚠️ Cuchillos Cayendo",
    label: "⚠️ Cuchillos",
    shortLabel: "Cuchillos",
    emoji: "⚠️",
    type: "gray",
    tpPct: 8,
    slPct: 5,
    maxDays: 7,
    confirmacion: "2 Días",
    threshold: "0.37",
    thresholdNum: 0.37,
    f05: 0.5189,
    f05Str: "0.5189",
    winRate: "45.8% OOS",
    winRateNum: 45.8,
    cagr: "+37.1% / año compuesto",
    cagrNum: 37.1,
    retornoTrade: "+0.66%",
    totalTrades: 48,
    friccion: "$0.15 USD",
    descripcion: "Tendencia bajista sin soporte (precio < SMA200). Alta rotación defensiva. (1+0.0066)^48 - 1 = +37.1% compuesto anual.",
  }
};

/**
 * Normaliza y obtiene los parámetros unificados de una categoría.
 */
export const getCategoryParams = (catName) => {
  if (!catName) return CATEGORY_PARAMS["🎯 Sweet Spot"];
  if (CATEGORY_PARAMS[catName]) return CATEGORY_PARAMS[catName];
  
  const searchStr = catName.toLowerCase();
  const entry = Object.values(CATEGORY_PARAMS).find(
    p => p.id.toLowerCase() === searchStr || 
         p.shortLabel.toLowerCase() === searchStr || 
         searchStr.includes(p.shortLabel.toLowerCase())
  );
  
  return entry || CATEGORY_PARAMS["🎯 Sweet Spot"];
};
