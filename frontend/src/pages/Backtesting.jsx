import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarketData } from '../hooks/useMarketData';

// ─── Datos estáticos del modelo LightGBM V2 ──────────────────────────────────
// Fuente: Modelos/reporte_optimizador_categorias.csv — optimizado con F₀.₅-Score
const MODELO_CATEGORIAS = [
  {
    id: '🎯 Sweet Spot',
    emoji: '🎯',
    nombre: 'Sweet Spot',
    tp: 15, sl: 8, confirmacion: 2, limiteDias: 14,
    winRate: 78.5, cagr: 46.2, retornoTrade: 3.85, totalTrades: 174,
    color: '#eab308', bg: 'rgba(234,179,8,0.15)', border: '#eab308',
    desc: 'Fundamentos sólidos con corrección temporal. Tendencia de largo plazo intacta (precio > SMA200). Zona óptima Smart DCA.',
    f05: 0.82,
  },
  {
    id: '🔥 Cazador Dips',
    emoji: '🔥',
    nombre: 'Cazador Dips',
    tp: 12, sl: 8, confirmacion: 1, limiteDias: 21,
    winRate: 72.2, cagr: 38.5, retornoTrade: 3.20, totalTrades: 212,
    color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: '#ef4444',
    desc: 'Drawdown >35% + RSI 2D <10 (Connors). Mayor tiempo máximo (21d) para esperar rebote tras caída agresiva.',
    f05: 0.76,
  },
  {
    id: '⚡ Recup. Rápida',
    emoji: '⚡',
    nombre: 'Recup. Rápida',
    tp: 15, sl: 5, confirmacion: 1, limiteDias: 7,
    winRate: 80.0, cagr: 52.0, retornoTrade: 4.10, totalTrades: 323,
    color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: '#10b981',
    desc: 'EMA20 ≥ SMA50, precio sobre SMA200. Ciclo corto (7d máx) = alta rotación de capital con momentum alcista.',
    f05: 0.85,
  },
  {
    id: '⚠️ Cuchillos Cayendo',
    emoji: '⚠️',
    nombre: 'Cuchillos Cayendo',
    tp: 8, sl: 5, confirmacion: 2, limiteDias: 7,
    winRate: 68.5, cagr: 23.8, retornoTrade: 1.80, totalTrades: 378,
    color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', border: '#64748b',
    desc: 'Sin soporte claro. Menor TP (8%) y ciclo muy corto (7d) para minimizar exposición al riesgo bajista.',
    f05: 0.71,
  },
];

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
const Backtesting = () => {
  const [selectedCat, setSelectedCat] = useState('⚡ Recup. Rápida'); // la mejor por CAGR
  const { data: marketData, isLoading } = useMarketData();

  const cat = MODELO_CATEGORIAS.find(c => c.id === selectedCat) || MODELO_CATEGORIAS[0];

  // Activos actuales filtrados por esta categoría (desde predicciones_v2.json)
  const activosCat = useMemo(() => {
    const predicciones = marketData?.TOP_25_DIPS || [];
    return predicciones.filter(a => {
      const rawCat = a.Categoria || '';
      return rawCat.includes(cat.nombre.replace('⚡ ', '').replace('🎯 ', '').replace('🔥 ', '').replace('⚠️ ', ''));
    });
  }, [marketData, cat]);

  const buySignals = activosCat.filter(a => a.Veredicto_V2 === 'BUY');
  const avgProb = activosCat.length
    ? (activosCat.reduce((s, a) => s + (a['Probabilidad_Exito_%'] || 0), 0) / activosCat.length).toFixed(1)
    : 0;

  return (
    <div style={{ paddingBottom: '60px', maxWidth: '1050px', margin: '0 auto' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{
          margin: '0 0 6px', fontSize: '1.8rem',
          background: 'linear-gradient(135deg, #10b981, #60a5fa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          📊 Backtesting & Optimizador MLOps V2
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
          Parámetros óptimos por categoría · Modelo <strong style={{ color: '#818cf8' }}>LightGBM V2</strong> (219 activos, 14,027 muestras) · Métrica: <strong style={{ color: '#a78bfa' }}>F₀.₅-Score</strong>
        </p>
      </div>

      {/* ── Tabs por categoría ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '24px' }}>
        {MODELO_CATEGORIAS.map(c => (
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
              value={`${cat.confirmacion} Día${cat.confirmacion > 1 ? 's' : ''}`}
              color="#f59e0b"
              tooltip="Días consecutivos en zona de dip para confirmar la entrada (filtro anti-ruido)."
              sub="Filtro anti-ruido"
            />
            <StatCard
              label="📈 Ret. Prom/Trade"
              value={`+${cat.retornoTrade}%`}
              color="#a78bfa"
              tooltip={`Retorno neto promedio por trade después de fricción ($0.15 USD/orden). Calculado en ${cat.totalTrades} trades OOS.`}
              sub={`${cat.totalTrades} trades OOS`}
            />
            <StatCard
              label="🚀 CAGR Anualizado"
              value={`+${cat.cagr}%`}
              color="#38bdf8"
              tooltip="Tasa de crecimiento anualizado compuesto (CAGR) basada en la velocidad de rotación del capital con este TP/SL/Días."
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
                  <th style={{ padding: '10px 14px' }}>Kelly %</th>
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
                  const isBuy = a.Veredicto_V2 === 'BUY';
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
                          {a.Emoji} {a.Veredicto_V2}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#818cf8', fontWeight: 700 }}>{a['Position_Sizing_Kelly_%'] ?? 0}%</td>
                      <td style={{ padding: '12px 14px', color: '#ef4444', fontWeight: 600 }}>${a.Stop_Loss_ATR_USD}</td>
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

      {/* ── Comparativa entre categorías ────────────────────────────────── */}
      <div style={{ background: 'rgba(18,26,44,0.7)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '22px 24px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#f8fafc' }}>
          🏆 Comparativa entre Categorías (Modelo V2)
        </h3>
        <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '0.8rem' }}>
          Todas optimizadas con F₀.₅-Score · Fricción $0.15 USD/trade · Out-of-Sample (datos no vistos)
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {MODELO_CATEGORIAS.map(c => (
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
                <span>CAGR:</span><span style={{ color: '#38bdf8', fontWeight: 700 }}>+{c.cagr}% / año</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
                <span>Ret./Trade:</span><span style={{ color: '#a78bfa', fontWeight: 700 }}>+{c.retornoTrade}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
                <span>Win Rate:</span><span style={{ color: c.color, fontWeight: 700 }}>{c.winRate}%</span>
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
