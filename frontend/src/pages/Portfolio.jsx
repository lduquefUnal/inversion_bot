import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePortfolioStore, calcularResumenPosicion } from '../store/usePortfolioStore';
import { useMarketData } from '../hooks/useMarketData';
import { useLivePrice } from '../hooks/useLivePrice';
import './Portfolio.css';

// ─── Oráculo: métricas y umbrales ──────────────────────────────────────────
// COMPRAR (DCA añadir):  RSI < 35, Score > 65, Drawdown > -30%, Tendencia sana
// MANTENER (HOLD):       sin señales negativas activas
// VIGILAR (WATCH):       1-2 señales negativas
// VENDER (SELL):         3+ señales O RSI > 76 O ganancia personal > 50%
const UMBRALES = {
  RSI_SELL:          72,   // sobrecampra fuerte → señal de venta
  RSI_BUY:           35,   // sobrevendido → señal de compra DCA
  GANANCIA_SELL:     50,   // % ganancia personal → tomar ganancias
  GANANCIA_WATCH:    35,   // % ganancia → empezar a vigilar
  SCORE_MIN:         50,   // score bot mínimo aceptable
  CAMBIO5D_SELL:    -8,    // caída semanal acelerada
  SEÑALES_SELL:      3,    // mínimo señales para SELL
};

const calcularOraculo = (precioPromedio, precioActual, datosJson, ticker) => {
  if (!precioActual || !precioPromedio) {
    return { veredicto: 'SIN_DATA', color: 'nodata', señales: [], recomendacion: null, justificacion: 'Precio actual no disponible.' };
  }

  const activos = datosJson?.TOP_25_DIPS || datosJson?.TOP_50_DIPS || [];
  const mercado  = activos.find(a => a.Ticker === ticker);
  const gananciaPorc = ((precioActual - precioPromedio) / precioPromedio) * 100;

  const señalesVenta = [];
  const señalesCompra = [];
  let rsiNum = null, score = null, cambio5D = null;

  if (mercado) {
    rsiNum  = parseFloat(mercado['RSI 14D']);
    score   = mercado['Score_Total'];
    cambio5D = mercado['Cambio 5D %'];
    const tendencia = mercado['Tendencias'] || '';
    const drawdown  = mercado['Drawdown 52W %'];

    // Señales de venta
    if (rsiNum > UMBRALES.RSI_SELL)       señalesVenta.push(`RSI ${rsiNum.toFixed(0)} (sobrecompra)`);
    if (score !== 'N/A' && score < UMBRALES.SCORE_MIN) señalesVenta.push(`Score bajo (${score})`);
    if (tendencia.includes('Bajista') || tendencia.includes('Cuchillo')) señalesVenta.push('Tendencia bajista');
    if (cambio5D < UMBRALES.CAMBIO5D_SELL) señalesVenta.push(`Caída 5D: ${cambio5D}%`);

    // Señales de compra DCA
    if (rsiNum < UMBRALES.RSI_BUY) señalesCompra.push(`RSI ${rsiNum.toFixed(0)} (pánico/sobrevendido)`);
    if (score !== 'N/A' && score > 65)  señalesCompra.push(`Score alto (${score})`);
    if (drawdown < -30)                 señalesCompra.push(`Dip agresivo (${drawdown}% bajó 52W)`);
    if (!tendencia.includes('Bajista')) señalesCompra.push('Tendencia sana');
  }

  // Señal personal de ganancia
  if (gananciaPorc > UMBRALES.GANANCIA_SELL) señalesVenta.push(`Ganancia personal +${gananciaPorc.toFixed(1)}%`);
  else if (gananciaPorc > UMBRALES.GANANCIA_WATCH) señalesVenta.push(`Ganancia +${gananciaPorc.toFixed(1)}% (vigilar)`);

  let veredicto, color, justificacion, recomendacion;
  if (señalesVenta.length >= UMBRALES.SEÑALES_SELL || rsiNum > 76 || gananciaPorc > UMBRALES.GANANCIA_SELL) {
    veredicto = 'SELL'; color = 'sell'; recomendacion = 'vender';
    justificacion = `🔴 ${señalesVenta.join(' · ')}. Considera salida estratégica.`;
  } else if (señalesVenta.length >= 1) {
    veredicto = 'WATCH'; color = 'watch'; recomendacion = 'vigilar';
    justificacion = `🟡 ${señalesVenta.join(' · ')}. Monitorear de cerca.`;
  } else if (señalesCompra.length >= 2) {
    veredicto = 'DCA'; color = 'dca'; recomendacion = 'añadir';
    justificacion = `💎 ${señalesCompra.join(' · ')}. Buena zona de acumulación DCA.`;
  } else {
    veredicto = 'HOLD'; color = 'hold'; recomendacion = 'mantener';
    justificacion = `🟢 Sin señales de alerta. Estrategia DCA en curso.`;
  }

  return { veredicto, color, justificacion, recomendacion, señalesVenta, señalesCompra, gananciaPorc, rsiNum, score, cambio5D };
};

