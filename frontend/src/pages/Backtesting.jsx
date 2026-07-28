import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Backtesting = () => {
  const [backtestData, setBacktestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDipCategory, setSelectedDipCategory] = useState("🎯 Sweet Spot");
  const [selectedAssetType, setSelectedAssetType] = useState("Todos");

  useEffect(() => {
    fetch('/backtest_results.json?t=' + new Date().getTime())
      .then(res => {
        if (!res.ok) throw new Error("No se encontraron datos de backtest");
        return res.json();
      })
      .then(data => {
        setBacktestData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>🤖 Optimizando Cuadrícula de TP / SL / Días...</h2>
        <p>Ejecutando simulación trade-a-trade y buscando la combinación de máximo retorno.</p>
      </div>
    );
  }

  if (error || !backtestData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#ef4444' }}>
        <h2>❌ Error cargando Backtesting</h2>
        <p>{error || "No hay datos disponibles"}</p>
      </div>
    );
  }

  const optimizaciones = backtestData.optimizacionesPorCategoria || {};
  const alertasUltimoMes = backtestData.alertasUltimoMes || [];

  const assetTypes = ["Todos", "Cripto", "ETF / Índice", "Acción"];
  const filteredAlertas = alertasUltimoMes.filter(a => {
    if (selectedAssetType === "Todos") return true;
    return (a.tipoActivo || "Acción") === selectedAssetType;
  });

  const dipCategories = ["🔥 Cazador Dips", "🎯 Sweet Spot", "⚡ Recup. Rápida", "⚠️ Cuchillos Cayendo"];
  const currentOpt = optimizaciones[selectedDipCategory] || {
    tpPct: 5, slPct: 8, maxDays: 30, winRate: 60, avgPnlPct: 1.2, totalTrades: 0, expectancy: 1.5
  };

  const analisisPorSector = backtestData.analisisPorSector || {};
  const sectorEntries = Object.entries(analisisPorSector).sort((a, b) => b[1].avgPnlPct - a[1].avgPnlPct);

  return (
    <div style={{ paddingBottom: '60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', background: 'linear-gradient(135deg, #10b981, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            📊 Backtesting & Optimizador por Categoría de Dip
          </h2>
          <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Optimización automática trade-a-trade de <strong>Take Profit %</strong>, <strong>Stop Loss %</strong> y <strong>Días Máximos</strong>.
          </p>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'var(--panel-bg)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          ⏱️ Generado: {backtestData.fecha_generacion}
        </span>
      </div>

      {/* Tabs por Categoría de Dip */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '25px' }}>
        {dipCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedDipCategory(cat)}
            style={{
              background: selectedDipCategory === cat ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.6)',
              color: selectedDipCategory === cat ? '#10b981' : '#94a3b8',
              border: `1px solid ${selectedDipCategory === cat ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
              padding: '12px 22px', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: '0.3s', fontSize: '0.95rem'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tarjeta Destacada de Combinación Óptima Encontrada por el Optimizador */}
      <motion.div
        key={selectedDipCategory}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.7), rgba(15,23,42,0.9))',
          padding: '25px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)',
          marginBottom: '35px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10b981', fontWeight: 'bold' }}>
              🎯 Combinación Ganadora Encontrada (Grid Search)
            </span>
            <h3 style={{ margin: '5px 0 0 0', fontSize: '1.5rem', color: '#f8fafc' }}>
              Fórmula Óptima para <span style={{ color: '#00ff88' }}>{selectedDipCategory}</span>
            </h3>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981', padding: '8px 18px', borderRadius: '25px', fontWeight: 'bold', fontSize: '0.9rem' }}>
            ⚡ Win Rate: {currentOpt.winRate}%
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px', marginTop: '20px' }}>
          <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>🎯 Target Take Profit (TP)</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>
              +{currentOpt.tpPct}%
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Objetivo de ganancia</span>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>🛑 Stop Loss (SL)</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>
              -{currentOpt.slPct}%
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Límite de protección</span>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>🛡️ Confirmación Entrada</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '4px' }}>
              {currentOpt.diasConsecutivos || 1} Día{currentOpt.diasConsecutivos > 1 ? 's' : ''}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Filtro de permanencia</span>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>⏱️ Límite de Días</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#60a5fa', marginTop: '4px' }}>
              {currentOpt.maxDays} Días
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cierre por tiempo máx</span>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>🚀 Ritmo Anualizado</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>
              +{currentOpt.cagrPct || 0}% / año
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Velocidad del capital</span>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.8)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📈 Retorno Prom / Trade</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: currentOpt.avgPnlPct >= 0 ? '#10b981' : '#ef4444', marginTop: '4px' }}>
              {currentOpt.avgPnlPct >= 0 ? `+${currentOpt.avgPnlPct}%` : `${currentOpt.avgPnlPct}%`}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Promedio de {currentOpt.totalTrades} trades</span>
          </div>
        </div>
      </motion.div>

      {/* Análisis por Sector */}
      <div style={{ marginBottom: '40px', background: 'rgba(30,41,59,0.5)', padding: '22px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ fontSize: '1.3rem', color: '#f8fafc', margin: '0 0 5px 0' }}>
          📊 Rendimiento del Backtesting por Sector
        </h3>
        <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
          Efectividad histórica (Win Rate %) y rendimiento promedio ajustado por categoría sectorial.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
          {sectorEntries.map(([sec, data]) => (
            <div key={sec} style={{ background: 'rgba(15,23,42,0.7)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#f1f5f9', fontSize: '0.9rem' }}>{sec}</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{data.totalTrades} trades</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Win Rate:</span>
                <span style={{ fontWeight: 'bold', color: '#10b981', fontSize: '1.05rem' }}>{data.winRate}%</span>
              </div>

              {/* Bar progress win rate */}
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ width: `${Math.min(100, data.winRate)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: '3px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: '#94a3b8' }}>Avg PnL:</span>
                <span style={{ fontWeight: 'bold', color: data.avgPnlPct >= 0 ? '#10b981' : '#ef4444' }}>
                  {data.avgPnlPct >= 0 ? `+${data.avgPnlPct}%` : `${data.avgPnlPct}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auditoría de Alertas de los Últimos 90 Días */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', color: '#f8fafc', margin: 0 }}>
              📅 Auditoría de Alertas de los Últimos 90 Días
            </h3>
            <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Seguimiento real con reglas anti-falsos positivos (2d seguidos), cooldown 14d y resultado a 60 días.
            </p>
          </div>

          {/* Filtros por Tipo de Activo */}
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,23,42,0.6)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {assetTypes.map(type => (
              <button
                key={type}
                onClick={() => setSelectedAssetType(type)}
                style={{
                  background: selectedAssetType === type ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                  color: selectedAssetType === type ? '#60a5fa' : '#94a3b8',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                {type === 'Cripto' ? '🪙 Cripto' : type === 'ETF / Índice' ? '📊 ETFs / Índices' : type === 'Acción' ? '📈 Acciones' : '🌐 Todos'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'rgba(30,41,59,0.4)', borderRadius: '16px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: '0.85rem' }}>
                <th style={{ padding: '14px 18px' }}>Fecha</th>
                <th style={{ padding: '14px 18px' }}>Ticker</th>
                <th style={{ padding: '14px 18px' }}>Tipo Activo</th>
                <th style={{ padding: '14px 18px' }}>Categoría</th>
                <th style={{ padding: '14px 18px' }}>Precio Alerta</th>
                <th style={{ padding: '14px 18px' }}>Precio Salida / Actual</th>
                <th style={{ padding: '14px 18px' }}>Rendimiento (P&L %)</th>
                <th style={{ padding: '14px 18px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlertas.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                    No se registraron alertas para el tipo de activo seleccionado ({selectedAssetType}) en los últimos 90 días.
                  </td>
                </tr>
              ) : (
                filteredAlertas.map((alerta, idx) => (
                  <tr 
                    key={idx}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: '0.2s' }}
                  >
                    <td style={{ padding: '14px 18px', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {alerta.fechaAlerta}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 'bold', color: '#f8fafc' }}>
                      {alerta.ticker}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '600',
                        background: alerta.tipoActivo === 'Cripto' ? 'rgba(245,158,11,0.15)' : alerta.tipoActivo === 'ETF / Índice' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                        color: alerta.tipoActivo === 'Cripto' ? '#f59e0b' : alerta.tipoActivo === 'ETF / Índice' ? '#60a5fa' : '#10b981',
                        border: `1px solid ${alerta.tipoActivo === 'Cripto' ? 'rgba(245,158,11,0.3)' : alerta.tipoActivo === 'ETF / Índice' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`
                      }}>
                        {alerta.tipoActivo || 'Acción'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                      {alerta.categoria}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                      ${alerta.precioEntrada}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                      ${alerta.precioActual}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 'bold', color: alerta.pnlPct >= 0 ? '#10b981' : '#ef4444' }}>
                      {alerta.pnlPct >= 0 ? `+${alerta.pnlPct}%` : `${alerta.pnlPct}%`}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                        background: alerta.pnlPct >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: alerta.pnlPct >= 0 ? '#10b981' : '#ef4444',
                        border: `1px solid ${alerta.pnlPct >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                      }}>
                        {alerta.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Backtesting;
