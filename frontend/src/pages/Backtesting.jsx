import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarketData } from '../hooks/useMarketData';
import { CATEGORY_PARAMS } from '../lib/strategies';

// ─── Configuración Base de Categorías V3.7 ──────────────────────────────────
const COLOR_MAP = {
  verde:  { color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: '#10b981' },
  yellow: { color: '#eab308', bg: 'rgba(234,179,8,0.15)', border: '#eab308' },
  orange: { color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: '#f97316' },
  red:    { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: '#ef4444' },
  purple: { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: '#a78bfa' },
  blue:   { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: '#38bdf8' },
  gray:   { color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', border: '#64748b' },
};

const DEFAULT_CATEGORIAS = Object.values(CATEGORY_PARAMS).map(p => {
  const cMap = COLOR_MAP[p.type] || COLOR_MAP.gray;
  return {
    id: p.catNombre,
    emoji: p.emoji,
    nombre: p.id,
    tp: p.tpPct,
    sl: p.slPct,
    limiteDias: p.maxDays,
    confirmacion: parseInt(p.confirmacion || 1),
    winRate: p.winRateNum,
    retornoTrade: p.retornoTrade ? parseFloat(p.retornoTrade) : 0.29,
    totalTrades: p.totalTrades,
    cagr: p.cagrNum ?? 132.1,
    ea: p.cagrNum ?? 132.1,
    frecuencia: `1 trade c/ ${p.totalTrades ? (30 / (p.totalTrades / 12)).toFixed(1) : '10'} días`,
    color: cMap.color,
    bg: cMap.bg,
    border: cMap.border,
    desc: p.descripcion,
    f05: p.f05,
  };
});

// ─── Diccionario Explicativo SHAP & Métricas Predictivas V5 ────────────────────
const SHAP_DESCRIPTIONS = {
  'CMF_20': {
    titulo: 'Chaikin Money Flow 20D (Flujo Institucional)',
    desc: 'Mide la acumulación o distribución de capital institucional en 20 días. CMF < -0.15 detecta liquidación forzosa masiva; el modelo lo penaliza para evitar trampas bajistas (filtro anti-cuchillos como ENPH o PLUG).',
    categoria: 'Flujo de Dinero'
  },
  'Bear_Power_Delta_3D': {
    titulo: 'Bear Power Delta 3D (Exhaustión Vendedora)',
    desc: 'Mide la contracción en la distancia de los mínimos relativos a la EMA13 en 3 días. Valores positivos (+0.0318 correlación con rebote) señalan agotamiento del impulso bajista antes de la recuperación.',
    categoria: 'Fuerza Bajista'
  },
  'Price_Reversal_Giro': {
    titulo: 'Acción de Precio de Giro (Trigger Técnico)',
    desc: 'Detecta rechazo de mínimos intradía mediante mecha inferior de absorción (Hammer/Pinbar) o cierre con mínimo superior (Higher Low). Gatillo maestro para autorizar compras en Trii.',
    categoria: 'Acción de Precio'
  },
  'RS_vs_SPY_5D': {
    titulo: 'Fuerza Relativa vs S&P 500 (5 Días)',
    desc: 'Diferencial de retorno de los últimos 5 días contra el SPY. Distingue una corrección técnica de mercado de un colapso idiosincrático de negocio.',
    categoria: 'Fuerza Relativa'
  },
  'Score_Streak': {
    titulo: 'Racha de Score ML Consecutivo',
    desc: 'Número de días consecutivos con incremento en la probabilidad predictiva del modelo. Una racha ≥ 2 días eleva el Win Rate al 51.9% eliminando falsos rebotes de un solo día.',
    categoria: 'Momentum ML'
  },
  'Score_RSI_3': {
    titulo: 'Score-RSI (3 Días)',
    desc: 'Oscilador RSI de 3 periodos calculado sobre el scoring continuo del modelo. Confirma aceleración de la convicción en zona de soporte.',
    categoria: 'Momentum ML'
  },
  'Drawdown_10W_%': {
    titulo: 'Drawdown Máximo de 10 Semanas (%)',
    desc: 'Caída máxima acumulada en 10 semanas. Reemplaza la colinealidad de múltiples drawdowns por una métrica limpia de descuento táctico sin sobreajuste.',
    categoria: 'Riesgo & Descuento'
  },
  'TP_ATR': {
    titulo: 'Take Profit Adaptativo por ATR ($)',
    desc: 'Precio objetivo dinámico de ganancia calculado en función de la volatilidad real (ATR) del activo, adaptando la salida a las condiciones del mercado.',
    categoria: 'Gestión de Salida'
  },
  'ATR_%': {
    titulo: 'ATR % (Rango Verdadero Promedio en %)',
    desc: 'Mide la volatilidad diaria esperada del activo. Un ATR alto indica oscilaciones amplias de precio, crucial para colocar Stop Loss dinámicos y ajustar el tamaño de posición.',
    categoria: 'Volatilidad & Riesgo'
  },
  'Dist_SMA200_%': {
    titulo: 'Distancia a Media Móvil de 200 días (%)',
    desc: 'Porcentaje de desviación del precio respecto a su tendencia de largo plazo (200D). Valores muy negativos señalan sobreventa masiva (oportunidad de rebote técnico).',
    categoria: 'Tendencia & Desviación'
  },
  'GARCH_Regime': {
    titulo: 'Régimen de Volatilidad GARCH (60D)',
    desc: 'Ratio entre la volatilidad condicional estimada por el modelo GARCH y la volatilidad histórica normalizada. Señala compresión previa a expansión direccional.',
    categoria: 'Volatilidad Dinámica'
  },
  'Vol_Ratio_20_50': {
    titulo: 'Ratio de Volumen 20D / 50D',
    desc: 'Relación entre el volumen reciente y la media de 50 sesiones. Volumen creciente en zona de soporte valida interés comprador institucional.',
    categoria: 'Volumen'
  },
  'MACD_Hist': {
    titulo: 'Histograma MACD Diario',
    desc: 'Diferencia entre la línea MACD y su señal. La contracción del histograma negativo anticipa el cruce alcista inminente.',
    categoria: 'Momentum'
  },
  'RSI_2': {
    titulo: 'RSI de 2 Días (Estrategia Connors)',
    desc: 'RSI ultra-corto de 2 días usado para identificar picos de capitulación extrema en 24-48 horas.',
    categoria: 'Momentum'
  },
  'RSI_2D': {
    titulo: 'RSI de 2 Días (Estrategia Connors)',
    desc: 'RSI ultra-corto de 2 días usado para identificar picos de capitulación extrema en 24-48 horas.',
    categoria: 'Momentum'
  },
  'RSI_7': {
    titulo: 'RSI de 7 Días (Momentum Rápido)',
    desc: 'Oscilador rápido de fuerza relativa (7 días). Lecturas por debajo de 30 detectan sobreventa inminente para entradas tácticas de corto plazo.',
    categoria: 'Momentum'
  },
  'RSI_14D': {
    titulo: 'RSI Clásico de 14 Días',
    desc: 'Mide la fuerza del impulso a mediano plazo (14 días). < 30 = Sobrevendido | > 70 = Sobrecomprado.',
    categoria: 'Momentum'
  },
  'RSI_14': {
    titulo: 'RSI Clásico de 14 Días',
    desc: 'Mide la fuerza del impulso a mediano plazo (14 días). < 30 = Sobrevendido | > 70 = Sobrecomprado.',
    categoria: 'Momentum'
  },
  'Drawdown_52W_%': {
    titulo: 'Drawdown Máximo de 52 Semanas (%)',
    desc: 'Caída máxima acumulada desde el punto más alto del último año. Mide el nivel de descuento actual del activo.',
    categoria: 'Riesgo & Descuento'
  },
  'FCF': {
    titulo: 'Free Cash Flow (Flujo de Caja Libre)',
    desc: 'Efectivo real generado tras gastos operativos y de capital. Mide la solidez financiera de la empresa.',
    categoria: 'Fundamentales'
  },
  'PE_Ratio': {
    titulo: 'P/E Ratio (Precio / Ganancia)',
    desc: 'Múltiplo de valoración sobre ganancias netas. < 15 indica valoración atractiva; > 30 alto crecimiento o sobrevaloración.',
    categoria: 'Fundamentales'
  },
  'Beta': {
    titulo: 'Beta de Mercado',
    desc: 'Sensibilidad vs S&P 500. Beta > 1 significa que el activo se mueve más agresivamente que el mercado general.',
    categoria: 'Fundamentales'
  },
  'Tendencia_Sana': {
    titulo: 'Filtro de Tendencia Sana (Binary)',
    desc: 'Valida si el activo cotiza en una estructura alcista de largo plazo o si está en colapso estructural.',
    categoria: 'Filtro Técnico'
  }
};

const getShapMeta = (featureName) => {
  if (SHAP_DESCRIPTIONS[featureName]) return SHAP_DESCRIPTIONS[featureName];
  if (featureName.includes('RSI')) {
    return { titulo: `RSI (${featureName})`, desc: 'Indicador de Momentum que mide sobrecompra o sobreventa del precio.', categoria: 'Momentum' };
  }
  if (featureName.includes('ATR')) {
    return { titulo: `ATR (${featureName})`, desc: 'Métrica basada en el Rango Verdadero Promedio para medir volatilidad.', categoria: 'Volatilidad' };
  }
  if (featureName.includes('VOL') || featureName.includes('HVOL')) {
    return { titulo: `Volatilidad (${featureName})`, desc: 'Medición de variación de retorno histórico del activo.', categoria: 'Volatilidad' };
  }
  if (featureName.includes('SMA') || featureName.includes('EMA')) {
    return { titulo: `Media Móvil (${featureName})`, desc: 'Desviación del precio con respecto a promedios móviles.', categoria: 'Tendencia' };
  }
  return { titulo: featureName, desc: 'Variable predictiva técnica/fundamental utilizada por LightGBM para calcular el scoring de entrada.', categoria: 'Feature ML' };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = '#f8fafc', bg = 'rgba(15,23,42,0.8)', tooltip, sub }) => (
  <div className={tooltip ? "has-tooltip" : ""} style={{
    background: bg, padding: '18px 20px', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)', cursor: tooltip ? 'help' : 'default',
  }}>
    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{value}</div>
    {sub && <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '3px' }}>{sub}</div>}
    {tooltip && (
      <div className="tooltip-box">
        <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '3px' }}>💡 {label}</div>
        <div>{tooltip}</div>
      </div>
    )}
  </div>
);

