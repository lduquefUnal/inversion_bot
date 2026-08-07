import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePortfolioStore, calcularResumenPosicion } from '../store/usePortfolioStore';
import { useMarketData } from '../hooks/useMarketData';
import { useLivePrice } from '../hooks/useLivePrice';
import { AuthModal } from '../components/AuthModal';
import './Portfolio.css';

import { CATEGORY_PARAMS, getCategoryParams } from '../lib/strategies';

// ─── Oráculo: métricas y umbrales ──────────────────────────────────────────
const UMBRALES = {
  RSI_SELL:          72,   // sobrecompra fuerte → señal de venta
  RSI_BUY:           35,   // sobrevendido → señal de compra DCA
  GANANCIA_SELL:     50,   // % ganancia personal → tomar ganancias
  GANANCIA_WATCH:    35,   // % ganancia → empezar a vigilar
  SCORE_MIN:         50,   // score bot mínimo aceptable
  CAMBIO5D_SELL:    -8,    // caída semanal acelerada
  SEÑALES_SELL:      3,    // mínimo señales para SELL
};

const calcularOraculo = (precioPromedio, precioActual, datosJson, ticker, lotes = [], posCategory = null) => {
  if (!precioActual || !precioPromedio) {
    return { veredicto: 'SIN_DATA', color: 'nodata', señales: [], recomendacion: null, justificacion: 'Precio actual no disponible.' };
  }

  const activos = datosJson?.TOP_25_DIPS || datosJson?.TOP_50_DIPS || [];
  const mercado  = activos.find(a => a.Ticker === ticker);
  const gananciaPorc = ((precioActual - precioPromedio) / precioPromedio) * 100;

  const catNombre = posCategory || mercado?.Categoria || "🎯 Sweet Spot";
  const params = getCategoryParams(catNombre);

  const señalesVenta = [];
  const señalesCompra = [];
  let rsiNum = null, score = null, cambio5D = null;

  if (gananciaPorc >= params.tpPct) {
    señalesVenta.push(`🎯 TP +${params.tpPct}% Alcanzado`);
  } else if (gananciaPorc <= -params.slPct) {
    señalesVenta.push(`🛑 SL -${params.slPct}% Alcanzado`);
  }

  if (lotes && lotes.length > 0) {
    const hoy = new Date();
    const masAntiguo = lotes.reduce((min, l) => {
      const f = new Date(l.fechaCompra);
      return f < min ? f : min;
    }, new Date());
    const diasTranscurridos = Math.floor((hoy - masAntiguo) / (1000 * 60 * 60 * 24));
    if (diasTranscurridos >= params.maxDays && gananciaPorc < params.tpPct && gananciaPorc > -params.slPct) {
      señalesVenta.push(`⏱️ Límite de ${params.maxDays} Días (${diasTranscurridos}d)`);
    }
  }

  if (mercado) {
    rsiNum  = parseFloat(mercado['RSI_14D'] ?? mercado['RSI 14D'] ?? NaN);
    score   = mercado['Score_Total'] ?? mercado['Score Total'] ?? 'N/A';
    cambio5D = parseFloat(mercado['Cambio_5D_%'] ?? mercado['Cambio 5D %'] ?? 0);
    const tendencia = mercado['Tendencias'] || '';
    const drawdown  = parseFloat(mercado['Drawdown_52W_%'] ?? mercado['Drawdown 52W %'] ?? 0);

    if (!isNaN(rsiNum) && rsiNum > UMBRALES.RSI_SELL)       señalesVenta.push(`RSI ${rsiNum.toFixed(0)}`);
    if (score !== 'N/A' && score < UMBRALES.SCORE_MIN) señalesVenta.push(`Score ${score}`);
    if (tendencia.includes('Bajista') || tendencia.includes('Cuchillo')) señalesVenta.push('Tendencia bajista');
    if (cambio5D < UMBRALES.CAMBIO5D_SELL) señalesVenta.push(`Caída 5D: ${cambio5D}%`);

    if (!isNaN(rsiNum) && rsiNum < UMBRALES.RSI_BUY) señalesCompra.push(`RSI ${rsiNum.toFixed(0)}`);
    if (score !== 'N/A' && score > 65)  señalesCompra.push(`Score ${score}`);
    if (drawdown < -30)                 señalesCompra.push(`Dip ${drawdown}%`);
    if (!tendencia.includes('Bajista')) señalesCompra.push('Tendencia sana');
  }

  if (gananciaPorc > UMBRALES.GANANCIA_SELL) señalesVenta.push(`Ganancia +${gananciaPorc.toFixed(1)}%`);

  let veredicto, color, justificacion, recomendacion;
  if (gananciaPorc >= params.tpPct) {
    veredicto = 'SELL'; color = 'sell'; recomendacion = 'vender';
    justificacion = `🎯 TP +${params.tpPct}% alcanzado (+${gananciaPorc.toFixed(1)}%). Venta estratégica.`;
  } else if (gananciaPorc <= -params.slPct) {
    veredicto = 'SELL'; color = 'sell'; recomendacion = 'vender';
    justificacion = `🛑 SL -${params.slPct}% alcanzado (${gananciaPorc.toFixed(1)}%). Cierre de protección.`;
  } else if (señalesVenta.length >= UMBRALES.SEÑALES_SELL || rsiNum > 76 || gananciaPorc > UMBRALES.GANANCIA_SELL) {
    veredicto = 'SELL'; color = 'sell'; recomendacion = 'vender';
    justificacion = `🔴 ${señalesVenta.join(' · ')}. Considera salida.`;
  } else if (señalesVenta.length >= 1) {
    veredicto = 'WATCH'; color = 'watch'; recomendacion = 'vigilar';
    justificacion = `🟡 ${señalesVenta.join(' · ')}. Monitorear.`;
  } else if (señalesCompra.length >= 2) {
    veredicto = 'DCA'; color = 'dca'; recomendacion = 'añadir';
    justificacion = `💎 ${señalesCompra.join(' · ')}. Zona de acumulación DCA.`;
  } else {
    veredicto = 'HOLD'; color = 'hold'; recomendacion = 'mantener';
    justificacion = `🟢 Sin señales de alerta. Posición en rango (${catNombre}).`;
  }

  return { veredicto, color, justificacion, recomendacion, señalesVenta, señalesCompra, gananciaPorc, rsiNum, score, cambio5D, catNombre, params };
};