const VEREDICTO_ICON = { SELL: '🔴', WATCH: '🟡', HOLD: '🟢', DCA: '💎', SIN_DATA: '⚫' };

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
            <input name="nota" value={form.nota} onChange={handleChange} placeholder="ej: DCA abril, rebote técnico..." />
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
const NuevaPosicionModal = ({ tickersList, onClose, onAdd }) => {
  const [ticker, setTicker] = useState('');
  const [nombre, setNombre] = useState('');
  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-card" initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }} onClick={e => e.stopPropagation()}>
        <h2>🆕 Nueva Posición</h2>
        <p className="modal-sub">Primero define el activo. Luego añades las compras (lotes) individuales.</p>
        <div className="modal-form">
          <div className="form-group">
            <label>Ticker</label>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="ej: PLTR, BTC-USD, EC" list="tickers-list" />
            <datalist id="tickers-list">{tickersList.map(t => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="form-group">
            <label>Nombre del activo (opcional)</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Palantir Technologies" />
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="btn-save" disabled={!ticker} onClick={() => { onAdd(ticker, nombre); onClose(); }}>Continuar →</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Tabla de Lotes ─────────────────────────────────────────────────────────
const LotesTable = ({ lotes, positionId, precioActual, onAddLote, onEditLote, onRemoveLote }) => (
  <div className="lotes-section">
    <div className="lotes-header">
      <span>📋 Historial de Compras ({lotes.length})</span>
      <button className="btn-add-lote" onClick={onAddLote}>+ Añadir compra</button>
    </div>
    <div className="lotes-table">
      <div className="lotes-row header-row">
        <span>Fecha</span><span>Precio</span><span>Cantidad</span><span>P&L</span><span>Nota</span><span></span>
      </div>
      {lotes.map(lote => {
        const pnlPorc = precioActual ? ((precioActual - lote.precioCompra) / lote.precioCompra * 100) : null;
        const pnlDol = precioActual ? ((precioActual - lote.precioCompra) * lote.cantidad) : null;
        return (
          <div key={lote.id} className="lotes-row">
            <span className="lote-fecha">{lote.fechaCompra}</span>
            <span>${lote.precioCompra.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
            <span>{lote.cantidad}</span>
            <span className={pnlPorc != null ? (pnlPorc >= 0 ? 'pos' : 'neg') : ''}>
              {pnlPorc != null ? `${pnlPorc >= 0 ? '+' : ''}${pnlPorc.toFixed(1)}% (${pnlDol >= 0 ? '+' : ''}$${pnlDol?.toFixed(2)})` : '—'}
            </span>
            <span className="lote-nota">{lote.nota || '—'}</span>
            <span className="lote-actions">
              <button className="icon-btn" onClick={() => onEditLote(lote)} title="Editar">✏️</button>
              <button className="icon-btn delete" onClick={() => onRemoveLote(positionId, lote.id)} title="Eliminar">🗑️</button>
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Card Posición ──────────────────────────────────────────────────────────
const PositionCard = ({ entry, precioActual, oraculo, onRemovePosition, addLote, updateLote, removeLote }) => {
  const { position, lotes } = entry;
  const { precioPromedio, cantidadTotal, totalInvertido } = calcularResumenPosicion(lotes);
  const [expanded, setExpanded] = useState(false);
  const [loteModal, setLoteModal] = useState(null); // null | 'new' | lote-obj

  const valorActual = precioActual ? precioActual * cantidadTotal : null;
  const pnlDol = precioActual ? (precioActual - precioPromedio) * cantidadTotal : null;

  const handleSaveLote = useCallback((data) => {
    if (data.id) updateLote(position.id, data.id, data);
    else addLote(position.id, data);
  }, [position.id, addLote, updateLote]);

  return (
    <motion.div
      className={`portfolio-card oracle-${oraculo.color}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {/* Cabecera */}
      <div className="card-top">
        <div className="ticker-info">
          <h2><Link to={`/activo/${position.ticker}`} className="ticker-link">{position.ticker}</Link></h2>
          <span className="amount">{position.nombre} · {cantidadTotal.toFixed(6).replace(/\.?0+$/, '')} u.</span>
        </div>
        <div className="card-controls">
          <button className="icon-btn" onClick={() => setExpanded(e => !e)} title={expanded ? 'Cerrar lotes' : 'Ver lotes'}>
            {expanded ? '▲' : '📋'}
          </button>
          <button className="icon-btn delete" onClick={() => onRemovePosition(position.id)} title="Eliminar posición">🗑️</button>
        </div>
      </div>

      {/* Métricas agregadas */}
      <div className="card-metrics">
        <div className="metric">
          <span className="label">Precio Promedio</span>
          <span className="val">${precioPromedio.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
        </div>
        <div className="metric">
          <span className="label">Precio Actual</span>
          <span className="val live">
            {precioActual ? `$${precioActual.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : <span className="loading-dot">···</span>}
          </span>
        </div>
        <div className="metric">
          <span className="label">P&L Total</span>
          <span className={`val ${oraculo.gananciaPorc != null ? (oraculo.gananciaPorc >= 0 ? 'pos' : 'neg') : ''}`}>
            {oraculo.gananciaPorc != null ? `${oraculo.gananciaPorc >= 0 ? '+' : ''}${oraculo.gananciaPorc.toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className="metric">
          <span className="label">Valor Posición</span>
          <span className="val">{valorActual ? `$${valorActual.toFixed(2)}` : '—'}</span>
        </div>
        {pnlDol != null && (
          <div className="metric">
            <span className="label">Ganancia $</span>
            <span className={`val ${pnlDol >= 0 ? 'pos' : 'neg'}`}>{pnlDol >= 0 ? '+' : ''}${pnlDol.toFixed(2)}</span>
          </div>
        )}
        {oraculo.rsiNum != null && (
          <div className="metric">
            <span className="label">RSI 14D</span>
            <span className={`val ${oraculo.rsiNum > 70 ? 'neg' : oraculo.rsiNum < 35 ? 'pos' : ''}`}>
              {oraculo.rsiNum.toFixed(1)} {oraculo.rsiNum > 70 ? '⚠️' : oraculo.rsiNum < 35 ? '💎' : ''}
            </span>
          </div>
        )}
        {oraculo.score != null && oraculo.score !== 'N/A' && (
          <div className="metric">
            <span className="label">Score Bot</span>
            <span className={`val ${oraculo.score >= 65 ? 'pos' : oraculo.score < 50 ? 'neg' : ''}`}>{oraculo.score}</span>
          </div>
        )}
      </div>

      {/* Veredicto Oráculo */}
      <div className={`sell-oracle-badge ${oraculo.color}`}>
        <span className="oracle-icon">{VEREDICTO_ICON[oraculo.veredicto]}</span>
        <span className="oracle-label">EL ORÁCULO: {oraculo.veredicto}</span>
        {oraculo.recomendacion && (
          <span className="oracle-action">→ {oraculo.recomendacion.toUpperCase()}</span>
        )}
      </div>
      <p className="oracle-reason">{oraculo.justificacion}</p>

      {/* Lotes expandibles */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <LotesTable
              lotes={lotes}
              positionId={position.id}
              precioActual={precioActual}
              onAddLote={() => setLoteModal('new')}
              onEditLote={(l) => setLoteModal(l)}
              onRemoveLote={removeLote}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
    </motion.div>
  );
};

// ─── Página Principal ───────────────────────────────────────────────────────
const Portfolio = () => {
  const { entries, addPosition, removePosition, addLote, updateLote, removeLote, resetPortafolio, limpiarPortafolio, exportToJson, importFromJson } = usePortfolioStore();
  const { data: marketData, isLoading: mdLoading } = useMarketData();
  const [nuevoModal, setNuevoModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [confirmReset, setConfirmReset] = useState(null); // null | 'reset' | 'clean'
  const [importError, setImportError] = useState('');


  const activos = marketData?.TOP_25_DIPS || marketData?.TOP_50_DIPS || [];
  const tickersList = activos.map(a => a.Ticker);

  // Identificar tickers SIN precio en mercado.json → pedir en vivo al Flask
  const tickersEnJson = new Set(activos.map(a => a.Ticker));
  const tickersParaLive = entries
    .map(e => e.position.ticker)
    .filter(t => !tickersEnJson.has(t));

  const { data: livePrices = {}, isLoading: liveLoading } = useLivePrice(tickersParaLive);

  // Fuente de precio por ticker (para mostrarlo en UI)
  const fuentePrecio = useMemo(() => {
    const map = {};
    activos.forEach(a => { map[a.Ticker] = 'scan'; });
    Object.keys(livePrices).forEach(t => { if (livePrices[t] != null) map[t] = 'live'; });
    return map;
  }, [activos, livePrices]);

  // Mapa unificado: ticker → precioActual (json tiene prioridad, luego live)
  const precioMap = useMemo(() => {
    const map = {};
    activos.forEach(a => { map[a.Ticker] = a['Precio Actual']; });
    Object.entries(livePrices).forEach(([t, p]) => { if (p != null) map[t] = p; });
    return map;
  }, [activos, livePrices]);

  // Computar oráculos
  const entriesConOraculo = useMemo(() => {
    return entries.map(entry => {
      const { precioPromedio } = calcularResumenPosicion(entry.lotes);
      const precioActual = precioMap[entry.position.ticker];
      const oraculo = calcularOraculo(precioPromedio, precioActual, marketData, entry.position.ticker);
      return { entry, precioActual, oraculo };
    });
  }, [entries, precioMap, marketData]);

  // Resumen global
  const resumen = useMemo(() => {
    let totalInvertido = 0, valorActual = 0;
    entriesConOraculo.forEach(({ entry, precioActual, oraculo }) => {
      const { cantidadTotal, totalInvertido: inv } = calcularResumenPosicion(entry.lotes);
      totalInvertido += inv;
      if (precioActual) valorActual += precioActual * cantidadTotal;
    });
    const pnl = valorActual - totalInvertido;
    const pnlPorc = totalInvertido > 0 ? (pnl / totalInvertido) * 100 : 0;
    return { totalInvertido, valorActual, pnl, pnlPorc };
  }, [entriesConOraculo]);

  const alertas = entriesConOraculo.filter(({ oraculo }) => ['SELL', 'WATCH'].includes(oraculo.veredicto));
  const oportunidades = entriesConOraculo.filter(({ oraculo }) => oraculo.veredicto === 'DCA');

  const handleAddPosition = (ticker, nombre) => {
    const id = addPosition({ ticker, nombre });
    setAddingLoteForId(id);
    // auto-abrir form de primer lote después de crear
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
      else setShowConfig(false); // Cierra el modal en éxito
    };
    reader.readAsText(file);
  };

  return (

    <div className="portfolio-container">

      {/* Header */}
      <header className="portfolio-header">
        <div className="header-info">
          <h1>🔮 El Oráculo</h1>
          <p className="subtitle">Portafolio privado · Precios mixtos (JSON diario + Live API)</p>
          {marketData?.fecha_generacion && (
            <p className="data-date">
              📡 Escáner: {marketData.fecha_generacion}
              {tickersParaLive.length > 0 && !liveLoading && <span> · 🔴 Live: {tickersParaLive.filter(t => livePrices[t]).join(', ')}</span>}
              {liveLoading && <span> · ⏳ Cargando precios vivos...</span>}
              {tickersParaLive.filter(t => !livePrices[t] && !liveLoading).length > 0 && (
                <span style={{color:'#555'}}> · Offline: {tickersParaLive.filter(t => !livePrices[t] && !liveLoading).join(', ')}</span>
              )}
            </p>
          )}
        </div>
        <div className="summary-cards">
          <div className="summary-card">
            <span className="label">Invertido</span>
            <span className="val neutral">${resumen.totalInvertido.toFixed(2)}</span>
          </div>
          <div className="summary-card">
            <span className="label">Valor Actual</span>
            <span className="val">${resumen.valorActual.toFixed(2)}</span>
          </div>
          <div className={`summary-card ${resumen.pnl >= 0 ? 'highlight-pos' : 'highlight-neg'}`}>
            <span className="label">P&L Total</span>
            <span className={`val big ${resumen.pnl >= 0 ? 'pos' : 'neg'}`}>
              {resumen.pnl >= 0 ? '+' : ''}{resumen.pnlPorc.toFixed(2)}%
              <small> ({resumen.pnl >= 0 ? '+' : ''}${resumen.pnl.toFixed(2)})</small>
            </span>
          </div>
        </div>
      </header>

      {/* Alertas y Oportunidades */}
      {(alertas.length > 0 || oportunidades.length > 0) && (
        <div className="signals-zone">
          {alertas.length > 0 && (
            <div className="signal-group danger">
              <h3>⚡ Alertas ({alertas.length})</h3>
              {alertas.map(({ entry, oraculo }) => (
                <div key={entry.position.id} className={`signal-item ${oraculo.color}`}>
                  <strong>{entry.position.ticker}</strong>
                  <span className="signal-verdict">{VEREDICTO_ICON[oraculo.veredicto]} {oraculo.veredicto}</span>
                  <span className="signal-reason">{oraculo.justificacion}</span>
                </div>
              ))}
            </div>
          )}
          {oportunidades.length > 0 && (
            <div className="signal-group opportunity">
              <h3>💎 Oportunidades DCA ({oportunidades.length})</h3>
              {oportunidades.map(({ entry, oraculo }) => (
                <div key={entry.position.id} className="signal-item dca">
                  <strong>{entry.position.ticker}</strong>
                  <span className="signal-verdict">💎 DCA</span>
                  <span className="signal-reason">{oraculo.justificacion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leyenda del Oráculo */}
      <details className="oracle-legend">
        <summary>📖 ¿Cómo funciona el Oráculo? (ver métricas y umbrales)</summary>
        <div className="legend-grid">
          <div><strong>🔴 SELL</strong> — 3+ señales activas O RSI &gt; 76 O ganancia personal &gt; 50%</div>
          <div><strong>🟡 WATCH</strong> — 1-2 señales: RSI &gt; 72, tendencia bajista, caída semanal &lt; -8%, ganancia &gt; 35%</div>
          <div><strong>🟢 HOLD</strong> — Sin señales de alerta. Estrategia Smart DCA activa.</div>
          <div><strong>💎 DCA</strong> — RSI &lt; 35 (pánico) + Score bot &gt; 65 + Drawdown &gt; -30%. Zona de acumulación.</div>
          <div className="legend-note">El Score del Bot (0-100) mide calidad del Dip: FCF, P/E, RSI, distancia a SMA200 y sentimiento social (Reddit/Polymarket). Mayor score = mejor dip.</div>
        </div>
      </details>

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
              <p className="config-note">
                Tus posiciones se guardan en este navegador. Para usarlas en otro dispositivo o asegurar tus datos, usa estas herramientas:
              </p>
              <div className="backup-actions">
                <button className="btn-save" onClick={handleExport}>⬇️ Exportar Backup</button>
                <div className="import-wrapper">
                  <label htmlFor="import-json" className="btn-cancel" style={{cursor: 'pointer', display: 'inline-block'}}>⬆️ Importar Backup</label>
                  <input id="import-json" type="file" accept=".json" onChange={handleImport} style={{display: 'none'}} />
                </div>
              </div>
              {importError && <p className="error-text" style={{color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem'}}>{importError}</p>}
            </div>


            <div className="config-section">
              <h4>📡 Fuente de Precios por Activo</h4>
              <div className="price-source-table">
                {entries.map(e => (
                  <div key={e.position.id} className="price-source-row">
                    <strong>{e.position.ticker}</strong>
                    {fuentePrecio[e.position.ticker] === 'scan' && (
                      <span className="source-badge scan">📡 Escáner diario (JSON)</span>
                    )}
                    {fuentePrecio[e.position.ticker] === 'live' && (
                      <span className="source-badge live">🔴 Precio vivo (API)</span>
                    )}
                    {!fuentePrecio[e.position.ticker] && (
                      <span className="source-badge offline">⚫ Sin precio</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="config-section danger-zone">
              <h4>⚠️ Zona de Reinicio</h4>
              {confirmReset === null && (
                <div className="config-btns">
                  <button className="btn-reset" onClick={() => setConfirmReset('reset')}>
                    🔄 Volver al seed inicial (mis posiciones dummy)
                  </button>
                  <button className="btn-clean" onClick={() => setConfirmReset('clean')}>
                    🗑️ Borrar TODO y empezar de cero
                  </button>
                </div>
              )}
              {confirmReset && (
                <div className="confirm-action">
                  <p>¿Estás seguro? {confirmReset === 'reset' ? 'Se recargarán las posiciones del seed.' : 'Se borrarán TODAS las posiciones.'}</p>
                  <div>
                    <button className="btn-cancel" onClick={() => setConfirmReset(null)}>Cancelar</button>
                    <button
                      className="btn-delete"
                      onClick={() => {
                        if (confirmReset === 'reset') resetPortafolio();
                        else limpiarPortafolio();
                        setConfirmReset(null);
                        setShowConfig(false);
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className="portfolio-grid">
        <AnimatePresence>
          {entriesConOraculo.map(({ entry, precioActual, oraculo }) => (
            <PositionCard
              key={entry.position.id}
              entry={entry}
              precioActual={precioActual}
              oraculo={oraculo}
              onRemovePosition={removePosition}
              addLote={addLote}
              updateLote={updateLote}
              removeLote={removeLote}
            />
          ))}
        </AnimatePresence>
        {entries.length === 0 && (
          <div className="empty-state">
            <p>🪐 No tienes posiciones. ¡Añade tu primera!</p>
            <button className="add-asset-btn" onClick={() => setNuevoModal(true)}>+ Nueva Posición</button>
          </div>
        )}
      </div>

      {/* Modales globales */}
      <AnimatePresence>
        {nuevoModal && (
          <NuevaPosicionModal
            tickersList={tickersList}
            onClose={() => setNuevoModal(false)}
            onAdd={handleAddPosition}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Portfolio;