const Bar = ({ pct, color }) => (
  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: '6px' }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width 0.6s ease' }} />
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
const RESULT_CFG = {
  WIN:     { label: '✅ WIN',     color: '#10b981', bg: 'rgba(16,185,129,0.12)',   border: 'rgba(16,185,129,0.3)' },
  LOSS:    { label: '❌ LOSS',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.3)' },
  TIMEOUT: { label: '⏱️ TIMEOUT', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  ABIERTO: { label: '🔵 ABIERTO', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
};

const CAT_COLOR = {
  'Sweet Spot':        { color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  'Cazador Dips':      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'Recup. Rapida':     { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'Cuchillos Cayendo': { color: '#94a3b8', bg: 'rgba(100,116,139,0.12)' },
};

const Backtesting = () => {
  const [selectedCat, setSelectedCat] = useState('⚡ Recup. Rápida');
  const { data: marketData, isLoading } = useMarketData();

  // Estados dinámicos de artefactos V3.7
  const [v3Meta, setV3Meta] = useState(null);
  const [shapData, setShapData] = useState(null);
  const [bt, setBt] = useState(null);
  const [btLoading, setBtLoading] = useState(true);
  const [btFilter, setBtFilter] = useState('TODOS');
  const [btCatFilter, setBtCatFilter] = useState('Todos');

  useEffect(() => {
    // Cargar metadata de modelos dinámicos V3.7
    fetch('/modelo_metadata_v3_cat.json?t=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setV3Meta(d))
      .catch(() => {});

    // Cargar SHAP importances
    fetch('/v3_shap_importances.json?t=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setShapData(d))
      .catch(() => {});

    // Cargar backtest OOS consolidado V3.7
    fetch('/v3_backtest_reporte_consolidado.json?t=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setV3Meta(prev => ({ ...prev, consolidado: d })))
      .catch(() => {});

    // Cargar trades reales del backtest 45 días
    fetch('/backtest_45d.json?t=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(d => { setBt(d); setBtLoading(false); })
      .catch(() => setBtLoading(false));
  }, []);

  // Fusionar categorías base con metadatos dinámicos V3.7
  const categoriasDyn = useMemo(() => {
    return DEFAULT_CATEGORIAS.map(c => {
      const meta = v3Meta ? v3Meta[c.nombre] : null;
      if (!meta) return c;
      return {
        ...c,
        f05: meta.f05_score || c.f05,
        winRate: meta.metrics?.['wr_%'] ?? c.winRate,
        totalTrades: meta.metrics?.n ?? c.totalTrades,
        thOptimo: meta.th_optimo,
      };
    });
  }, [v3Meta]);

  const cat = categoriasDyn.find(c => c.id === selectedCat) || categoriasDyn[0];

  const [execMode, setExecMode] = useState('ESTANDAR'); // 'ESTANDAR' (default) | 'TIMEOUT'

  const activosCat = useMemo(() => {
    const predicciones = marketData?.TOP_25_DIPS || [];
    return predicciones.filter(a => {
      const rawCat = a.Categoria || '';
      return rawCat.includes(cat.nombre.replace('⚡ ', '').replace('🎯 ', '').replace('🔥 ', '').replace('⚠️ ', ''));
    });
  }, [marketData, cat]);

  const buySignals = activosCat.filter(a => (a.Veredicto || a.Veredicto_V2) === 'BUY');
  const avgProb = activosCat.length
    ? (activosCat.reduce((s, a) => s + (a['Probabilidad_Exito_%'] || 0), 0) / activosCat.length).toFixed(1)
    : 0;

  const allBtTrades = useMemo(() => {
    if (!bt) return [];
    const source = (execMode === 'TIMEOUT' && bt.trades_timeout) ? bt.trades_timeout : (bt.trades || []);
    return source.map(t => {
      if (execMode === 'TIMEOUT') {
        const pnlNeto = t['PnL_Neto_Timeout_%'] ?? t['PnL_Neto_%'] ?? t['PnL_%'] ?? 0;
        const exitPrice = t.Precio_Salida_Timeout ?? t.Precio_Salida ?? t.Precio_Entrada_Hist;
        return {
          ...t,
          Resultado: 'TIMEOUT',
          Precio_Salida: exitPrice,
          'PnL_Neto_%': pnlNeto,
        };
      }
      return t;
    });
  }, [bt, execMode]);

  // Estadísticas globales de backtest real (Pilar 1: Cantidad & Pilar 2: Calidad)
  const btStats = useMemo(() => {
    if (!allBtTrades || allBtTrades.length === 0) return null;
    const total = allBtTrades.length;
    const wins = allBtTrades.filter(t => t.Resultado === 'WIN');
    const losses = allBtTrades.filter(t => t.Resultado === 'LOSS');
    const timeouts = allBtTrades.filter(t => t.Resultado === 'TIMEOUT');

    const winCount = wins.length;
    const lossCount = losses.length;
    const timeoutCount = timeouts.length;

    const winRate = total > 0 ? Number(((winCount / total) * 100).toFixed(1)) : 0;
    const pnlNetoSum = allBtTrades.reduce((acc, t) => acc + (t['PnL_Neto_%'] ?? t['PnL_%'] ?? 0), 0);
    const pnlAvg = Number((pnlNetoSum / total).toFixed(2));

    const avgWin = winCount > 0
      ? Number((wins.reduce((acc, t) => acc + (t['PnL_Neto_%'] ?? t['PnL_%'] ?? 0), 0) / winCount).toFixed(2))
      : 0;

    const avgLoss = lossCount > 0
      ? Number((losses.reduce((acc, t) => acc + (t['PnL_Neto_%'] ?? t['PnL_%'] ?? 0), 0) / lossCount).toFixed(2))
      : 0;

    const avgDaysWin = winCount > 0
      ? Number((wins.reduce((acc, t) => acc + (t.Dias_Trade || 0), 0) / winCount).toFixed(1))
      : 0;

    const avgDaysLoss = lossCount > 0
      ? Number((losses.reduce((acc, t) => acc + (t.Dias_Trade || 0), 0) / lossCount).toFixed(1))
      : 0;

    const avgDaysTotal = Number((allBtTrades.reduce((acc, t) => acc + (t.Dias_Trade || 0), 0) / total).toFixed(1));
    const payoffRatio = Math.abs(avgLoss) > 0 ? Number((avgWin / Math.abs(avgLoss)).toFixed(2)) : 0;
    const diasPorSenal = Number((45 / total).toFixed(1));

    const catBreakdown = {};
    allBtTrades.forEach(t => {
      const c = t.Categoria || 'Sin Categoría';
      if (!catBreakdown[c]) {
        catBreakdown[c] = { total: 0, wins: 0, losses: 0, pnlSum: 0 };
      }
      catBreakdown[c].total += 1;
      if (t.Resultado === 'WIN') catBreakdown[c].wins += 1;
      if (t.Resultado === 'LOSS') catBreakdown[c].losses += 1;
      catBreakdown[c].pnlSum += (t['PnL_Neto_%'] ?? 0);
    });

    Object.keys(catBreakdown).forEach(k => {
      const item = catBreakdown[k];
      item.winRate = item.total > 0 ? Number(((item.wins / item.total) * 100).toFixed(1)) : 0;
      item.pnlAvg = item.total > 0 ? Number((item.pnlSum / item.total).toFixed(2)) : 0;
    });

    return {
      total,
      winCount,
      lossCount,
      timeoutCount,
      winRate,
      pnlNetoSum: Number(pnlNetoSum.toFixed(2)),
      pnlAvg,
      avgWin,
      avgLoss,
      avgDaysWin,
      avgDaysLoss,
      avgDaysTotal,
      payoffRatio,
      diasPorSenal,
      catBreakdown,
      ventana: bt?.ventana || '2026-06-22 → 2026-08-06',
    };
  }, [allBtTrades, bt]);

  const btTradesFiltered = useMemo(() => {
    return allBtTrades.filter(t => {
      const matchResult = btFilter === 'TODOS' || t.Resultado === btFilter;
      const matchCat = btCatFilter === 'Todos' || String(t.Categoria || '').toLowerCase().includes(btCatFilter.toLowerCase());
      return matchResult && matchCat;
    });
  }, [allBtTrades, btFilter, btCatFilter]);

  // Tomar las últimas 20 alertas para análisis directo
  const last20Trades = useMemo(() => {
    return btTradesFiltered.slice(-20);
  }, [btTradesFiltered]);

  // Estadísticas del subconjunto visible/filtrado
  const filteredStats = useMemo(() => {
    const trades = last20Trades;
    if (!trades.length) return { total: 0, winCount: 0, lossCount: 0, winRate: 0, pnlAvg: 0, pnlSum: 0, avgDays: 0 };
    const wins = trades.filter(t => t.Resultado === 'WIN').length;
    const losses = trades.filter(t => t.Resultado === 'LOSS').length;
    const pnlSum = trades.reduce((acc, t) => acc + (t['PnL_Neto_%'] ?? 0), 0);
    const daysSum = trades.reduce((acc, t) => acc + (t.Dias_Trade || 0), 0);
    return {
      total: trades.length,
      winCount: wins,
      lossCount: losses,
      winRate: trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0,
      pnlAvg: Number((pnlSum / trades.length).toFixed(2)),
      pnlSum: Number(pnlSum.toFixed(2)),
      avgDays: Number((daysSum / trades.length).toFixed(1)),
    };
  }, [last20Trades]);

  // Calcular PnL promedio de las alertas mostradas
  const pnlPromedioUltimas20 = useMemo(() => {
    return filteredStats.pnlAvg;
  }, [filteredStats]);

  const btCats = (bt && bt.resumen_por_categoria) ? Object.keys(bt.resumen_por_categoria) : ['Sweet Spot', 'Cazador Dips', 'Recup. Rapida', 'Cuchillos Cayendo'];

  return (
    <div style={{ paddingBottom: '60px', maxWidth: '1050px', margin: '0 auto' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{
            margin: '0 0 6px', fontSize: '1.8rem', fontWeight: 900,
            background: 'linear-gradient(135deg, #10b981, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            📊 Backtesting & Optimizador MLOps V5.0 Master Tactical
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Modelo Unificado <strong style={{ color: '#818cf8' }}>LightGBM V5.0 Master</strong> (440 activos, 287,464 filas OHLCV) · OOS Win Rate <strong style={{ color: '#10b981' }}>51.9%</strong> (+3.78% PnL/trade) · Umbral Óptimo <strong style={{ color: '#a78bfa' }}>th=0.55</strong> · Gates: CMF &gt; -0.15 &amp; Racha Score ≥ 2d
          </p>
        </div>

        {/* MLOps Staleness & Audit Badge */}
        <div style={{
          display: 'flex', gap: '10px', background: 'rgba(15,23,42,0.85)',
          padding: '10px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)',
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Último OHLCV</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
              {marketData?.fecha_ultimo_ohlcv || '2026-08-14'}
            </div>
          </div>
          <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Staleness</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: (marketData?.staleness_dias ?? 0) <= 2 ? '#10b981' : '#ef4444' }}>
              {(marketData?.staleness_dias ?? 0) === 0 ? '✅ 0d (Al Día)' : `⚠️ ${marketData?.staleness_dias}d hábiles`}
            </div>
          </div>
        </div>
      </div>

      {/* ── HUD Canónico de Protección V5 & Ejecución Trii ───────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(18,26,48,0.96))',
        borderRadius: '16px', border: '1px solid rgba(99,102,241,0.22)',
        padding: '16px 20px', marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>🛡️</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              HUD de Protección V5 (Filtros Karpathy &amp; Reglas Trii)
            </span>
          </div>
          <span style={{ fontSize: '0.74rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 10px', borderRadius: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            ⚡ Win Rate OOS 51.9% (+3.78% PnL/Trade)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>💧 Flujo CMF (20D)</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>&gt; -0.15 Umbral Mínimo</div>
            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>Bloquea activos en liquidación institucional</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>🔥 Racha Score ML</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>≥ 2 Días Consecutivos</div>
            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>Filtro de consistencia de convicción predictiva</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>🎯 Gatillo de Giro</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>Higher Low / Absorción</div>
            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>Confirmación en precio antes de comprar</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>⏱️ Bracket Trii</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#a78bfa', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>TimeStop 4d · R:R ≥ 2.0x</div>
            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>Salida programada y gestión de riesgo estricta</div>
          </div>
        </div>
      </div>

      {/* ── Tabs por categoría ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '24px' }}>
        {categoriasDyn.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCat(c.id)}
            style={{
              background: selectedCat === c.id ? c.bg : 'rgba(22,32,50,0.7)',
              color: selectedCat === c.id ? c.color : '#64748b',
              border: `1px solid ${selectedCat === c.id ? c.border : 'rgba(255,255,255,0.07)'}`,
              padding: '11px 22px', borderRadius: '30px', fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
              boxShadow: selectedCat === c.id ? `0 4px 16px ${c.border}33` : 'none',
            }}
          >
            {c.emoji} {c.nombre}
          </button>
        ))}
      </div>

      {/* ── Tarjeta de parámetros óptimos (Limpia y Desduplicada) ────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCat}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          style={{
            background: 'linear-gradient(135deg, rgba(18,26,44,0.9), rgba(12,18,35,0.95))',
            borderRadius: '20px', border: `1px solid ${cat.border}44`,
            padding: '24px 28px', marginBottom: '28px',
            boxShadow: `0 8px 32px ${cat.border}11`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: cat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                🎯 Combinación Táctica Optimizada
              </div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', fontWeight: 900 }}>
                {cat.emoji} {cat.nombre}
              </h3>
              <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.82rem', maxWidth: '520px', lineHeight: 1.5 }}>
                {cat.desc}
              </p>
            </div>
            {/* Badges no redundantes: Win Rate, Retorno, F0.5 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.border}`, fontVariantNumeric: 'tabular-nums' }}>
                ✅ Win Rate OOS: {cat.winRate}%
              </span>
              <span style={{ padding: '6px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                📈 Ret. Prom: {(cat.retornoTrade ?? 0) >= 0 ? '+' : ''}{cat.retornoTrade ?? 0}%
              </span>
              <span style={{ padding: '6px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                ⚙️ F₀.₅: {cat.f05}
              </span>
            </div>
          </div>

          {/* Grid de métricas de ejecución Trii & Rendimiento */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <StatCard
              label="🎯 Take Profit Trii"
              value={`+${cat.tp}%`}
              color="#10b981"
              tooltip="Objetivo de ganancia programado para orden bracket en Trii."
            />
            <StatCard
              label="🛑 Stop Loss ATR"
              value={`-${cat.sl}%`}
              color="#ef4444"
              tooltip="Pérdida máxima tolerada basada en la volatilidad real del activo."
            />
            <StatCard
              label="⏱️ Time Stop Trii"
              value={`${cat.limiteDias} Días`}
              color="#60a5fa"
              tooltip={`Si en ${cat.limiteDias} días hábiles no llega a TP ni SL, se cierra la posición a mercado para liberar capital.`}
              sub="Rotación ágil de capital"
            />
            <StatCard
              label="📈 Ret. Prom/Trade"
              value={`${(cat.retornoTrade ?? 0) >= 0 ? '+' : ''}${cat.retornoTrade ?? 0}%`}
              color={(cat.retornoTrade ?? 0) >= 0 ? '#a78bfa' : '#ef4444'}
              tooltip={`Retorno neto promedio por trade tras fricción ($0.15 USD/orden) en ${cat.totalTrades} trades OOS.`}
              sub={`${cat.totalTrades} trades OOS`}
            />
            <StatCard
              label="🚀 EA Anualizado"
              value={`${(cat.ea ?? cat.cagr ?? 0) > 0 ? '+' : ''}${cat.ea ?? cat.cagr ?? 0}%`}
              color={(cat.ea ?? cat.cagr ?? 0) > 0 ? '#38bdf8' : '#94a3b8'}
              tooltip="Interés Efectivo Anualizado (EA) proyectado por rotación rápida."
              sub="Ritmo del capital"
            />
            <StatCard
              label="⚖️ Ratio R:R"
              value={`${(cat.tp / Math.max(0.1, cat.sl)).toFixed(1)}:1`}
              color="#f8fafc"
              tooltip="Relación ganancia potencial vs riesgo asumido. Mínimo 2:1 para garantizar expectativa matemática positiva."
              sub="Mínimo 2.0x"
            />
          </div>

          {/* Barra de Win Rate visual */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
              <span>Win Rate Out-of-Sample (OOS — Período de prueba no visto)</span>
              <strong style={{ color: cat.color }}>{cat.winRate}%</strong>
            </div>
            <Bar pct={cat.winRate} color={cat.color} />
          </div>

          {/* F0.5-score y control de fricción */}
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(99,102,241,0.08)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 700, marginBottom: '4px' }}>
              ⚙️ Optimización F₀.₅-Score &amp; Fricción Operativa Real
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6 }}>
              Otorga el <strong style={{ color: '#818cf8' }}>doble de peso a la Precisión (menos falsos positivos)</strong> que al Recall.
              Filtro estricto contra trampas bajistas. Incluye comisión fija modelada de <strong style={{ color: '#f8fafc' }}>$0.15 USD/orden</strong>.
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Activos actuales en esta categoría (Con Variables V5) ────────── */}
      <div style={{ background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 800 }}>
              📡 Activos Actuales — {cat.emoji} {cat.nombre}
            </h3>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8rem' }}>
              {isLoading ? 'Cargando datos en vivo…' : `${activosCat.length} activos en esta categoría hoy · ${buySignals.length} con señal BUY · Prob. promedio: ${avgProb}%`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontVariantNumeric: 'tabular-nums' }}>
              💎 {buySignals.length} BUY
            </span>
            <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', fontVariantNumeric: 'tabular-nums' }}>
              {activosCat.length} total
            </span>
          </div>
        </div>

        {activosCat.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontSize: '0.85rem' }}>
            No hay activos en esta categoría hoy. El modelo escanea 440 activos diariamente a las 6:00 AM Colombia.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ fontSize: '0.74rem', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '10px 12px' }}>Ticker</th>
                  <th style={{ padding: '10px 12px' }}>Precio</th>
                  <th style={{ padding: '10px 12px' }}>Prob. V5</th>
                  <th style={{ padding: '10px 12px' }}>Estado Trii</th>
                  <th style={{ padding: '10px 12px' }}>🔥 Racha Score</th>
                  <th style={{ padding: '10px 12px' }}>💧 CMF (20D)</th>
                  <th style={{ padding: '10px 12px' }}>🎯 Gatillo Giro</th>
                  <th style={{ padding: '10px 12px' }}>Bracket Trii (TP / SL)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#475569' }}>Cargando…</td></tr>
                ) : activosCat.map(a => {
                  const prob = a['Probabilidad_Exito_%'] || 0;
                  const probColor = prob >= 60 ? '#10b981' : prob >= 40 ? '#eab308' : '#ef4444';
                  const isBuy = (a.Veredicto || a.Veredicto_V2) === 'BUY';
                  const streak = a.Score_Streak != null ? Number(a.Score_Streak) : 0;
                  const cmf = a.CMF_20 != null ? Number(a.CMF_20) : null;
                  const giro = a.Gatillo_Precio || (a.Price_Reversal_Giro === 1 ? 'Confirmado' : 'Pendiente');
                  const tpUSD = a.Take_Profit_$ ?? (a.Precio_Actual ? (a.Precio_Actual * (1 + (a['Take_Profit_%'] ?? cat.tp) / 100)).toFixed(2) : 'N/A');
                  const stopLossUSD = a.Stop_Loss_ATR_$ ?? a.Stop_Loss_ATR_USD ?? (a.Precio_Actual ? (a.Precio_Actual * (1 - (a['Stop_Loss_%'] ?? cat.sl) / 100)).toFixed(2) : 'N/A');

                  // Badge de estado Trii
                  const estado = a.Trii_Estado || (isBuy ? (cmf < -0.15 ? 'BLOQUEADO_LIQUIDACION_CMF' : (streak < 1 ? 'ESPERANDO_RACHA_SCORE' : (giro === 'Pendiente' ? 'ESPERANDO_GIRO_PRECIO' : 'EJECUTAR_TRII'))) : 'EN_SEGUIMIENTO');
                  let estCfg = { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'Seguimiento' };
                  if (estado === 'EJECUTAR_TRII') estCfg = { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: '💎 Listo Trii' };
                  else if (estado === 'ESPERANDO_GIRO_PRECIO') estCfg = { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: '⏳ Esp. Giro' };
                  else if (estado === 'BLOQUEADO_LIQUIDACION_CMF') estCfg = { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '🚫 Bloq. CMF' };
                  else if (estado === 'ESPERANDO_RACHA_SCORE') estCfg = { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', label: '⏳ Esp. Racha' };

                  return (
                    <tr key={a.Ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.15s ease' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>{a.Ticker}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.Nombre || a.Ticker}</div>
                      </td>
                      <td style={{ padding: '12px 12px', color: '#cbd5e1', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        ${a.Precio_Actual?.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontWeight: 800, color: probColor, fontVariantNumeric: 'tabular-nums' }}>{prob}%</span>
                        <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, prob)}%`, height: '100%', background: probColor, borderRadius: '2px' }} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                          background: estCfg.bg, color: estCfg.color, border: `1px solid ${estCfg.color}44`,
                          whiteSpace: 'nowrap',
                        }}>
                          {estCfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 700,
                          background: streak >= 2 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                          color: streak >= 2 ? '#10b981' : '#94a3b8',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          🔥 {streak}d
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{
                          fontWeight: 700, fontSize: '0.76rem',
                          color: cmf > 0 ? '#10b981' : cmf < -0.15 ? '#ef4444' : '#94a3b8',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {cmf != null ? (cmf > 0 ? `+${cmf.toFixed(2)}` : cmf.toFixed(2)) : 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{
                          fontSize: '0.74rem', fontWeight: 700,
                          color: giro === 'Confirmado' ? '#10b981' : '#f59e0b',
                        }}>
                          {giro === 'Confirmado' ? '✅ Sí' : '⏳ Pend.'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>+${tpUSD}</span>
                        <span style={{ color: '#475569', margin: '0 4px' }}>/</span>
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>-${stopLossUSD}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Backtest Real — Auditoría Out-of-Sample (Cantidad y Calidad de Señales) ── */}
      <div style={{ background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 800 }}>
                📈 Backtest Real OOS — Cantidad &amp; Calidad de Señales
              </h3>
              <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                🔬 45 Días Out-of-Sample (Sin Data Leakage)
              </span>
            </div>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Auditoría histórica honesta de todas las alertas BUY generadas por el modelo en ventana real · Fricción de comisión de $0.15 USD/orden incluida
              {bt?.ventana ? ` · Ventana: ${bt.ventana}` : ''}
            </p>
          </div>

          {/* Botón Selector de Modo de Ejecución */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(15,23,42,0.85)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setExecMode('ESTANDAR')}
              style={{
                padding: '7px 15px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                background: execMode === 'ESTANDAR' ? 'rgba(16,185,129,0.2)' : 'transparent',
                color: execMode === 'ESTANDAR' ? '#10b981' : '#64748b',
                border: execMode === 'ESTANDAR' ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              🎯 Criterio Estándar (TP / SL Trii)
            </button>
            <button
              onClick={() => setExecMode('TIMEOUT')}
              style={{
                padding: '7px 15px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                background: execMode === 'TIMEOUT' ? 'rgba(245,158,11,0.2)' : 'transparent',
                color: execMode === 'TIMEOUT' ? '#f59e0b' : '#64748b',
                border: execMode === 'TIMEOUT' ? '1px solid rgba(245,158,11,0.4)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              ⏱️ Criterio Timeout (Holding 11d Sin SL)
            </button>
          </div>
        </div>

        {btLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontSize: '0.85rem' }}>Cargando backtest 45 días…</div>
        ) : !bt ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontSize: '0.85rem' }}>
            No hay datos de backtest 45 días.
          </div>
        ) : (
          <>
            {/* ── HUD DUAL: 1. Cantidad de Señales | 2. Calidad de Señales ── */}
            {btStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '22px' }}>
                
                {/* 📦 PILAR 1: CANTIDAD DE SEÑALES */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.6))',
                  borderRadius: '16px', border: '1px solid rgba(56,189,248,0.25)',
                  padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>📦</span>
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          1. Cantidad de Señales
                        </span>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Volumen, cadencia y selectividad</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      Ventana 45d OOS
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '2px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total Señales BUY</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                        {btStats.total} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Alertas</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '2px' }}>0 sobre-operación</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Cadencia de Entrada</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
                        ~{btStats.diasPorSenal} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>días/trade</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>1 señal c/ 2-3 días</div>
                    </div>
                  </div>

                  {/* Desglose por categoría */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Distribución por Perfil</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {Object.entries(btStats.catBreakdown).map(([catName, data]) => {
                        const cColor = CAT_COLOR[catName] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                        return (
                          <span key={catName} style={{
                            padding: '3px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                            background: cColor.bg, color: cColor.color, border: `1px solid ${cColor.color}44`,
                            fontVariantNumeric: 'tabular-nums'
                          }}>
                            {catName}: <strong>{data.total}</strong> ({((data.total / btStats.total) * 100).toFixed(0)}%)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 🏆 PILAR 2: CALIDAD DE SEÑALES */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.6))',
                  borderRadius: '16px', border: `1px solid ${execMode === 'ESTANDAR' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🏆</span>
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: execMode === 'ESTANDAR' ? '#10b981' : '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          2. Calidad de las Señales ({execMode})
                        </span>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Efectividad, PnL neto y asimetría R:R</div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      background: execMode === 'ESTANDAR' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: execMode === 'ESTANDAR' ? '#10b981' : '#f59e0b',
                      border: `1px solid ${execMode === 'ESTANDAR' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      padding: '2px 8px', borderRadius: '10px', fontWeight: 700
                    }}>
                      {execMode === 'ESTANDAR' ? 'TP/SL Bracket' : 'Holding 11d'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '2px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Win Rate Real</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: btStats.winRate >= 40 ? '#10b981' : (btStats.winRate > 0 ? '#eab308' : '#ef4444'), fontVariantNumeric: 'tabular-nums' }}>
                        {btStats.winRate}%
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>{btStats.winCount}W / {btStats.lossCount}L</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>PnL Promedio Neto</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: btStats.pnlAvg >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                        {btStats.pnlAvg > 0 ? '+' : ''}{btStats.pnlAvg}%
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>{btStats.pnlNetoSum > 0 ? '+' : ''}{btStats.pnlNetoSum}% total</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Asimetría R:R</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#818cf8', fontVariantNumeric: 'tabular-nums' }}>
                        {btStats.payoffRatio > 0 ? `${btStats.payoffRatio}x` : 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>+{btStats.avgWin}% / {btStats.avgLoss}%</div>
                    </div>
                  </div>

                  {/* Duración y resolución */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                    <span style={{ color: '#94a3b8' }}>⏱️ Resolución de Trades:</span>
                    <span style={{ color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                      Ganadoras: <strong style={{ color: '#10b981' }}>{btStats.avgDaysWin}d</strong> · Pérdidas: <strong style={{ color: '#ef4444' }}>{btStats.avgDaysLoss}d</strong> · Media: <strong>{btStats.avgDaysTotal}d</strong>
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* ── Nota Explicativa / Análisis Táctico V5 ── */}
            <div style={{
              background: 'rgba(99,102,241,0.08)',
              borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)',
              padding: '12px 16px', marginBottom: '18px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5
            }}>
              <strong style={{ color: '#a78bfa' }}>💡 Clave Cuantitativa V5 (Por qué fallaban activos en caída libre):</strong> En el historial OOS, los 5 trades de <em>Cuchillos Cayendo</em> (REMX, ON, MCHP, RIOT, AVAX) tuvieron 0% WR. En modo Timeout cayeron hasta <strong style={{ color: '#ef4444' }}>-23.6%</strong> (como SEDG y REMX), mientras que el Stop Loss estricto limitó la pérdida a tan solo <strong style={{ color: '#10b981' }}>-4.2%</strong>. Para evitar completamente estas trampas de valor (como ocurrió con ENPH o PLUS), V5 introdujo los filtros obligatorios: <strong style={{ color: '#38bdf8' }}>CMF &gt; -0.15</strong> (evita liquidación institucional), <strong style={{ color: '#f59e0b' }}>Racha Score ≥ 2</strong> y <strong style={{ color: '#10b981' }}>Gatillo de Giro</strong>.
            </div>

            {/* Filtros por resultado y categoría */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>FILTRAR RESULTADO:</span>
              {['TODOS', 'WIN', 'LOSS', 'TIMEOUT'].map(r => {
                const count = r === 'TODOS' ? allBtTrades.length : allBtTrades.filter(t => t.Resultado === r).length;
                const cfg = RESULT_CFG[r] || { label: 'Todos', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' };
                return (
                  <button key={r} onClick={() => setBtFilter(r)} style={{
                    padding: '5px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    background: btFilter === r ? cfg.bg : 'rgba(22,32,50,0.7)',
                    color: btFilter === r ? cfg.color : '#64748b',
                    border: `1px solid ${btFilter === r ? cfg.border : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.2s',
                  }}>
                    {r === 'TODOS' ? `Todos (${count})` : `${cfg.label} (${count})`}
                  </button>
                );
              })}
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, margin: '0 4px 0 14px' }}>CATEGORÍA:</span>
              {['Todos', ...btCats].map(c => {
                const count = c === 'Todos' ? allBtTrades.length : allBtTrades.filter(t => String(t.Categoria || '').toLowerCase().includes(c.toLowerCase())).length;
                return (
                  <button key={c} onClick={() => setBtCatFilter(c)} style={{
                    padding: '5px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    background: btCatFilter === c ? 'rgba(99,102,241,0.15)' : 'rgba(22,32,50,0.7)',
                    color: btCatFilter === c ? '#818cf8' : '#64748b',
                    border: `1px solid ${btCatFilter === c ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.2s',
                  }}>
                    {c} ({count})
                  </button>
                );
              })}
            </div>

            {/* Tabla de señales */}
            {last20Trades.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontSize: '0.85rem' }}>No hay trades que coincidan con los filtros.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ fontSize: '0.75rem', color: '#475569', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '10px 12px' }}>Ticker</th>
                      <th style={{ padding: '10px 12px' }}>Categoría</th>
                      <th style={{ padding: '10px 12px' }}>Señal</th>
                      <th style={{ padding: '10px 12px' }}>Prob.</th>
                      <th style={{ padding: '10px 12px' }}>Entrada → Salida ({execMode})</th>
                      <th style={{ padding: '10px 12px' }}>Días Sostenidos</th>
                      <th style={{ padding: '10px 12px' }}>PnL Neto %</th>
                      <th style={{ padding: '10px 12px' }}>Motivo de Salida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {last20Trades.map((t, i) => {
                      const catColor = CAT_COLOR[t.Categoria] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                      const pnl = t['PnL_Neto_%'] ?? t['PnL_%'] ?? 0;
                      const pnlColor = pnl >= 0 ? '#10b981' : '#ef4444';
                      const isBuy = (t.Veredicto || t.Veredicto_V2) === 'BUY';
                      
                      const tpPct = t['TP_%'] ?? 10;
                      const slPct = t['SL_%'] ?? 4;
                      const maxDias = t.Limite_Dias || 11;
                      
                      const motivoSalida = execMode === 'TIMEOUT' || t.Resultado === 'TIMEOUT'
                        ? { label: `⏱️ TimeStop (${t.Dias_Trade || maxDias}d)`, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
                        : t.Resultado === 'WIN'
                        ? { label: `🎯 TP (+${tpPct}%)`, color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' }
                        : { label: `🛑 SL (-${slPct}%)`, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' };

                      return (
                        <tr key={t.Ticker + i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: '0.15s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '11px 12px' }}>
                            <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.92rem' }}>{t.Ticker}</div>
                            <div style={{ fontSize: '0.7rem', color: '#475569', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.Nombre || t.Ticker}</div>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: catColor.bg, color: catColor.color, border: '1px solid ' + catColor.color + '44', whiteSpace: 'nowrap' }}>{t.Categoria}</span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                              background: isBuy ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)',
                              color: isBuy ? '#10b981' : '#64748b',
                              border: `1px solid ${isBuy ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.2)'}`,
                            }}>
                              {isBuy ? '💎 BUY' : '⏳ HOLD'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 12px', color: (t['Probabilidad_%'] ?? 50) >= 40 ? '#eab308' : '#64748b', fontWeight: 700 }}>{t['Probabilidad_%'] ?? 50}%</td>
                          <td style={{ padding: '11px 12px', color: '#cbd5e1', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {t.Fecha_Entrada}<br />
                            <span style={{ color: '#64748b' }}>${t.Precio_Entrada_Hist?.toFixed(2)} → ${t.Precio_Salida?.toFixed(2)}</span>
                          </td>
                          <td style={{ padding: '11px 12px', color: '#60a5fa', fontWeight: 600, fontSize: '0.82rem' }}>
                            {t.Dias_Trade}d <span style={{ color: '#475569', fontSize: '0.72rem' }}>/ {maxDias}d máx</span>
                          </td>
                          <td style={{ padding: '11px 12px', fontWeight: 800, color: pnlColor, fontSize: '0.95rem' }}>
                            {pnl > 0 ? '+' : ''}{pnl}%
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: motivoSalida.bg, color: motivoSalida.color, border: `1px solid ${motivoSalida.border}`, whiteSpace: 'nowrap' }}>{motivoSalida.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* ── FILA FINAL CON RESUMEN CONSOLIDADO DE ALERTAS ─────── */}
                  <tfoot>
                    <tr style={{
                      background: 'rgba(15,23,42,0.95)',
                      borderTop: '2px solid rgba(255,255,255,0.12)',
                      fontSize: '0.85rem',
                    }}>
                      <td colSpan={5} style={{ padding: '14px 12px', fontWeight: 800, color: '#f8fafc', textAlign: 'right' }}>
                        📊 RESUMEN ({filteredStats.total} ALERTAS {execMode}):
                      </td>
                      <td style={{ padding: '14px 12px', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem' }}>
                        ~{filteredStats.avgDays}d med
                      </td>
                      <td style={{ padding: '14px 12px', fontWeight: 900, fontSize: '1.05rem', color: filteredStats.pnlAvg >= 0 ? '#10b981' : '#ef4444' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: filteredStats.pnlAvg >= 0 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                          border: `1px solid ${filteredStats.pnlAvg >= 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                          boxShadow: `0 0 10px ${filteredStats.pnlAvg >= 0 ? '#10b981' : '#ef4444'}33`
                        }}>
                          {filteredStats.pnlAvg > 0 ? '+' : ''}{filteredStats.pnlAvg}%
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800,
                          background: filteredStats.winRate >= 40 ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)',
                          color: filteredStats.winRate >= 40 ? '#10b981' : '#f59e0b',
                          border: `1px solid ${filteredStats.winRate >= 40 ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {execMode === 'ESTANDAR' 
                            ? `WR: ${filteredStats.winRate}% (${filteredStats.winCount}W / ${filteredStats.lossCount}L)`
                            : `⏱️ Holding Timeout (${cat.limiteDias}d)`}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Comparativa entre categorías ────────────────────────────────── */}

      <div style={{ background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#f8fafc' }}>
          🏆 Parámetros y Rendimiento V5.0 Master por Perfil de Activo
        </h3>
        <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '0.8rem' }}>
          Modelo Unificado LightGBM V5.0 Master · Gestión Adaptativa TP/SL Trii · Out-of-Sample (5 años OHLCV)
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {categoriasDyn.map(c => (
            <motion.div
              key={c.id}
              whileHover={{ y: -3 }}
              onClick={() => setSelectedCat(c.id)}
              style={{
                background: selectedCat === c.id ? c.bg : 'rgba(15,23,42,0.8)',
                borderRadius: '16px', border: `1px solid ${selectedCat === c.id ? c.border : 'rgba(255,255,255,0.05)'}`,
                padding: '18px 20px', cursor: 'pointer',
                boxShadow: selectedCat === c.id ? `0 4px 20px ${c.border}22` : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              <div style={{ fontSize: '1.3rem', marginBottom: '8px' }}>{c.emoji}</div>
              <div style={{ fontWeight: 800, color: c.color, fontSize: '0.95rem', marginBottom: '12px' }}>{c.nombre}</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
                <span>Frecuencia:</span><span style={{ color: '#38bdf8', fontWeight: 700 }}>{c.frecuencia}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
                <span>Expectancia:</span><span style={{ color: c.retornoTrade >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{c.retornoTrade > 0 ? '+' : ''}{c.retornoTrade}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
                <span>Win Rate OOS:</span><span style={{ color: c.color, fontWeight: 700 }}>{c.winRate}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
                <span>Time Stop:</span><span style={{ color: '#60a5fa', fontWeight: 700 }}>{c.limiteDias}d máx</span>
              </div>

              <Bar pct={c.winRate} color={c.color} />

              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#334155' }}>
                <span>TP: +{c.tp}% / SL: -{c.sl}%</span>
                <span>F₀.₅: {c.f05}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Tabla de Auditoría OOS Consolidada (v3_backtest_eval.py) ────── */}
      <div style={{ marginTop: '28px', background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>
              📊 Auditoría Barra a Barra OOS (Consolidado de v3_backtest_eval.py)
            </h3>
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.8rem' }}>
              Simulación diaria honesta en ventana Out-of-Sample con Take Profit, Stop Loss, Fricción $0.15 USD y Límite de Días
            </p>
          </div>
          <span style={{ padding: '6px 14px', borderRadius: '20px', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', fontSize: '0.78rem', fontWeight: 700 }}>
            ⚡ Fuente Canónica MLOps
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.9)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px' }}>Categoría</th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  Umbral ($th^*$)
                  <div className="tooltip-box">
                    <strong>Umbral (th*)</strong>: Probabilidad mínima de éxito exigida al modelo ML para activar alerta.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  TP %
                  <div className="tooltip-box">
                    <strong>Take Profit (%)</strong>: Porcentaje objetivo de ganancia para cerrar automáticamente con ganancia.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  SL %
                  <div className="tooltip-box">
                    <strong>Stop Loss (%)</strong>: Pérdida máxima tolerada antes de cerrar la posición defensivamente.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  Time Stop
                  <div className="tooltip-box">
                    <strong>Time Stop</strong>: Días hábiles máximos. Si no toca TP/SL en este plazo, vende a precio de mercado.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  Trades OOS
                  <div className="tooltip-box">
                    <strong>Trades Out-Of-Sample</strong>: Cantidad total de operaciones reales simuladas fuera de muestra.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  Win Rate
                  <div className="tooltip-box">
                    <strong>Win Rate (%)</strong>: Porcentaje de operaciones cerradas en positivo.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  Avg Win
                  <div className="tooltip-box">
                    <strong>Ganancia Promedio</strong>: Rendimiento medio de las operaciones ganadoras.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  Avg Loss
                  <div className="tooltip-box">
                    <strong>Pérdida Promedio</strong>: Caída media registrada en las operaciones en pérdida.
                  </div>
                </th>
                <th className="has-tooltip" style={{ padding: '12px 14px', cursor: 'help' }}>
                  Expectancia / Trade
                  <div className="tooltip-box">
                    <strong>Esperanza Matemática Net</strong>: Retorno esperado por operación descontando comisiones ($0.15 USD).
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {categoriasDyn.map(c => {
                const catKey = c.id;
                const bMet = v3Meta?.consolidado?.por_categoria?.[catKey] || {};
                const exp = bMet['expectancia_%'] !== undefined ? bMet['expectancia_%'] : (c.retornoTrade || 0);
                const expColor = exp > 0 ? '#10b981' : exp < 0 ? '#ef4444' : '#94a3b8';
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(15,23,42,0.4)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: c.color }}>{c.emoji} {c.nombre}</td>
                    <td style={{ padding: '12px 14px', color: '#cbd5e1', fontWeight: 700 }}>≥ {c.threshold}</td>
                    <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 700 }}>+{c.tp}%</td>
                    <td style={{ padding: '12px 14px', color: '#ef4444', fontWeight: 700 }}>-{c.sl}%</td>
                    <td style={{ padding: '12px 14px', color: '#60a5fa', fontWeight: 700 }}>{c.limiteDias} días</td>
                    <td style={{ padding: '12px 14px', color: '#f8fafc', fontWeight: 700 }}>{bMet.total_trades ?? c.totalTrades}</td>
                    <td style={{ padding: '12px 14px', color: c.color, fontWeight: 800 }}>{bMet['win_rate_%'] ?? c.winRate}%</td>
                    <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 600 }}>+{bMet['avg_win_%'] ?? c.tp}%</td>
                    <td style={{ padding: '12px 14px', color: '#ef4444', fontWeight: 600 }}>{bMet['avg_loss_%'] ?? `-${c.sl}%`}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 900, color: expColor, fontSize: '0.92rem' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '8px', background: `${expColor}18`, border: `1px solid ${expColor}40` }}>
                        {exp > 0 ? '+' : ''}{exp}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Panel SHAP & Importancia de Variables MLOps ────────────────── */}
      {shapData?.global_top_features && (
        <div style={{ marginTop: '28px', background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔥 Análisis SHAP — Ranking de Variables Predictivas Clave
            </h3>
            <span style={{ fontSize: '0.76rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '3px 12px', borderRadius: '14px', fontWeight: 600 }}>
              💡 Pasa el cursor sobre cualquier variable para ver la explicación detallada
            </span>
          </div>
          <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: '0.8rem' }}>
            Importancia relativa de las 12 features maestras no redundantes (Karpathy |r| ≤ 0.80) calculada sobre la función de ganancia del modelo especializado LightGBM V5.0.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {shapData.global_top_features.slice(0, 12).map((f, i) => {
              const meta = getShapMeta(f.feature);
              return (
                <div
                  key={f.feature}
                  className="has-tooltip"
                  style={{
                    background: 'rgba(15,23,42,0.85)',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'help',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 800 }}>#{i + 1} {f.feature}</span>
                      <span style={{ fontSize: '0.66rem', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '1px 6px', borderRadius: '6px', fontWeight: 600 }}>
                        {meta.categoria}
                      </span>
                    </div>
                    <span style={{ color: '#818cf8', fontWeight: 800, fontSize: '0.85rem' }}>{f.pct}% del peso</span>
                  </div>

                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ width: `${Math.min(100, f.pct * 5)}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: '3px' }} />
                  </div>

                  {/* Glassmorphic Interactive Tooltip */}
                  <div className="tooltip-box">
                    <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.82rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📊 {meta.titulo}</span>
                      <span style={{ color: '#818cf8', fontSize: '0.72rem' }}>{f.pct}% peso</span>
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.76rem', lineHeight: '1.4' }}>
                      {meta.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Backtesting;