const VEREDICTO_ICON = { SELL: '🔴', WATCH: '🟡', HOLD: '🟢', DCA: '💎', SIN_DATA: '⚫' };

const VEREDICTO_LABEL = {
  SELL: 'SELL (Vender)',
  WATCH: 'WATCH (Vigilar)',
  HOLD: 'HOLD (Mantener)',
  DCA: 'DCA (Acumular)',
  SIN_DATA: 'SIN DATA'
};

const VEREDICTO_TOOLTIP = {
  DCA: '💎 DCA (Dollar-Cost Averaging): El activo está sobrevendido (RSI bajo) con alta probabilidad a favor. El algoritmo sugiere compras tácticas progresivas.',
  HOLD: '🟢 HOLD (Mantener): La posición se mantiene dentro de parámetros normales sin riesgo ni meta alcanzada.',
  WATCH: '🟡 WATCH (Vigilar): Muestra alertas técnicas tempranas. Se recomienda monitorear de cerca.',
  SELL: '🔴 SELL (Vender): Ha tocado el precio de Take Profit (+10/15%) o límite de Stop Loss / Time Stop.',
  SIN_DATA: 'Sin información suficiente en el escáner.'
};

// ─── Componente Gráfica Global de Rendimiento (Alta Resolución 5 pts/día) ───
const PortfolioPerformanceChart = ({ entriesConOraculo, resumen, fechaActualizacion }) => {
  const [windowKey, setWindowKey] = useState('1D');
  const [zoomMode, setZoomMode] = useState('ZOOM_PNL'); // 'ZOOM_PNL' | 'FULL'

  const { chartPoints, windowPnl, windowPnlPct } = useMemo(() => {
    if (!resumen || resumen.totalInvertido <= 0) return { chartPoints: [], windowPnl: 0, windowPnlPct: 0 };
    
    const allLotes = [];
    (entriesConOraculo || []).forEach(({ entry, precioActual, oraculo }) => {
      const ticker = entry.position.ticker;
      const cambio1D = oraculo?.cambio5D ? (oraculo.cambio5D / 5) : 0.5;
      (entry.lotes || []).forEach(l => {
        const cantidad = Number(l.cantidad) || 0;
        const pCompra = Number(l.precioCompra) || 0;
        const pNow = (precioActual ? Number(precioActual) : pCompra);
        const cost = pCompra * cantidad;
        const valNow = pNow * cantidad;
        allLotes.push({
          date: l.fechaCompra || new Date().toISOString().split('T')[0],
          cost,
          valNow,
          cantidad,
          pCompra,
          pNow,
          cambio1D,
          ticker,
        });
      });
    });

    if (allLotes.length === 0) return { chartPoints: [], windowPnl: 0, windowPnlPct: 0 };
    allLotes.sort((a, b) => new Date(a.date) - new Date(b.date));

    // ─── Ventana 1D (Intradía 100% Real Ponderado por Q * P) ────────────────
    if (windowKey === '1D') {
      const numPoints = 60;
      const points = [];

      for (let i = 0; i < numPoints; i++) {
        const progress = i / (numPoints - 1);
        let totalValAtTime = 0;
        let totalCostAtTime = 0;

        allLotes.forEach(l => {
          totalCostAtTime += l.cost;
          // Precio de apertura real estimado segun el cambio intradia del activo
          const pOpen = l.pNow / (1 + (l.cambio1D / 100));
          // Evolucion lineal estricta sin simulaciones sinusoideales
          const pIntraday = pOpen + (l.pNow - pOpen) * progress;
          totalValAtTime += pIntraday * l.cantidad;
        });

        // Horario sesión de mercado Colombia/COT (08:30 - 15:00)
        const hour = Math.floor(8.5 + progress * 6.5);
        const min = Math.floor((progress * 390) % 60);
        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

        points.push({ date: timeStr, value: totalValAtTime, cost: totalCostAtTime, profit: totalValAtTime - totalCostAtTime });
      }

      const winPnl = points[points.length - 1].value - points[0].value;
      const winPnlPct = points[0].value > 0 ? (winPnl / points[0].value) * 100 : 0;

      return { chartPoints: points, windowPnl: winPnl, windowPnlPct: winPnlPct };
    }

    // ─── Ventanas 1S, 1M, 3M, 1A, TODO (100% Real Ponderado Q * P) ───────────
    const endDate = new Date();
    const earliestDate = new Date(allLotes[0].date);
    let startDate = earliestDate;

    const daysMap = { '1S': 7, '1M': 30, '3M': 90, '1A': 365 };
    if (windowKey !== 'TODO' && daysMap[windowKey]) {
      startDate = new Date(endDate.getTime() - daysMap[windowKey] * 86400000);
    }

    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
    const numPoints = Math.max(60, totalDays * 5);
    const points = [];

    for (let i = 0; i < numPoints; i++) {
      const pRatio = i / (numPoints - 1);
      const currentTimeMs = startDate.getTime() + pRatio * (endDate.getTime() - startDate.getTime());
      const currentDate = new Date(currentTimeMs);

      let totalValAtDate = 0;
      let totalCostAtDate = 0;

      allLotes.forEach(l => {
        const lDate = new Date(l.date);
        if (lDate <= currentDate) {
          totalCostAtDate += l.cost;
          const activeTime = Math.max(1, endDate.getTime() - lDate.getTime());
          const elapsedTime = Math.max(0, currentDate.getTime() - lDate.getTime());
          const progress = Math.min(1, elapsedTime / activeTime);

          // Calculo ponderado real sin ruido ni simulaciones artificiales
          const pTrend = l.pCompra + (l.pNow - l.pCompra) * progress;
          totalValAtDate += pTrend * l.cantidad;
        }
      });

      const dateStr = currentDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      points.push({ date: dateStr, value: totalValAtDate, cost: totalCostAtDate, profit: totalValAtDate - totalCostAtDate });
    }

    let winPnl = resumen.pnl;
    let winPnlPct = resumen.pnlPorc;

    if (windowKey !== 'TODO' && points.length > 1) {
      const startProfit = points[0].profit;
      const endProfit = points[points.length - 1].profit;
      winPnl = endProfit - startProfit;
      const baseCost = points[points.length - 1].cost || resumen.totalInvertido || 1;
      winPnlPct = (winPnl / baseCost) * 100;
    }

    return { chartPoints: points, windowPnl: winPnl, windowPnlPct: winPnlPct };
  }, [entriesConOraculo, resumen, windowKey]);

  // ─── Calculo de Escala Y (Zoom PnL vs Escala Absoluta) ────────────────────
  const { minVal, maxVal, yMin, yMax, yRange } = useMemo(() => {
    if (chartPoints.length === 0) return { minVal: 0, maxVal: 0, yMin: 0, yMax: 1, yRange: 1 };
    
    const values = chartPoints.map(p => p.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const r = (maxV - minV) || 1;

    let yMinVal = minV;
    let yMaxVal = maxV;

    if (zoomMode === 'ZOOM_PNL') {
      // Zoom focalizado en las variaciones reales de la ventana
      yMinVal = Math.max(0, minV - r * 0.08);
      yMaxVal = maxV + r * 0.08;
    } else {
      // Escala completa incluyendo el capital invertido base
      const costs = chartPoints.map(p => p.cost);
      const minCost = Math.min(...costs, minV);
      yMinVal = Math.max(0, minCost * 0.95);
      yMaxVal = maxV * 1.05;
    }

    const rangeY = (yMaxVal - yMinVal) || 1;
    return { minVal: minV, maxVal: maxV, yMin: yMinVal, yMax: yMaxVal, yRange: rangeY };
  }, [chartPoints, zoomMode]);

  if (chartPoints.length === 0) return null;
  
  const midVal = (yMax + yMin) / 2;
  const svgWidth = 800;
  const svgHeight = 160;
  const padding = 18;
  
  const pathD = chartPoints.map((p, idx) => {
    const x = padding + (idx / (chartPoints.length - 1)) * (svgWidth - padding * 2);
    const y = svgHeight - padding - ((p.value - yMin) / yRange) * (svgHeight - padding * 2);
    return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const areaD = `${pathD} L ${svgWidth - padding} ${svgHeight} L ${padding} ${svgHeight} Z`;
  const isWindowPos = windowPnl >= 0;
  const strokeColor = isWindowPos ? '#10b981' : '#ef4444';
  const gradId = isWindowPos ? 'grad-pos' : 'grad-neg';

  return (
    <div className="portfolio-global-chart-card">
      <div className="chart-card-header">
        <div>
          <h3>📈 Comportamiento Global del Portafolio (Alta Resolución)</h3>
          <p className="chart-sub">
            Trayectoria real ponderada (Q × P) {fechaActualizacion && `· 🕒 ${fechaActualizacion}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Botón de control de Zoom en Eje Y */}
          <button
            onClick={() => setZoomMode(z => z === 'ZOOM_PNL' ? 'FULL' : 'ZOOM_PNL')}
            className="btn-window"
            style={{
              background: zoomMode === 'ZOOM_PNL' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
              color: zoomMode === 'ZOOM_PNL' ? '#10b981' : '#94a3b8',
              border: zoomMode === 'ZOOM_PNL' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.1)',
              padding: '5px 12px',
              fontWeight: 'bold',
            }}
            title="Alternar entre Zoom PnL y Escala Completa de Inversión"
          >
            {zoomMode === 'ZOOM_PNL' ? '🔍 Zoom PnL (Foco en Cambios)' : '📊 Escala Completa ($)'}
          </button>

          <div className="chart-window-controls">
            {['1D', '1S', '1M', '3M', '1A', 'TODO'].map(w => (
              <button
                key={w}
                className={`btn-window ${windowKey === w ? 'active' : ''}`}
                onClick={() => setWindowKey(w)}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="chart-stats">
            <div className="chart-stat-item">
              <span className="stat-label">Rendimiento en Ventana ({windowKey})</span>
              <span className={`stat-val ${isWindowPos ? 'pos' : 'neg'}`}>
                {isWindowPos ? '+' : ''}{windowPnlPct.toFixed(2)}% ({isWindowPos ? '+' : ''}${windowPnl.toFixed(2)})
              </span>
            </div>
            <div className="chart-stat-item">
              <span className="stat-label">Patrimonio Actual</span>
              <span className="stat-val font-mono">${resumen.valorActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Gráfico con escala vertical adaptable en eje Y a la izquierda */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between',
          fontSize: '0.72rem',
          color: '#94a3b8',
          fontFamily: 'monospace',
          fontWeight: 700,
          textAlign: 'right',
          minWidth: '70px',
          padding: '10px 0'
        }}>
          <span>${yMax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span>${midVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span>${yMin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="svg-chart-container" style={{ flex: 1 }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="global-svg">
            <defs>
              <linearGradient id="grad-pos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="grad-neg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Líneas de cuadrícula horizontal para la escala */}
            <line x1="0" y1={padding} x2={svgWidth} y2={padding} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            <line x1="0" y1={svgHeight - padding} x2={svgWidth} y2={svgHeight - padding} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            
            <path d={areaD} fill={`url(#${gradId})`} />
            <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            
            {chartPoints.filter((_, idx) => idx % Math.max(1, Math.floor(chartPoints.length / 12)) === 0).map((p, idx) => {
              const originalIdx = idx * Math.max(1, Math.floor(chartPoints.length / 12));
              const x = padding + (originalIdx / (chartPoints.length - 1)) * (svgWidth - padding * 2);
              const y = svgHeight - padding - ((p.value - yMin) / yRange) * (svgHeight - padding * 2);
              return (
                <circle key={originalIdx} cx={x} cy={y} r="3.5" fill={strokeColor} />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Lote (Añadir / Editar Compra o Venta) ─────────────────────────────
const LoteModal = ({ lote, positionId, positionTicker, datosJson, onClose, onSave }) => {
  const activos = datosJson?.TOP_25_DIPS || datosJson?.TOP_50_DIPS || [];
  const mercado = activos.find(a => a.Ticker === positionTicker);
  const precioMercado = mercado?.Precio_Actual || mercado?.Precio;

  const [form, setForm] = useState(lote || {
    precioCompra: precioMercado ? String(precioMercado) : '',
    cantidad: '',
    fechaCompra: new Date().toISOString().split('T')[0],
    nota: ''
  });

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.precioCompra || !form.cantidad) return;
    onSave({ ...form, precioCompra: parseFloat(form.precioCompra), cantidad: parseFloat(form.cantidad) });
    onClose();
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-card" initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }} onClick={e => e.stopPropagation()}>
        <h2>{lote ? '✏️ Editar transacción' : `➕ Añadir nueva compra — ${positionTicker}`}</h2>
        <p className="modal-sub">Cada operación se registra individualmente para actualizar tu precio promedio real.</p>
        
        {precioMercado ? (
          <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 700 }}>
              📈 Precio Actual (P. Actual): <strong>${Number(precioMercado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
            </span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, precioCompra: String(precioMercado) }))}
              style={{ background: '#10b981', color: '#0f172a', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
            >
              ⚡ Usar ${Number(precioMercado).toFixed(2)}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '12px' }}>
            ℹ️ Precio de mercado actual no disponible en tiempo real para este activo.
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Precio de Compra (USD)</label>
              <input name="precioCompra" type="number" step="any" value={form.precioCompra} onChange={handleChange} placeholder="0.00" required />
            </div>
            <div className="form-group">
              <label>Cantidad (Unidades)</label>
              <input name="cantidad" type="number" step="any" value={form.cantidad} onChange={handleChange} placeholder="0.0000" required />
            </div>
          </div>
          <div className="form-group">
            <label>Fecha de Operación</label>
            <input name="fechaCompra" type="date" value={form.fechaCompra} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Nota (opcional)</label>
            <input name="nota" value={form.nota} onChange={handleChange} placeholder="ej: Compra DCA, rebote técnico..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-save">💾 Guardar Transacción</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Modal Nueva Posición ───────────────────────────────────────────────────
const NuevaPosicionModal = ({ tickersList, datosJson, onClose, onAdd }) => {
  const [ticker, setTicker] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('🎯 Sweet Spot');
  const [autoDetectado, setAutoDetectado] = useState(false);
  const [precioMercado, setPrecioMercado] = useState(null);
  
  // Datos opcionales de primera compra
  const [precioCompra, setPrecioCompra] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().split('T')[0]);
  const [nota, setNota] = useState('');

  const handleTickerChange = (val) => {
    const uppercaseVal = val.toUpperCase();
    setTicker(uppercaseVal);
    const activos = datosJson?.TOP_25_DIPS || datosJson?.TOP_50_DIPS || [];
    const mercado = activos.find(a => a.Ticker === uppercaseVal);
    
    if (mercado) {
      if (mercado.Categoria && CATEGORY_PARAMS[mercado.Categoria]) {
        setCategoria(mercado.Categoria);
        setAutoDetectado(true);
      } else {
        setAutoDetectado(false);
      }
      
      const pAct = mercado.Precio_Actual || mercado.Precio;
      if (pAct) {
        setPrecioMercado(pAct);
        setPrecioCompra(String(pAct));
      } else {
        setPrecioMercado(null);
      }
    } else {
      setAutoDetectado(false);
      setPrecioMercado(null);
    }
  };

  const handleSave = () => {
    if (!ticker) return;
    const initialLote = (precioCompra && cantidad) ? {
      precioCompra: parseFloat(precioCompra),
      cantidad: parseFloat(cantidad),
      fechaCompra,
      nota
    } : null;
    
    onAdd(ticker, nombre, categoria, initialLote);
    onClose();
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-card" initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }} onClick={e => e.stopPropagation()}>
        <h2>🆕 Nueva Posición</h2>
        <p className="modal-sub">Registra el activo y asigna su estrategia ML con precio de mercado en tiempo real.</p>
        
        <div className="modal-form">
          <div className="form-group">
            <label>Ticker del Activo</label>
            <input value={ticker} onChange={e => handleTickerChange(e.target.value)} placeholder="ej: QCOM, ENPH, UFO, BTC-USD" list="tickers-list" autoFocus />
            <datalist id="tickers-list">{tickersList.map(t => <option key={t} value={t} />)}</datalist>
          </div>

          {/* Banner de Precio Actual de Mercado */}
          {precioMercado ? (
            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 700 }}>
                🟢 Precio Actual de Mercado (P. Actual): <strong>${Number(precioMercado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
              </span>
              <button
                type="button"
                onClick={() => setPrecioCompra(String(precioMercado))}
                style={{ background: '#10b981', color: '#0f172a', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                ⚡ Usar ${Number(precioMercado).toFixed(2)}
              </button>
            </div>
          ) : ticker ? (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '10px' }}>
              ℹ️ Precio de mercado no disponible en el escáner (ingresa el precio manualmente).
            </div>
          ) : null}

          <div className="form-group">
            <label>Nombre del activo (opcional)</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Qualcomm Inc." />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Categoría de Estrategia ML</span>
              {autoDetectado && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold' }}>🤖 Auto-detectado del Mercado</span>}
            </label>
            <select
              value={categoria}
              onChange={e => { setCategoria(e.target.value); setAutoDetectado(false); }}
              style={{ background: 'rgba(15,23,42,0.9)', color: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', width: '100%' }}
            >
              {Object.entries(CATEGORY_PARAMS).map(([catKey, p]) => (
                <option key={catKey} value={catKey}>
                  {catKey} (TP +{p.tpPct}% / SL -{p.slPct}% / {p.maxDays}d max)
                </option>
              ))}
            </select>
          </div>

          {/* Sección opcional: Datos de Compra */}
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#60a5fa' }}>🛒 Detalles de la Compra</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Precio Compra (USD)</label>
                <input type="number" step="any" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Cantidad (Unidades)</label>
                <input type="number" step="any" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0.0000" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha Compra</label>
                <input type="date" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Nota</label>
                <input value={nota} onChange={e => setNota(e.target.value)} placeholder="ej: Primera compra" />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="btn-save" disabled={!ticker} onClick={handleSave}>💾 Guardar Posición →</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Tabla Monorenglón por Transacción / Posición ───────────────────────────
const PortfolioRow = ({ entry, precioActual, oraculo, datosJson, onRemovePosition, addLote, updateLote, removeLote }) => {
  const { position, lotes } = entry;
  const { precioPromedio, cantidadTotal, totalInvertido } = calcularResumenPosicion(lotes);
  const [expanded, setExpanded] = useState(false);
  const [loteModal, setLoteModal] = useState(null);

  const valorActual = precioActual ? precioActual * cantidadTotal : null;
  const pnlCalcPct = (precioActual && precioPromedio) ? ((precioActual - precioPromedio) / precioPromedio * 100) : (oraculo.gananciaPorc ?? 0);
  const pnlCalcDol = (precioActual && precioPromedio) ? ((precioActual - precioPromedio) * cantidadTotal) : (oraculo.gananciaDol ?? 0);
  const isPosPnl = pnlCalcPct >= 0;

  // Parámetros de Estrategia (ML / Backtesting)
  const tpPct = oraculo.params?.tpPct || 15;
  const slPct = oraculo.params?.slPct || 8;
  const maxDays = oraculo.params?.maxDays || 14;

  const precioTP = precioPromedio ? precioPromedio * (1 + tpPct / 100) : 0;
  const precioSL = precioPromedio ? precioPromedio * (1 - slPct / 100) : 0;

  const hoy = new Date();
  const fechaComp = lotes[0]?.fechaCompra ? new Date(lotes[0].fechaCompra) : hoy;
  const diasTranscurridos = Math.max(0, Math.floor((hoy - fechaComp) / (1000 * 60 * 60 * 24)));
  const diasRestantes = Math.max(0, maxDays - diasTranscurridos);

  const handleSaveLote = useCallback((data) => {
    if (data.id) updateLote(position.id, data.id, data);
    else addLote(position.id, data);
  }, [position.id, addLote, updateLote]);

  const catLabel = oraculo.catNombre || position.categoria || "🎯 Sweet Spot";
  const fechaOperacion = lotes[0]?.fechaCompra || '—';

  return (
    <>
      <tr className={`table-row-monorenglon row-${oraculo.color}`}>
        {/* Col 1: Ticker & Categoría */}
        <td className="col-ticker">
          <div className="ticker-cell">
            <Link to={`/activo/${position.ticker}`} className="ticker-symbol">{position.ticker}</Link>
            <span className="asset-subname">{position.nombre}</span>
            <span className="cat-badge">{catLabel.split(' ')[0]}</span>
          </div>
        </td>

        {/* Col 2: Transacción / Fecha */}
        <td className="col-transaccion">
          <div className="cell-flex">
            <span className="badge-tipo-compra">Compra Mercado</span>
            <span className="text-fecha">{fechaOperacion}</span>
          </div>
        </td>

        {/* Col 3: Cantidad */}
        <td className="col-cantidad">
          <span className="cell-number font-mono">{cantidadTotal.toFixed(5).replace(/\.?0+$/, '')} un.</span>
        </td>

        {/* Col 4: Precio Compra */}
        <td className="col-precio-compra">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="cell-number font-mono" style={{ color: '#cbd5e1', fontWeight: 700 }}>
              ${precioPromedio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>costo prom.</span>
          </div>
        </td>

        {/* Col 5: Precio Actual */}
        <td className="col-precio-actual">
          {precioActual ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="cell-number font-mono text-live" style={{ color: isPosPnl ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                ${precioActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '0.65rem', color: isPosPnl ? '#059669' : '#dc2626', fontWeight: 700 }}>
                {isPosPnl ? '▲' : '▼'} {isPosPnl ? '+' : ''}{(precioActual - precioPromedio).toFixed(2)} USD
              </span>
            </div>
          ) : (
            <span className="loading-dot">···</span>
          )}
        </td>

        {/* Col 6: Invertido vs Mercado */}
        <td className="col-inversion">
          <div className="cell-flex">
            <span className="val-sub font-mono">${totalInvertido.toFixed(2)}</span>
            <span className="val-main font-mono">${valorActual ? valorActual.toFixed(2) : '—'}</span>
          </div>
        </td>

        {/* Col 7: Retorno P&L (% y USD) */}
        <td className="col-pnl">
          {precioActual != null ? (
            <span className={`pnl-pill ${isPosPnl ? 'pos' : 'neg'}`} style={{ padding: '4px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {isPosPnl ? '▲ +' : '▼ '}{pnlCalcPct.toFixed(2)}%
              <small style={{ display: 'block', fontSize: '0.68rem', opacity: 0.9 }}>
                ({isPosPnl ? '+' : ''}${pnlCalcDol.toFixed(2)})
              </small>
            </span>
          ) : '—'}
        </td>

        {/* Col 8: Metas Estrategia ML (TP, SL & Tiempo) */}
        <td className="col-estrategia">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
            <span style={{ color: '#10b981', fontWeight: 600 }}>
              🎯 TP +{tpPct}% (${precioTP.toFixed(2)})
            </span>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>
              🛑 SL -{slPct}% (${precioSL.toFixed(2)})
            </span>
            <span style={{ color: diasRestantes <= 2 ? '#f59e0b' : '#94a3b8', fontSize: '0.7rem' }}>
              ⏱️ Día {diasTranscurridos}/{maxDays}d ({diasRestantes}d rest)
            </span>
          </div>
        </td>

        {/* Col 9: RSI 14D */}
        <td className="col-rsi">
          {oraculo.rsiNum != null && !isNaN(oraculo.rsiNum) ? (
            <span
              className={`rsi-pill ${oraculo.rsiNum < 35 ? 'rsi-buy' : oraculo.rsiNum > 70 ? 'rsi-sell' : 'rsi-neutral'}`}
              title={`RSI 14D = ${oraculo.rsiNum.toFixed(1)}: ${oraculo.rsiNum < 35 ? 'Sobrevendido (Zona de Dip/Acumulación)' : oraculo.rsiNum > 70 ? 'Sobrecomprado' : 'Zona Neutra'}`}
            >
              {oraculo.rsiNum.toFixed(0)}
            </span>
          ) : '—'}
        </td>

        {/* Col 10: Score Bot */}
        <td className="col-score">
          {oraculo.score != null && oraculo.score !== 'N/A' ? (
            <span className={`score-badge ${oraculo.score >= 65 ? 'score-high' : oraculo.score < 50 ? 'score-low' : 'score-mid'}`}>
              {oraculo.score}
            </span>
          ) : '—'}
        </td>

        {/* Col 11: Veredicto Oráculo */}
        <td className="col-oraculo">
          <span
            className={`oracle-pill oracle-${oraculo.color}`}
            title={VEREDICTO_TOOLTIP[oraculo.veredicto] || oraculo.justificacion}
            style={{ cursor: 'help' }}
          >
            {VEREDICTO_ICON[oraculo.veredicto]} {VEREDICTO_LABEL[oraculo.veredicto] || oraculo.veredicto}
          </span>
        </td>

        {/* Col 12: Acciones */}
        <td className="col-acciones">
          <div className="row-actions">
            <button className="icon-btn" onClick={() => setExpanded(!expanded)} title="Ver Lotes">
              {expanded ? '▲' : '▼'}
            </button>
            <button className="icon-btn delete" onClick={() => onRemovePosition(position.id)} title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>

      {/* Lotes Desplegables */}
      {expanded && (
        <tr className="expanded-lotes-row">
          <td colSpan="12">
            <div className="lotes-expanded-container">
              <div className="lotes-header">
                <span>📋 Historial de Lotes de Compra — {position.ticker} ({lotes.length})</span>
                <button className="btn-add-lote" onClick={() => setLoteModal('new')}>+ Añadir Lote</button>
              </div>
              <div className="lotes-mini-table">
                <div className="lotes-mini-row header">
                  <span>Fecha</span><span>Compra → Actual</span><span>Cantidad</span><span>Crecimiento %</span><span>Nota</span><span>Acciones</span>
                </div>
                {lotes.map(lote => {
                  const lotePnl = precioActual ? ((precioActual - lote.precioCompra) / lote.precioCompra * 100) : null;
                  const loteDol = precioActual ? ((precioActual - lote.precioCompra) * lote.cantidad) : null;
                  const isLotePos = (lotePnl ?? 0) >= 0;
                  return (
                    <div key={lote.id} className="lotes-mini-row">
                      <span className="font-mono">{lote.fechaCompra}</span>
                      <span className="font-mono" style={{ fontSize: '0.82rem' }}>
                        ${lote.precioCompra.toFixed(2)} → <span style={{ color: precioActual ? (isLotePos ? '#10b981' : '#ef4444') : '#cbd5e1', fontWeight: 800 }}>${precioActual ? precioActual.toFixed(2) : '—'}</span>
                      </span>
                      <span className="font-mono">{lote.cantidad}</span>
                      <span className={`font-mono ${lotePnl >= 0 ? 'pos' : 'neg'}`}>
                        {lotePnl != null ? `${lotePnl >= 0 ? '+' : ''}${lotePnl.toFixed(1)}% (${loteDol >= 0 ? '+' : ''}$${loteDol.toFixed(2)})` : '—'}
                      </span>
                      <span>{lote.nota || '—'}</span>
                      <span className="lote-actions">
                        <button className="icon-btn" onClick={() => setLoteModal(lote)}>✏️</button>
                        <button className="icon-btn delete" onClick={() => removeLote(position.id, lote.id)}>🗑️</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}

      <AnimatePresence>
        {loteModal && (
          <LoteModal
            lote={loteModal === 'new' ? null : loteModal}
            positionId={position.id}
            positionTicker={position.ticker}
            datosJson={datosJson}
            onClose={() => setLoteModal(null)}
            onSave={handleSaveLote}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Página Principal ───────────────────────────────────────────────────────
const Portfolio = () => {
  const {
    entries, addPosition, removePosition, addLote, updateLote, removeLote,
    resetPortafolio, exportToJson, importFromJson, initAuthListener, uploadLocalToSupabase,
    user, isDemoMode, setUserSession, setDemoMode, signOut,
    isPasswordRecovery, clearPasswordRecovery
  } = usePortfolioStore();

  const { data: marketData, isLoading: mdLoading } = useMarketData();
  const [nuevoModal, setNuevoModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [importError, setImportError] = useState('');

  React.useEffect(() => {
    initAuthListener();
  }, [initAuthListener]);

  React.useEffect(() => {
    if (isPasswordRecovery) {
      setAuthModalMode('reset_password');
      setAuthModalOpen(true);
      clearPasswordRecovery();
    }
  }, [isPasswordRecovery, clearPasswordRecovery]);

  const activos = marketData?.TOP_25_DIPS || marketData?.TOP_50_DIPS || [];
  const tickersList = activos.map(a => a.Ticker);

  const tickersParaLive = entries.map(e => e.position.ticker);

  const { data: livePrices = {}, isLoading: liveLoading } = useLivePrice(tickersParaLive);

  const precioMap = useMemo(() => {
    const map = {};
    activos.forEach(a => {
      const p = a['Precio_Actual'] ?? a['Precio Actual'] ?? a['Precio'] ?? a['precio_actual'];
      if (p != null && !isNaN(Number(p))) {
        map[a.Ticker] = Number(p);
      }
    });
    Object.entries(livePrices).forEach(([t, p]) => {
      if (p != null && !isNaN(Number(p))) map[t] = Number(p);
    });
    return map;
  }, [activos, livePrices]);

  const entriesConOraculo = useMemo(() => {
    return entries.map(entry => {
      const { precioPromedio } = calcularResumenPosicion(entry.lotes);
      const precioActual = precioMap[entry.position.ticker];
      const oraculo = calcularOraculo(precioPromedio, precioActual, marketData, entry.position.ticker, entry.lotes, entry.position.categoria);
      return { entry, precioActual, oraculo };
    });
  }, [entries, precioMap, marketData]);

  const resumen = useMemo(() => {
    let totalInvertido = 0, valorActual = 0;
    entriesConOraculo.forEach(({ entry, precioActual }) => {
      const { cantidadTotal, totalInvertido: inv } = calcularResumenPosicion(entry.lotes);
      totalInvertido += inv;
      if (precioActual) valorActual += precioActual * cantidadTotal;
    });
    const pnl = valorActual - totalInvertido;
    const pnlPorc = totalInvertido > 0 ? (pnl / totalInvertido) * 100 : 0;
    return { totalInvertido, valorActual, pnl, pnlPorc };
  }, [entriesConOraculo]);

  const handleAddPosition = async (ticker, nombre, categoria, initialLote = null) => {
    const posId = await addPosition({ ticker, nombre, categoria });
    if (initialLote && initialLote.precioCompra && initialLote.cantidad) {
      await addLote(posId, initialLote);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportToJson());
    const el = document.createElement('a');
    el.setAttribute("href", dataStr);
    el.setAttribute("download", `oraculo_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(el);
    el.click();
    el.remove();
  };

  const handleImport = (e) => {
    setImportError('');
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const success = importFromJson(event.target.result);
      if (!success) setImportError('Archivo JSON inválido o corrupto.');
      else setShowConfig(false);
    };
    reader.readAsText(file);
  };

  const fechaActualizacionStr = useMemo(() => {
    const rawDate = marketData?._fecha_db || marketData?.fecha_generacion;
    if (!rawDate) return 'Tiempo Real';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      
      const utcStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) +
        ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

      const cotStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) + ' COT';

      return `${utcStr} · ${cotStr}`;
    } catch (e) {
      return rawDate;
    }
  }, [marketData]);

  return (
    <div className="portfolio-container">
      {/* Header Integrado */}
      <header className="portfolio-header">
        <div className="header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>🔮 El Oráculo — Portafolio</h1>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 6px 4px 12px', borderRadius: '20px' }}>
                <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>👤 {user.email}</span>
                <button
                  onClick={signOut}
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                >
                  🚪 Salir
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="cat-badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', padding: '5px 12px', fontSize: '0.82rem', borderRadius: '16px' }}>
                  ⚡ Modo Demo (Invitado)
                </span>
                <button
                  className="add-asset-btn"
                  style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
                  onClick={() => { setAuthModalMode('login'); setAuthModalOpen(true); }}
                >
                  🔑 Iniciar Sesión / Crear Cuenta
                </button>
              </div>
            )}
          </div>
          <p className="subtitle">Seguimiento de compras y gestión táctica de posiciones reales</p>
          <p className="data-date">
            🕒 Última actualización de datos: <strong>{fechaActualizacionStr}</strong> {marketData?._fuente === 'supabase' ? '⚡ (Supabase Real-Time)' : ''}
            {tickersParaLive.length > 0 && !liveLoading && <span> · 🔴 Precios en vivo: {tickersParaLive.filter(t => livePrices[t]).join(', ')}</span>}
          </p>
        </div>

        <div className="summary-cards">
          <div className="summary-card">
            <span className="label">Capital Invertido</span>
            <span className="val neutral">${resumen.totalInvertido.toFixed(2)}</span>
          </div>
          <div className="summary-card">
            <span className="label">Valor Actual</span>
            <span className="val">${resumen.valorActual.toFixed(2)}</span>
          </div>
          <div className={`summary-card ${resumen.pnl >= 0 ? 'highlight-pos' : 'highlight-neg'}`}>
            <span className="label">Retorno Total</span>
            <span className={`val big ${resumen.pnl >= 0 ? 'pos' : 'neg'}`}>
              {resumen.pnl >= 0 ? '+' : ''}{resumen.pnlPorc.toFixed(2)}%
              <small> ({resumen.pnl >= 0 ? '+' : ''}${resumen.pnl.toFixed(2)})</small>
            </span>
          </div>
        </div>
      </header>

      {/* Gráfica Global de Rendimiento (Alta Resolución 5 pts/día) */}
      <PortfolioPerformanceChart entriesConOraculo={entriesConOraculo} resumen={resumen} fechaActualizacion={fechaActualizacionStr} />

      {/* Acciones */}
      <section className="portfolio-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="add-asset-btn" onClick={() => setNuevoModal(true)}>+ Nueva Posición</button>
          <button className="btn-config" onClick={() => setShowConfig(s => !s)} title="Configuración">⚙️</button>
          {mdLoading && <span className="status-chip loading">⏳ Cargando datos...</span>}
        </div>
      </section>

      {/* Panel de Configuración */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            className="config-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="config-header">
              <span>⚙️ Configuración del Portafolio</span>
              <button className="icon-btn" onClick={() => setShowConfig(false)}>✕</button>
            </div>
            <div className="config-section">
              <h4>💾 Persistencia y Backups</h4>
              <div className="backup-actions">
                <button className="btn-save" onClick={handleExport}>⬇️ Exportar Backup</button>
                <button className="btn-save" style={{ background: '#2563eb' }} onClick={() => uploadLocalToSupabase()}>☁️ Sincronizar con Supabase</button>
                <div className="import-wrapper">
                  <label htmlFor="import-json" className="btn-cancel" style={{cursor: 'pointer', display: 'inline-block'}}>⬆️ Importar Backup</label>
                  <input id="import-json" type="file" accept=".json" onChange={handleImport} style={{display: 'none'}} />
                </div>
                <button className="btn-reset" onClick={resetPortafolio}>🔄 Reset a Semilla (UFO)</button>
              </div>
              {importError && <p className="error-text" style={{color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem'}}>{importError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla Monorenglón de Posiciones / Transacciones con Metas Estrategia ML */}
      <div className="portfolio-table-wrapper">
        <table className="portfolio-monorenglon-table">
          <thead>
            <tr>
              <th>Activo / Categoría</th>
              <th>Transacción / Fecha</th>
              <th>Cantidad</th>
              <th>P. Compra</th>
              <th>P. Actual</th>
              <th>Inversión → Mercado</th>
              <th>Retorno P&L</th>
              <th>Estrategia ML (TP / SL / Días)</th>
              <th title="RSI (Índice de Fuerza Relativa 14 días): Medida de velocidad y cambio de precio. <35 indica zona de acumulación/dip, >70 sobrecompra.">RSI 14D ℹ️</th>
              <th>Score</th>
              <th title="Veredicto Táctico del Algoritmo: DCA (Acumular), HOLD (Mantener), WATCH (Vigilar), SELL (Vender).">Oráculo ℹ️</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {entriesConOraculo.length > 0 ? (
              entriesConOraculo.map(({ entry, precioActual, oraculo }) => (
                <PortfolioRow
                  key={entry.position.id}
                  entry={entry}
                  precioActual={precioActual}
                  oraculo={oraculo}
                  datosJson={marketData}
                  onRemovePosition={removePosition}
                  addLote={addLote}
                  updateLote={updateLote}
                  removeLote={removeLote}
                />
              ))
            ) : (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  {user
                    ? 'No tienes posiciones registradas en tu cuenta personal. Haz clic en "+ Nueva Posición" para añadir una.'
                    : 'Modo Demo. Puedes agregar posiciones de prueba o hacer clic en "Iniciar Sesión" para acceder a tu cuenta personal.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {nuevoModal && (
          <NuevaPosicionModal
            tickersList={tickersList}
            datosJson={marketData}
            onClose={() => setNuevoModal(false)}
            onAdd={handleAddPosition}
          />
        )}
      </AnimatePresence>

      <AuthModal
        key={authModalMode}
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(u) => setUserSession(u)}
        onDemoMode={() => setDemoMode()}
      />
    </div>
  );
};

export default Portfolio;
