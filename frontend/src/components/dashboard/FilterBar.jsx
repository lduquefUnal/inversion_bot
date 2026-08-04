import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

// ─── Datos del modelo LightGBM V3.7 (Modelos Especializados)
// Optimizados con F0.5-score — precisión > recall sobre 5 años OHLCV
const ESTRATEGIAS_MODELO = [
  {
    id: 'all',
    label: '🔭 Todos',
    type: 'all',
    descripcion: null,
  },
  {
    id: 'veredicto',
    label: '✅ BUY Aprobadas',
    type: 'veredicto',
    descripcion: 'Solo activos con Veredicto = BUY (Probabilidad ≥ umbral óptimo del modelo)',
  },
  {
    id: 'Recup. Rapida',
    label: '⚡ Recup. Rápida',
    type: 'verde',
    tp: '+10%',
    sl: '-4%',
    confirmacion: '1 Día',
    limite_dias: '11 Días',
    winRate: '48.5%',
    cagr: '+35.6% / año',
    retorno_trade: '+2.66%',
    total_trades: 33,
    descripcion: 'Tendencia alcista primaria (precio > SMA200) con corrección temporal corta. Mayor inercia y expectancia positiva (+2.66%/trade).',
  },
  {
    id: 'Sweet Spot',
    label: '🎯 Sweet Spot',
    type: 'yellow',
    tp: '+15%',
    sl: '-6%',
    confirmacion: '2 Días',
    limite_dias: '11 Días',
    winRate: '33.3%',
    cagr: '0.0% / año',
    retorno_trade: '-1.48%',
    total_trades: 19,
    descripcion: 'Drawdown moderado en tendencia sana. Exige umbral de alta probabilidad (th ≥ 0.55) para activar entrada.',
  },
  {
    id: 'Cazador Dips',
    label: '🔥 Cazador Dips',
    type: 'red',
    tp: '+12%',
    sl: '-5%',
    confirmacion: '1 Día',
    limite_dias: '11 Días',
    winRate: '45.5%',
    cagr: '+45.1% / año',
    retorno_trade: '+3.76%',
    total_trades: 26,
    descripcion: 'Caídas profundas con sobreventa RSI14 < 32. Requiere confirmación de volumen institucional (CMF > -0.10).',
  },
  {
    id: 'Cuchillos Cayendo',
    label: '⚠️ Cuchillos',
    type: 'gray',
    tp: '+8%',
    sl: '-4%',
    confirmacion: '2 Días',
    limite_dias: '11 Días',
    winRate: '45.8%',
    cagr: '0.0% / año',
    retorno_trade: '-0.50%',
    total_trades: 99,
    descripcion: 'Tendencia bajista sin soporte. Desactivada de capital por el algoritmo salvo probabilidad muy alta.',
  },
];

