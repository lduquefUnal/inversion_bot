import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarketData } from '../hooks/useMarketData';
import { CATEGORY_PARAMS } from '../lib/strategies';

// ─── Configuración Base de Categorías V3.7 ──────────────────────────────────
const COLOR_MAP = {
  verde:  { color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: '#10b981' },
  yellow: { color: '#eab308', bg: 'rgba(234,179,8,0.15)', border: '#eab308' },
  red:    { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: '#ef4444' },
  gray:   { color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', border: '#64748b' },
};

const DEFAULT_CATEGORIAS = Object.values(CATEGORY_PARAMS).map(p => ({
  id: p.catNombre,
  emoji: p.emoji,
  nombre: p.id,
  tp: p.tpPct,
  sl: p.slPct,
  limiteDias: p.maxDays,
  confirmacion: parseInt(p.confirmacion),
  winRate: p.winRateNum,
  retornoTrade: parseFloat(p.retornoTrade),
  totalTrades: p.totalTrades,
  cagr: parseFloat(p.cagr),
  ea: parseFloat(p.cagr),
  frecuencia: `1 trade c/ ${(30 / (p.totalTrades / 12)).toFixed(1)} días`,
  color: COLOR_MAP[p.type].color,
  bg: COLOR_MAP[p.type].bg,
  border: COLOR_MAP[p.type].border,
  desc: p.descripcion,
  f05: p.f05,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = '#f8fafc', bg = 'rgba(15,23,42,0.8)', tooltip, sub }) => (
  <div title={tooltip || ''} style={{
    background: bg, padding: '18px 20px', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)', cursor: tooltip ? 'help' : 'default',
  }}>
    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{value}</div>
    {sub && <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '3px' }}>{sub}</div>}
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

  const [execMode, setExecMode] = useState('TIMEOUT'); // 'TIMEOUT' (default) | 'ESTANDAR'

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
          PnL_Neto_%: pnlNeto,
        };
      }
      return t;
    });
  }, [bt, execMode]);

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

  // Calcular PnL promedio de las alertas mostradas
  const pnlPromedioUltimas20 = useMemo(() => {
    if (!last20Trades.length) return 0;
    const sum = last20Trades.reduce((acc, t) => acc + (t['PnL_Neto_%'] ?? 0), 0);
    return Number((sum / last20Trades.length).toFixed(2));
  }, [last20Trades]);

  const btCats = (bt && bt.resumen_por_categoria) ? Object.keys(bt.resumen_por_categoria) : ['Sweet Spot', 'Cazador Dips', 'Recup. Rapida', 'Cuchillos Cayendo'];

  return (
    <div style={{ paddingBottom: '60px', maxWidth: '1050px', margin: '0 auto' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{
          margin: '0 0 6px', fontSize: '1.8rem',
          background: 'linear-gradient(135deg, #10b981, #60a5fa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          📊 Backtesting & Optimizador MLOps V3.7
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
          Parámetros óptimos por categoría · 4 Modelos <strong style={{ color: '#818cf8' }}>LightGBM V3.7 Especializados</strong> (227 activos, 79,935 muestras, 5 años) · Métrica: <strong style={{ color: '#a78bfa' }}>F₀.₅-Score</strong>
        </p>
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
              transition: 'all 0.2s',
              boxShadow: selectedCat === c.id ? `0 4px 16px ${c.border}33` : 'none',
            }}
          >
            {c.emoji} {c.nombre}
          </button>
        ))}
      </div>

      {/* ── Tarjeta de parámetros óptimos ──────────────────────────────── */}
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
                🎯 Combinación Óptima — F₀.₅-Score: {cat.f05}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc' }}>
                {cat.emoji} {cat.nombre}
              </h3>
              <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.82rem', maxWidth: '500px', lineHeight: 1.5 }}>
                {cat.desc}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.border}` }}>
                ✅ Win Rate: {cat.winRate}%
              </span>
              <span style={{ padding: '6px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                F₀.₅: {cat.f05}
              </span>
            </div>
          </div>

          {/* Grid de métricas principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <StatCard
              label="🎯 Take Profit"
              value={`+${cat.tp}%`}
              color="#10b981"
              tooltip="Objetivo de ganancia por trade. Al llegar aquí, se cierra la posición automáticamente."
            />
            <StatCard
              label="🛑 Stop Loss"
              value={`-${cat.sl}%`}
              color="#ef4444"
              tooltip="Pérdida máxima tolerada. Si el precio cae este %, se cierra la posición."
            />
            <StatCard
              label="⏱️ Time Stop (máx)"
              value={`${cat.limiteDias} Días`}
              color="#60a5fa"
              tooltip={`Si en ${cat.limiteDias} días no llega al TP ni al SL, se cierra al precio de mercado para liberar el capital. Evita que el dinero quede estancado en trades laterales.`}
              sub="Libera capital si no hay resolución"
            />
            <StatCard
              label="📅 Confirmación"
              value={`${cat.confirmacion ?? 1} Día${(cat.confirmacion ?? 1) > 1 ? 's' : ''}`}
              color="#f59e0b"
              tooltip="Días consecutivos en zona de dip para confirmar la entrada (filtro anti-ruido)."
              sub="Filtro anti-ruido"
            />
            <StatCard
              label="📈 Ret. Prom/Trade"
              value={`${(cat.retornoTrade ?? 0) >= 0 ? '+' : ''}${cat.retornoTrade ?? 0}%`}
              color={(cat.retornoTrade ?? 0) >= 0 ? '#a78bfa' : '#ef4444'}
              tooltip={`Retorno neto promedio por trade después de fricción ($0.15 USD/orden). Calculado en ${cat.totalTrades} trades OOS.`}
              sub={`${cat.totalTrades} trades OOS`}
            />
            <StatCard
              label="🚀 EA Anualizado"
              value={`${(cat.ea ?? cat.cagr ?? 0) > 0 ? '+' : ''}${cat.ea ?? cat.cagr ?? 0}%`}
              color={(cat.ea ?? cat.cagr ?? 0) > 0 ? '#38bdf8' : '#94a3b8'}
              tooltip="Interés Efectivo Anualizado (EA) basado en la tasa de victorias y velocidad de rotación."
              sub="Ritmo del capital"
            />
          </div>

          {/* Barra de Win Rate visual */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
              <span>Win Rate OOS (Out-of-Sample, datos no vistos por el modelo)</span>
              <span style={{ color: cat.color, fontWeight: 700 }}>{cat.winRate}%</span>
            </div>
            <Bar pct={cat.winRate} color={cat.color} />
          </div>

          {/* F0.5-score explicación */}
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(99,102,241,0.08)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 700, marginBottom: '4px' }}>
              ⚙️ Métrica de Optimización: F₀.₅-Score
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
              Da el <strong style={{ color: '#818cf8' }}>doble de peso a la Precisión (menos falsos positivos)</strong> que al Recall.
              En trading significa: preferimos confirmar solo los mejores setups aunque dejemos pasar algunos,
              antes que entrar en todos y acumular pérdidas. Fricción fija: <strong style={{ color: '#94a3b8' }}>$0.15 USD/orden</strong>.
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Activos actuales en esta categoría ──────────────────────────── */}
      <div style={{ background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>
              📡 Activos Actuales — {cat.emoji} {cat.nombre}
            </h3>
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.8rem' }}>
              {isLoading ? 'Cargando datos en vivo…' : `${activosCat.length} activos en esta categoría hoy · ${buySignals.length} con señal BUY · Prob. promedio: ${avgProb}%`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
              💎 {buySignals.length} BUY
            </span>
            <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
              {activosCat.length} total
            </span>
          </div>
        </div>

        {activosCat.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#334155', fontSize: '0.85rem' }}>
            No hay activos en esta categoría hoy. El modelo escanea 59 activos diariamente a las 6:00 AM Colombia.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ fontSize: '0.75rem', color: '#475569', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '10px 14px' }}>Ticker</th>
                  <th style={{ padding: '10px 14px' }}>Precio</th>
                  <th style={{ padding: '10px 14px' }}>Prob. Éxito</th>
                  <th style={{ padding: '10px 14px' }}>Veredicto</th>
                  <th style={{ padding: '10px 14px' }}>Take Profit $</th>
                  <th style={{ padding: '10px 14px' }}>Stop Loss ATR</th>
                  <th style={{ padding: '10px 14px' }}>RSI 14D</th>
                  <th style={{ padding: '10px 14px' }}>Drawdown 52W</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#475569' }}>Cargando…</td></tr>
                ) : activosCat.map(a => {
                  const prob = a['Probabilidad_Exito_%'] || 0;
                  const probColor = prob >= 60 ? '#10b981' : prob >= 40 ? '#eab308' : '#ef4444';
                  const isBuy = (a.Veredicto || a.Veredicto_V2) === 'BUY';
                  const tpUSD = a.Take_Profit_$ ?? (a.Precio_Actual ? (a.Precio_Actual * 1.10).toFixed(2) : 'N/A');
                  const stopLossUSD = a.Stop_Loss_ATR_$ ?? a.Stop_Loss_ATR_USD ?? (a.Precio_Actual ? (a.Precio_Actual * 0.96).toFixed(2) : 'N/A');
                  return (
                    <tr key={a.Ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: '0.15s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>{a.Ticker}</td>
                      <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>${a.Precio_Actual?.toFixed(2)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: 700, color: probColor }}>{prob}%</span>
                        <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, prob)}%`, height: '100%', background: probColor, borderRadius: '2px' }} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                          background: isBuy ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)',
                          color: isBuy ? '#10b981' : '#64748b',
                          border: `1px solid ${isBuy ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.2)'}`,
                        }}>
                          {a.Emoji || (isBuy ? '💎' : '⏳')} {a.Veredicto || a.Veredicto_V2}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 700 }}>${tpUSD}</td>
                      <td style={{ padding: '12px 14px', color: '#ef4444', fontWeight: 600 }}>${stopLossUSD}</td>
                      <td style={{ padding: '12px 14px', color: Number(a.RSI_14D) < 30 ? '#10b981' : Number(a.RSI_14D) > 70 ? '#ef4444' : '#eab308', fontWeight: 600 }}>{a.RSI_14D}</td>
                      <td style={{ padding: '12px 14px', color: Math.abs(a['Drawdown_52W_%'] || 0) > 40 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{a['Drawdown_52W_%']}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Backtest Real — Criterio Timeout & Alertas ─────────────────── */}
      <div style={{ background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>
                📈 Backtest Real — Últimas 20 Alertas (Criterio Timeout)
              </h3>
              <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                ⏱️ Reacción 12-24h (Holding Completo)
              </span>
            </div>
            <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '0.8rem' }}>
              Evaluación sosteniendo la posición durante el TimeStop completo ({cat.limiteDias} días) adaptado a ejecución manual · Fricción $0.15 USD/orden
              {bt?.ventana ? ` · Ventana: ${bt.ventana}` : ''}
            </p>
          </div>

          {/* Botón Selector de Modo de Ejecución */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(15,23,42,0.8)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setExecMode('TIMEOUT')}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                background: execMode === 'TIMEOUT' ? 'rgba(245,158,11,0.2)' : 'transparent',
                color: execMode === 'TIMEOUT' ? '#f59e0b' : '#64748b',
                border: execMode === 'TIMEOUT' ? '1px solid rgba(245,158,11,0.4)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              ⏱️ Criterio Timeout (Holding 100%)
            </button>
            <button
              onClick={() => setExecMode('ESTANDAR')}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                background: execMode === 'ESTANDAR' ? 'rgba(16,185,129,0.2)' : 'transparent',
                color: execMode === 'ESTANDAR' ? '#10b981' : '#64748b',
                border: execMode === 'ESTANDAR' ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              🎯 Criterio Estándar (TP/SL)
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
            {/* Métricas globales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <StatCard label="Alertas Mostradas" value={last20Trades.length} color="#94a3b8" sub={`Últimas 20 del historial`} />
              <StatCard
                label="Criterio Salida"
                value={execMode === 'TIMEOUT' ? '⏱️ Timeout (11d)' : '🎯 TP / SL'}
                color={execMode === 'TIMEOUT' ? '#f59e0b' : '#10b981'}
                tooltip={execMode === 'TIMEOUT' ? 'Sostener posición hasta TimeStop de 11 días sin salir anticipadamente' : 'Cierre inmediato al tocar TP o SL'}
              />
              <StatCard
                label="PnL Promedio (Últimas 20)"
                value={`${pnlPromedioUltimas20 > 0 ? '+' : ''}${pnlPromedioUltimas20}%`}
                color={pnlPromedioUltimas20 >= 0 ? '#10b981' : '#ef4444'}
                tooltip="Promedio neto de ganancia/pérdida de las 20 últimas alertas bajo este criterio"
                sub="Promedio de la columna PnL"
              />
              <StatCard
                label="Tiempo de Reacción"
                value="12 - 24 Hours"
                color="#60a5fa"
                tooltip="Modo de ejecución manual sin requerir monitoreo continuo"
                sub="Operativa Manual"
              />
            </div>

            {/* Filtros por resultado y categoría */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>RESULTADO:</span>
              {['TODOS', 'WIN', 'LOSS', 'TIMEOUT'].map(r => {
                const cfg = RESULT_CFG[r] || { label: 'Todos', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' };
                return (
                  <button key={r} onClick={() => setBtFilter(r)} style={{
                    padding: '5px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    background: btFilter === r ? cfg.bg : 'rgba(22,32,50,0.7)',
                    color: btFilter === r ? cfg.color : '#64748b',
                    border: `1px solid ${btFilter === r ? cfg.border : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.2s',
                  }}>
                    {r === 'TODOS' ? 'Todos' : cfg.label}
                  </button>
                );
              })}
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, margin: '0 4px 0 14px' }}>CATEGORÍA:</span>
              {['Todos', ...btCats].map(c => (
                <button key={c} onClick={() => setBtCatFilter(c)} style={{
                  padding: '5px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  background: btCatFilter === c ? 'rgba(99,102,241,0.15)' : 'rgba(22,32,50,0.7)',
                  color: btCatFilter === c ? '#818cf8' : '#64748b',
                  border: `1px solid ${btCatFilter === c ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.2s',
                }}>{c}</button>
              ))}
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

                  {/* ── FILA FINAL CON EL PNL PROMEDIO DE LAS 20 ALERTAS ─────── */}
                  <tfoot>
                    <tr style={{
                      background: 'rgba(15,23,42,0.95)',
                      borderTop: '2px solid rgba(255,255,255,0.12)',
                      fontSize: '0.88rem',
                    }}>
                      <td colSpan={6} style={{ padding: '14px 12px', fontWeight: 800, color: '#f8fafc', textAlign: 'right' }}>
                        📊 PnL PROMEDIO (ÚLTIMAS {last20Trades.length} ALERTAS {execMode}):
                      </td>
                      <td style={{ padding: '14px 12px', fontWeight: 900, fontSize: '1.1rem', color: pnlPromedioUltimas20 >= 0 ? '#10b981' : '#ef4444' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          background: pnlPromedioUltimas20 >= 0 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                          border: `1px solid ${pnlPromedioUltimas20 >= 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                          boxShadow: `0 0 12px ${pnlPromedioUltimas20 >= 0 ? '#10b981' : '#ef4444'}33`
                        }}>
                          {pnlPromedioUltimas20 > 0 ? '+' : ''}{pnlPromedioUltimas20}%
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                          ⏱️ 100% TIMEOUT ({cat.limiteDias}d)
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

      {/* ── Comparativa entre categorías ────────────────────────────────── */}1px 12px', color: '#60a5fa', fontWeight: 600, fontSize: '0.82rem' }}>
                            {t.Dias_Trade}d <span style={{ color: '#475569', fontSize: '0.72rem' }}>/ {maxDias}d máx</span>
                          </td>
                          <td style={{ padding: '11px 12px', fontWeight: 800, color: pnlColor }}>{pnl > 0 ? '+' : ''}{pnl}%</td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: motivoSalida.bg, color: motivoSalida.color, border: `1px solid ${motivoSalida.border}`, whiteSpace: 'nowrap' }}>{motivoSalida.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Comparativa entre categorías ────────────────────────────────── */}
      <div style={{ background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#f8fafc' }}>
          🏆 Comparativa entre Categorías (Modelo V3.7)
        </h3>
        <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '0.8rem' }}>
          Modelos especializados por categoría optimizados con F₀.₅-Score · Out-of-Sample (5 años OHLCV)
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
    </div>
  );
};

export default Backtesting;
