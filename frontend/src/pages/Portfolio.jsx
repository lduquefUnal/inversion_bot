import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePortfolioStore, calcularResumenPosicion } from '../store/usePortfolioStore';
import { useMarketData } from '../hooks/useMarketData';
import { useLivePrice } from '../hooks/useLivePrice';
import './Portfolio.css';

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

const CATEGORY_PARAMS = {
  "🎯 Sweet Spot":          { tpPct: 15, slPct: 8,  maxDays: 14, label: "Sweet Spot", emoji: "🎯" },
  "🔥 Cazador Dips":        { tpPct: 12, slPct: 8,  maxDays: 21, label: "Cazador Dips", emoji: "🔥" },
  "⚡ Recup. Rápida":       { tpPct: 15, slPct: 5,  maxDays: 7,  label: "Recup. Rápida", emoji: "⚡" },
  "⚠️ Cuchillos Cayendo":   { tpPct: 5,  slPct: 5,  maxDays: 7,  label: "Cuchillos Cayendo", emoji: "⚠️" }
};

const calcularOraculo = (precioPromedio, precioActual, datosJson, ticker, lotes = [], posCategory = null) => {
  if (!precioActual || !precioPromedio) {
    return { veredicto: 'SIN_DATA', color: 'nodata', señales: [], recomendacion: null, justificacion: 'Precio actual no disponible.' };
  }

  const activos = datosJson?.TOP_25_DIPS || datosJson?.TOP_50_DIPS || [];
  const mercado  = activos.find(a => a.Ticker === ticker);
  const gananciaPorc = ((precioActual - precioPromedio) / precioPromedio) * 100;

  const catNombre = posCategory || mercado?.Categoria || "🎯 Sweet Spot";
  const params = CATEGORY_PARAMS[catNombre] || CATEGORY_PARAMS["🎯 Sweet Spot"];

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
    rsiNum  = parseFloat(mercado['RSI 14D']);
    score   = mercado['Score_Total'];
    cambio5D = mercado['Cambio 5D %'];
    const tendencia = mercado['Tendencias'] || '';
    const drawdown  = mercado['Drawdown 52W %'];

    if (rsiNum > UMBRALES.RSI_SELL)       señalesVenta.push(`RSI ${rsiNum.toFixed(0)}`);
    if (score !== 'N/A' && score < UMBRALES.SCORE_MIN) señalesVenta.push(`Score ${score}`);
    if (tendencia.includes('Bajista') || tendencia.includes('Cuchillo')) señalesVenta.push('Tendencia bajista');
    if (cambio5D < UMBRALES.CAMBIO5D_SELL) señalesVenta.push(`Caída 5D: ${cambio5D}%`);

    if (rsiNum < UMBRALES.RSI_BUY) señalesCompra.push(`RSI ${rsiNum.toFixed(0)}`);
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

// ─── Componente Gráfica Global de Rendimiento ──────────────────────────────
const PortfolioPerformanceChart = ({ entriesConOraculo, resumen }) => {
  const chartPoints = useMemo(() => {
    if (!resumen || resumen.totalInvertido <= 0) return [];
    
    // Extraer todos los lotes reales ordenados cronológicamente por fecha de compra
    const allLotes = [];
    (entriesConOraculo || []).forEach(({ entry, precioActual }) => {
      (entry.lotes || []).forEach(l => {
        const cost = Number(l.precioCompra) * Number(l.cantidad);
        const valNow = (precioActual ? Number(precioActual) : Number(l.precioCompra)) * Number(l.cantidad);
        allLotes.push({
          date: l.fechaCompra || new Date().toISOString().split('T')[0],
          cost,
          valNow,
          ticker: entry.position.ticker,
        });
      });
    });

    if (allLotes.length === 0) return [];
    allLotes.sort((a, b) => new Date(a.date) - new Date(b.date));

    const startDate = new Date(allLotes[0].date);
    const endDate = new Date();
    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const numPoints = Math.min(14, Math.max(5, totalDays + 1));
    const points = [];

    // Incluir un punto inicial en cero justo un día antes del primer lote
    const prevDay = new Date(startDate.getTime() - 86400000);
    const prevDayStr = prevDay.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    points.push({ date: prevDayStr, value: 0 });

    for (let i = 0; i < numPoints; i++) {
      const pRatio = i / (numPoints - 1);
      const currentTimeMs = startDate.getTime() + pRatio * (endDate.getTime() - startDate.getTime());
      const currentDate = new Date(currentTimeMs);

      // Sumar lotes comprados hasta esta fecha
      let totalCostAtDate = 0;
      let totalValAtDate = 0;

      allLotes.forEach(l => {
        const lDate = new Date(l.date);
        if (lDate <= currentDate) {
          totalCostAtDate += l.cost;
          // Interpolación suave del valor del activo desde su costo de compra hasta su precio actual hoy
          const activeDays = Math.max(1, (endDate - lDate) / (1000 * 60 * 60 * 24));
          const elapsedDays = Math.max(0, (currentDate - lDate) / (1000 * 60 * 60 * 24));
          const progress = Math.min(1, elapsedDays / activeDays);
          totalValAtDate += l.cost + (l.valNow - l.cost) * progress;
        }
      });

      const dateStr = currentDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      points.push({ date: dateStr, value: totalValAtDate });
    }

    return points;
  }, [entriesConOraculo, resumen]);

  if (chartPoints.length === 0) return null;

  const minVal = Math.min(...chartPoints.map(p => p.value));
  const maxVal = Math.max(...chartPoints.map(p => p.value));
  const range = (maxVal - minVal) || 1;
  
  const svgWidth = 800;
  const svgHeight = 160;
  const padding = 20;
  
  const pathD = chartPoints.map((p, idx) => {
    const x = padding + (idx / (chartPoints.length - 1)) * (svgWidth - padding * 2);
    const y = svgHeight - padding - ((p.value - minVal) / range) * (svgHeight - padding * 2);
    return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const areaD = `${pathD} L ${svgWidth - padding} ${svgHeight} L ${padding} ${svgHeight} Z`;
  const isPos = resumen.pnl >= 0;
  const strokeColor = isPos ? '#10b981' : '#ef4444';
  const gradId = isPos ? 'grad-pos' : 'grad-neg';

  return (
    <div className="portfolio-global-chart-card">
      <div className="chart-card-header">
        <div>
          <h3>📈 Comportamiento Global del Portafolio</h3>
          <p className="chart-sub">Valor de mercado conjunto y trayectoria acumulada</p>
        </div>
        <div className="chart-stats">
          <div className="chart-stat-item">
            <span className="stat-label">Patrimonio Actual</span>
            <span className="stat-val">${resumen.valorActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="chart-stat-item">
            <span className="stat-label">Rendimiento Total</span>
            <span className={`stat-val ${isPos ? 'pos' : 'neg'}`}>
              {isPos ? '+' : ''}{resumen.pnlPorc.toFixed(2)}% ({isPos ? '+' : ''}${resumen.pnl.toFixed(2)})
            </span>
          </div>
        </div>
      </div>
      
      <div className="svg-chart-container">
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
          
          <path d={areaD} fill={`url(#${gradId})`} />
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          
          {chartPoints.map((p, idx) => {
            const x = padding + (idx / (chartPoints.length - 1)) * (svgWidth - padding * 2);
            const y = svgHeight - padding - ((p.value - minVal) / range) * (svgHeight - padding * 2);
            return (
              <circle key={idx} cx={x} cy={y} r={idx === chartPoints.length - 1 ? "5" : "3"} fill={strokeColor} />
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// ─── Modal Lote (Añadir / Editar) ──────────────────────────────────────────
const LoteModal = ({ lote, positionId, positionTicker, onClose, onSave }) => {
  const [form, setForm] = useState(lote || {
    precioCompra: '', cantidad: '', fechaCompra: new Date().toISOString().split('T')[0], nota: ''
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
        <h2>{lote ? '✏️ Editar compra' : `➕ Añadir compra — ${positionTicker}`}</h2>
        <p className="modal-sub">Cada compra se registra por separado para calcular tu precio promedio real.</p>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Precio de Compra (USD)</label>
              <input name="precioCompra" type="number" step="any" value={form.precioCompra} onChange={handleChange} placeholder="0.00" required />
            </div>
            <div className="form-group">
              <label>Cantidad</label>
              <input name="cantidad" type="number" step="any" value={form.cantidad} onChange={handleChange} placeholder="0.0000" required />
            </div>
          </div>
          <div className="form-group">
            <label>Fecha de Compra</label>
            <input name="fechaCompra" type="date" value={form.fechaCompra} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Nota (opcional)</label>
            <input name="nota" value={form.nota} onChange={handleChange} placeholder="ej: DCA julio, rebote técnico..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-save">💾 Guardar Compra</button>
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

  const handleTickerChange = (val) => {
    const uppercaseVal = val.toUpperCase();
    setTicker(uppercaseVal);
    const activos = datosJson?.TOP_25_DIPS || datosJson?.TOP_50_DIPS || [];
    const mercado = activos.find(a => a.Ticker === uppercaseVal);
    if (mercado && mercado.Categoria && CATEGORY_PARAMS[mercado.Categoria]) {
      setCategoria(mercado.Categoria);
      setAutoDetectado(true);
    } else {
      setAutoDetectado(false);
    }
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-card" initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }} onClick={e => e.stopPropagation()}>
        <h2>🆕 Nueva Posición</h2>
        <p className="modal-sub">Define el activo y asigna la categoría de estrategia óptima para sus TP, SL y Días.</p>
        <div className="modal-form">
          <div className="form-group">
            <label>Ticker</label>
            <input value={ticker} onChange={e => handleTickerChange(e.target.value)} placeholder="ej: UFO, PLTR, BTC-USD" list="tickers-list" />
            <datalist id="tickers-list">{tickersList.map(t => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="form-group">
            <label>Nombre del activo (opcional)</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Procure Space ETF" />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Categoría de Estrategia</span>
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
          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="btn-save" disabled={!ticker} onClick={() => { onAdd(ticker, nombre, categoria); onClose(); }}>Continuar →</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Tabla Monorenglón por Transacción / Posición ───────────────────────────
const PortfolioRow = ({ entry, precioActual, oraculo, onRemovePosition, addLote, updateLote, removeLote }) => {
  const { position, lotes } = entry;
  const { precioPromedio, cantidadTotal, totalInvertido } = calcularResumenPosicion(lotes);
  const [expanded, setExpanded] = useState(false);
  const [loteModal, setLoteModal] = useState(null);

  const valorActual = precioActual ? precioActual * cantidadTotal : null;
  const pnlCalcPct = (precioActual && precioPromedio) ? ((precioActual - precioPromedio) / precioPromedio * 100) : (oraculo.gananciaPorc ?? 0);
  const pnlCalcDol = (precioActual && precioPromedio) ? ((precioActual - precioPromedio) * cantidadTotal) : (oraculo.gananciaDol ?? 0);
  const isPosPnl = pnlCalcPct >= 0;

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

        {/* Col 8: RSI 14D */}
        <td className="col-rsi">
          {oraculo.rsiNum != null ? (
            <span className={`rsi-pill ${oraculo.rsiNum < 35 ? 'rsi-buy' : oraculo.rsiNum > 70 ? 'rsi-sell' : 'rsi-neutral'}`}>
              {oraculo.rsiNum.toFixed(0)} {oraculo.rsiNum < 35 ? '💎' : oraculo.rsiNum > 70 ? '⚠️' : ''}
            </span>
          ) : '—'}
        </td>

        {/* Col 9: Score Bot */}
        <td className="col-score">
          {oraculo.score != null && oraculo.score !== 'N/A' ? (
            <span className={`score-badge ${oraculo.score >= 65 ? 'score-high' : oraculo.score < 50 ? 'score-low' : 'score-mid'}`}>
              {oraculo.score}
            </span>
          ) : '—'}
        </td>

        {/* Col 10: Veredicto Oráculo */}
        <td className="col-oraculo">
          <span className={`oracle-pill oracle-${oraculo.color}`}>
            {VEREDICTO_ICON[oraculo.veredicto]} {oraculo.veredicto}
          </span>
        </td>

        {/* Col 11: Acciones */}
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
          <td colSpan="11">
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
  const { entries, addPosition, removePosition, addLote, updateLote, removeLote, resetPortafolio, limpiarPortafolio, exportToJson, importFromJson } = usePortfolioStore();
  const { data: marketData, isLoading: mdLoading } = useMarketData();
  const [nuevoModal, setNuevoModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [importError, setImportError] = useState('');

  const activos = marketData?.TOP_25_DIPS || marketData?.TOP_50_DIPS || [];
  const tickersList = activos.map(a => a.Ticker);

  const tickersEnJson = new Set(activos.map(a => a.Ticker));
  const tickersParaLive = entries
    .map(e => e.position.ticker)
    .filter(t => !tickersEnJson.has(t));

  const { data: livePrices = {}, isLoading: liveLoading } = useLivePrice(tickersParaLive);

  const precioMap = useMemo(() => {
    const map = {};
    activos.forEach(a => { map[a.Ticker] = a['Precio Actual']; });
    Object.entries(livePrices).forEach(([t, p]) => { if (p != null) map[t] = p; });
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

  const handleAddPosition = (ticker, nombre, categoria) => {
    addPosition({ ticker, nombre, categoria });
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

  return (
    <div className="portfolio-container">
      {/* Header */}
      <header className="portfolio-header">
        <div className="header-info">
          <h1>🔮 El Oráculo — Portafolio</h1>
          <p className="subtitle">Seguimiento de compras y gestión táctica de posiciones reales</p>
          {marketData?.fecha_generacion && (
            <p className="data-date">
              📡 Escáner: {marketData.fecha_generacion}
              {tickersParaLive.length > 0 && !liveLoading && <span> · 🔴 Live: {tickersParaLive.filter(t => livePrices[t]).join(', ')}</span>}
            </p>
          )}
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

      {/* Gráfica Global de Rendimiento (Parte Superior) */}
      <PortfolioPerformanceChart entriesConOraculo={entriesConOraculo} resumen={resumen} />

      {/* Acciones */}
      <section className="portfolio-actions">
        <button className="add-asset-btn" onClick={() => setNuevoModal(true)}>+ Nueva Posición</button>
        <button className="btn-config" onClick={() => setShowConfig(s => !s)} title="Configuración">⚙️</button>
        {mdLoading && <span className="status-chip loading">⏳ Cargando datos...</span>}
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

      {/* Tabla Monorenglón de Posiciones / Transacciones */}
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
              <th>RSI 14D</th>
              <th>Score</th>
              <th>Oráculo</th>
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
                  onRemovePosition={removePosition}
                  addLote={addLote}
                  updateLote={updateLote}
                  removeLote={removeLote}
                />
              ))
            ) : (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No hay operaciones registradas desde la compra de UFO en adelante. Haz clic en "+ Nueva Posición" para añadir una.
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
    </div>
  );
};

export default Portfolio;