const COLOR_CFG = {
  veredicto: { bg: 'rgba(34,197,94,0.2)',   color: '#22c55e', border: '#22c55e' },
  verde:     { bg: 'rgba(16,185,129,0.2)',  color: '#10b981', border: '#10b981' },
  yellow:    { bg: 'rgba(234,179,8,0.2)',   color: '#eab308', border: '#eab308' },
  red:       { bg: 'rgba(239,68,68,0.2)',   color: '#ef4444', border: '#ef4444' },
  gray:      { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8', border: '#64748b' },
  all:       { bg: '#3b82f6',               color: 'white',   border: '#3b82f6' },
};

// ─── Tarjeta expandida de estrategia ─────────────────────────────────────────
const EstrategiaCard = ({ est }) => {
  if (!est.tp) return null; // 'Todos' y 'veredicto' no tienen métricas de modelo
  const cfg = COLOR_CFG[est.type];
  const winNum = parseFloat(est.winRate);
  const winColor = winNum >= 75 ? '#10b981' : winNum >= 65 ? '#eab308' : '#ef4444';

  return (
    <div style={{
      background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
      borderRadius: '16px', border: `1px solid ${cfg.border}33`,
      padding: '16px 20px', marginTop: '14px',
      boxShadow: `0 4px 20px ${cfg.border}11`,
    }}>
      {/* Descripción */}
      {est.descripcion && (
        <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', lineHeight: 1.5 }}>
          {est.descripcion}
        </p>
      )}

      {/* Grid de métricas del modelo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <MetricBox label="🎯 Take Profit" value={est.tp} color="#10b981" />
        <MetricBox label="🛑 Stop Loss" value={est.sl} color="#ef4444" />
        <MetricBox label="⏱️ Límite Días" value={est.limite_dias} color="#60a5fa"
          tooltip="Time Stop: si no llega al TP ni SL en N días, se cierra al precio de mercado para liberar capital." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <MetricBox label="📈 Ret./Trade" value={est.retorno_trade} color="#a78bfa" />
        <MetricBox label="🚀 CAGR" value={est.cagr} color="#38bdf8" />
        <MetricBox label="✅ Win Rate" value={est.winRate} color={winColor} />
      </div>

      {/* Confirmación + Trades */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: '#475569' }}>
          Confirmación entrada: <strong style={{ color: '#94a3b8' }}>{est.confirmacion}</strong>
        </span>
        <span style={{ fontSize: '0.72rem', color: '#475569' }}>
          {est.total_trades} trades OOS · Fricción $0.15/trade
        </span>
      </div>

      {/* F0.5-score badge */}
      <div style={{ marginTop: '10px', padding: '6px 12px', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
        <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
          ⚙️ Optimizado con F₀.₅-Score — prioriza precisión sobre recall (menos falsos positivos)
        </span>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, color, tooltip }) => (
  <div
    title={tooltip || ''}
    style={{
      background: 'rgba(30,41,59,0.7)', borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.05)', padding: '10px 12px',
      cursor: tooltip ? 'help' : 'default',
    }}
  >
    <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: '3px' }}>{label}</div>
    <div style={{ fontSize: '1rem', fontWeight: 800, color }}>{value}</div>
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
const FilterBar = () => {
  const { activeCategory, setActiveCategory, searchTerm, setSearchTerm } = useAppStore();
  const [expandedId, setExpandedId] = useState(null);

  const handleCatClick = (id) => {
    setActiveCategory(id);
    setExpandedId(prev => (prev === id && id !== 'all') ? null : (id !== 'all' ? id : null));
  };

  const activeEst = ESTRATEGIAS_MODELO.find(e => e.id === expandedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', margin: '20px 0' }}>
      {/* Buscador */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
        <input
          type="text"
          placeholder="🔍 Buscar ticker o empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '12px 20px', borderRadius: '30px',
            background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
          >✕</button>
        )}
      </div>

      {/* Botones de categoría */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {ESTRATEGIAS_MODELO.map(est => {
          const isActive = activeCategory === est.id;
          const cfg = COLOR_CFG[est.type];
          const hasMetrics = !!est.tp;

          return (
            <button
              key={est.id}
              onClick={() => handleCatClick(est.id)}
              style={{
                background: isActive ? cfg.bg : 'rgba(22,32,50,0.7)',
                color: isActive ? cfg.color : '#94a3b8',
                border: `1px solid ${isActive ? cfg.border : 'rgba(255,255,255,0.07)'}`,
                padding: '9px 18px', borderRadius: '30px', fontFamily: 'inherit',
                fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.25s', boxShadow: isActive ? `0 4px 14px ${cfg.bg}` : 'none',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              {est.label}
              {hasMetrics && (
                <span style={{ fontSize: '0.7rem', color: isActive ? cfg.color : '#475569' }}>
                  {expandedId === est.id ? '▲' : '▼'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tarjeta expandida con métricas del modelo */}
      {activeEst && activeEst.tp && (
        <div style={{ width: '100%', maxWidth: '700px' }}>
          <EstrategiaCard est={activeEst} />
        </div>
      )}
    </div>
  );
};

export default FilterBar;
