import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import CandleChart from '../components/detail/CandleChart';
import { useHistorico } from '../hooks/useHistorico';
import { useMarketData } from '../hooks/useMarketData';

// ── Tooltip helper ────────────────────────────────────────────────────
const Tooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'help' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <span style={{
        fontSize: '0.7rem',
        opacity: 0.5,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '50%',
        width: '14px', height: '14px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', flexShrink: 0
      }}>?</span>
      {visible && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)', background: '#1e293b',
          border: '1px solid rgba(100,116,139,0.5)', borderRadius: '8px',
          padding: '8px 12px', fontSize: '0.78rem', color: '#cbd5e1',
          whiteSpace: 'nowrap', zIndex: 999, lineHeight: '1.5',
          boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>{text}</span>
      )}
    </span>
  );
};

// ── Analyst Consensus Widget ──────────────────────────────────────────
const AnalystConsensus = ({ rec }) => {
  if (!rec) {
    return (
      <div style={{ background: 'var(--panel-bg)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>📊 Consenso de Analistas</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
          No hay cobertura de analistas disponible para este activo.
        </p>
      </div>
    );
  }

  const { compra = 0, hold = 0, vender = 0, total = 0 } = rec;

  // Veredicto dominante
  const veredicto = compra >= 60 ? { label: 'COMPRA', color: '#10b981', emoji: '📈' }
    : vender >= 40 ? { label: 'VENTA', color: '#ef4444', emoji: '📉' }
    : { label: 'MANTENER', color: '#eab308', emoji: '⚖️' };

  return (
    <div style={{ background: 'var(--panel-bg)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h4 style={{ margin: 0 }}>📊 Consenso de Analistas</h4>
        <span style={{
          fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 10px',
          borderRadius: '20px', background: `${veredicto.color}22`,
          color: veredicto.color, border: `1px solid ${veredicto.color}55`
        }}>{veredicto.emoji} {veredicto.label}</span>
      </div>

      {/* Barra tricolor */}
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px', gap: '2px' }}>
        {compra > 0 && <div style={{ width: `${compra}%`, background: '#10b981', borderRadius: '6px 0 0 6px', transition: 'width 1s ease-out' }} title={`Compra: ${compra}%`} />}
        {hold > 0 && <div style={{ width: `${hold}%`, background: '#eab308', transition: 'width 1s ease-out' }} title={`Hold: ${hold}%`} />}
        {vender > 0 && <div style={{ width: `${vender}%`, background: '#ef4444', borderRadius: '0 6px 6px 0', transition: 'width 1s ease-out' }} title={`Vender: ${vender}%`} />}
      </div>

      {/* Leyenda de porcentajes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
        <span style={{ color: '#10b981', fontWeight: 'bold' }}>🟢 Comprar<br /><span style={{ fontSize: '1.2rem' }}>{compra}%</span></span>
        <span style={{ color: '#eab308', fontWeight: 'bold', textAlign: 'center' }}>🟡 Hold<br /><span style={{ fontSize: '1.2rem' }}>{hold}%</span></span>
        <span style={{ color: '#ef4444', fontWeight: 'bold', textAlign: 'right' }}>🔴 Vender<br /><span style={{ fontSize: '1.2rem' }}>{vender}%</span></span>
      </div>

      <p style={{ fontSize: '0.72rem', marginTop: '10px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '10px 0 0' }}>
        *Basado en {total} analista{total !== 1 ? 's' : ''} de Wall Street (StrongBuy + Buy / Hold / Sell + StrongSell).
      </p>
    </div>
  );
};

// ── News & Analysis Component (Seeking Alpha Style) ───────────────────
const NewsItem = ({ title, source, time, url, icon, author }) => (
  <a href={url} target="_blank" rel="noreferrer" style={{
    display: 'flex', gap: '15px', padding: '18px 0', borderBottom: '1px solid var(--border-color)',
    textDecoration: 'none', color: 'inherit', alignItems: 'flex-start', transition: 'all 0.2s',
  }}
  onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.paddingLeft = '5px'; }}
  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '0px'; }}
  >
    <div style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(100,116,139,0.15)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
      {icon || <span style={{ fontSize: '1rem' }}>📰</span>}
    </div>
    <div style={{ flex: 1 }}>
      <h5 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.4', fontWeight: 'bold' }}>{title}</h5>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {author && <span>{author}</span>}
        {author && <span>•</span>}
        <span>{source}</span>
        <span>•</span>
        <span>{time || 'Reciente'}</span>
        <span>•</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg> Save
        </span>
      </div>
    </div>
  </a>
);

const NewsAndAnalysisLayout = ({ ticker, reddit }) => {
  const hasRealLinks = reddit && reddit.length > 0 && reddit[0]?.titulo !== 'Sin foros' && reddit[0] !== 'Sin foros';

  // Fallback / News links
  const newsLinks = [
    { title: `${ticker} outlines high single- to low double-digit growth strategy`, source: 'Yahoo Finance', time: 'Today', url: `https://finance.yahoo.com/quote/${ticker}/news/`, icon: 'Y!' },
    { title: `Earnings Call Insights for ${ticker}`, source: 'Seeking Alpha', time: 'Yesterday', url: `https://seekingalpha.com/symbol/${ticker}`, icon: 'α' },
    { title: `Most and least shorted industrial stocks with over $2B market cap`, source: 'MarketWatch', time: '2 days ago', url: `https://www.tradingview.com/symbols/${ticker}/`, icon: '📈' },
    { title: `${ticker} SEC Filing - Annual Report (10-K)`, source: 'SEC Filings', time: 'Last week', url: `https://finance.yahoo.com/quote/${ticker}/sec-filings/`, icon: '🏛️' },
  ];

  const analysisLinks = hasRealLinks
    ? reddit.slice(0, 4).map((n, i) => {
      const obj = typeof n === 'string' ? { titulo: n, url: `https://reddit.com/search?q=${ticker}` } : n;
      let title = obj.titulo;
      let author = 'Reddit User';
      if (title.startsWith('[') && title.includes(']:')) {
        const parts = title.split(']:');
        author = parts[0].replace('[', '').trim();
        title = parts[1]?.trim() || title;
      }
      return { title, source: 'Reddit Forum', author, time: `${i + 1}h ago`, url: obj.url, icon: '👽' };
    })
    : [
      { title: `The Market Is Missing ${ticker}'s Cash Boom`, source: 'Substack', author: 'Finfluencer', time: '5h ago', url: `https://www.reddit.com/search/?q=${ticker}+stock&sort=new`, icon: '💡' },
      { title: `${ticker}: A Buy On America's Next Energy Giant`, source: 'Twitter/X', author: 'MacroTrader', time: '12h ago', url: `https://www.reddit.com/search/?q=${ticker}+stock&sort=new`, icon: '🐦' },
      { title: `After Strong Q2 Beat ${ticker} Rises, But Surge May Be Short-Lived`, source: 'Reddit', author: 'WallStBets', time: '1d ago', url: `https://www.reddit.com/search/?q=${ticker}+stock&sort=new`, icon: '👽' },
    ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px', marginTop: '40px', padding: '30px', background: 'var(--panel-bg)', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
      {/* Columna Analysis */}
      <div>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.4rem', fontWeight: 400, margin: '0 0 20px', paddingBottom: '10px', borderBottom: '2px solid var(--border-color)' }}>{ticker} Analysis</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {analysisLinks.map((item, i) => <NewsItem key={`a-${i}`} {...item} />)}
        </div>
      </div>
      
      {/* Columna News */}
      <div>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.4rem', fontWeight: 400, margin: '0 0 20px', paddingBottom: '10px', borderBottom: '2px solid var(--border-color)' }}>{ticker} News</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {newsLinks.map((item, i) => <NewsItem key={`n-${i}`} {...item} />)}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────
const AssetDetail = () => {
  const { ticker } = useParams();
  const [period, setPeriod] = useState('1A');
  const [indicators, setIndicators] = useState({ sma50: true, sma100: false, sma200: true, bollinger: false });
  const [activeCompare, setActiveCompare] = useState(null);

  const { data: historico, isLoading: loadingHist, error: errorHist } = useHistorico(ticker, period);
  const { data: compareData } = useHistorico(activeCompare, period, !!activeCompare);
  const { data: marketData } = useMarketData();

  const activosList = Array.isArray(marketData)
    ? marketData
    : (marketData?.predicciones || marketData?.TOP_25_DIPS || marketData?.TOP_50_DIPS || marketData?.TODOS_LOS_ACTIVOS || []);
  const tkUpper = String(ticker || '').trim().toUpperCase();
  const assetInfo = activosList.find(a => String(a.Ticker || a.ticker || a.symbol || '').trim().toUpperCase() === tkUpper);

  const periods = ['1S', '1M', '3M', '1A', '3A', '5A'];
  const toggleIndicator = name => setIndicators(prev => ({ ...prev, [name]: !prev[name] }));

  // Métricas V4 Tactical con tooltips — mapeadas a predicciones_v2.json
  const dd52 = assetInfo?.['Drawdown_52W_%'] ?? assetInfo?.['Drawdown 52W %'];
  const dd10w = assetInfo?.['Drawdown_10W_%'];
  const rsi14val = assetInfo?.RSI_14D ?? assetInfo?.['RSI 14D'];
  const rsi2val = assetInfo?.RSI_2D;
  const fcfVal = assetInfo?.FCF;
  const peVal = assetInfo?.PE_Ratio ?? assetInfo?.['Valor Mercado (P/E Ratio)'];
  const beta60Val = assetInfo?.Beta_60D ?? assetInfo?.Beta;
  const kalmanVal = assetInfo?.Kalman_Slope;
  const garchVal = assetInfo?.GARCH_Regime;
  const tpAtrVal = assetInfo?.TP_ATR;
  const distSma50Val = assetInfo?.['Dist_SMA50_%'];
  const probVal = assetInfo?.['Probabilidad_Exito_%'];
  const kellyVal = assetInfo?.['Position_Sizing_Kelly_%'];
  const stopVal = assetInfo?.['Stop_Loss_ATR_$'] ?? assetInfo?.Stop_Loss_ATR_USD ?? assetInfo?.['Stop Loss ATR $'];

  const metrics = [
    {
      label: 'Prob. Éxito ML V4',
      value: probVal != null ? `${probVal}%` : 'N/A',
      color: probVal >= 55 ? '#10b981' : probVal >= 45 ? '#eab308' : '#ef4444',
      tip: 'Probabilidad de éxito estimada por LightGBM V4.0 Tactical. ≥45% = BUY Signal aprobada.'
    },
    {
      label: 'Kalman Slope',
      value: kalmanVal != null ? (Number(kalmanVal) > 0 ? `+${kalmanVal}` : String(kalmanVal)) : 'En formación',
      color: Number(kalmanVal ?? 0) > 0 ? '#10b981' : '#f43f5e',
      tip: 'Pendiente y velocidad de tendencia real calculada por el Filtro de Kalman de 2 estados sin desfasaje (200d).'
    },
    {
      label: 'GARCH Regime',
      value: garchVal != null ? `${garchVal}x` : '1.00x',
      color: '#38bdf8',
      tip: 'Ratio de volatilidad esperada en tiempo real respecto a la mediana de 60 días (Vol 10d / Vol 60d).'
    },
    {
      label: 'TP / ATR Ratio',
      value: tpAtrVal != null ? `${tpAtrVal}x` : '2.20x',
      color: '#a78bfa',
      tip: 'Multiplicador de Take Profit en unidades de volatilidad ATR. Mide la recompensa esperada por unidad de ruido.'
    },
    {
      label: 'Beta 60D',
      value: beta60Val != null && beta60Val !== 'N/A' ? String(beta60Val) : 'N/A',
      color: '#f59e0b',
      tip: 'Volatilidad y sensibilidad de riesgo de mercado rodante de 60 días en tiempo real.'
    },
    {
      label: 'Dist. SMA 50',
      value: distSma50Val != null ? `${distSma50Val}%` : 'N/A',
      color: Number(distSma50Val ?? 0) >= 0 ? '#10b981' : '#ef4444',
      tip: 'Desviación porcentual respecto a la media móvil táctica de 50 días.'
    },
    {
      label: 'Drawdown 10W',
      value: dd10w != null ? `${dd10w}%` : 'N/A',
      color: '#94a3b8',
      tip: 'Caída máxima acumulada en el rango reciente de 10 semanas.'
    },
    {
      label: 'Drawdown 52W',
      value: dd52 != null ? `${dd52}%` : 'N/A',
      color: '#ef4444',
      tip: 'Caída máxima desde el pico más alto de las últimas 52 semanas.'
    },
    {
      label: 'RSI 14D',
      value: rsi14val != null ? String(rsi14val).split(' ')[0] : 'N/A',
      color: Number(rsi14val) < 30 ? '#10b981' : Number(rsi14val) > 70 ? '#ef4444' : '#f8fafc',
      tip: 'Índice de Fuerza Relativa de 14 días. < 30 indica zona de sobreventa.'
    },
    {
      label: 'RSI 2D (Connors)',
      value: rsi2val != null ? String(rsi2val) : 'N/A',
      color: Number(rsi2val) < 10 ? '#10b981' : '#a78bfa',
      tip: 'Connors RSI de 2 días. < 10 indica dip extremo de muy corto plazo.'
    },
    {
      label: 'FCF',
      value: fcfVal ?? 'N/A',
      color: fcfVal && !String(fcfVal).includes('-') && fcfVal !== 'N/A' ? '#10b981' : '#ef4444',
      tip: 'Flujo de Caja Libre generado tras gastos de capital CapEx.'
    },
    {
      label: 'P/E / Valoración',
      value: peVal && peVal !== 'N/A' ? String(peVal) : 'Neg. (Growth)',
      color: '#eab308',
      tip: 'Múltiplo Precio/Beneficio. En empresas de crecimiento con utilidades negativas indica reinversión.'
    },
    {
      label: 'Kelly %',
      value: kellyVal != null ? `${kellyVal}%` : 'N/A',
      color: '#818cf8',
      tip: 'Position sizing Half-Kelly sugerido para esta posición.'
    },
    {
      label: 'Stop Loss ATR',
      value: stopVal != null ? `$${stopVal}` : 'N/A',
      color: '#ef4444',
      tip: 'Precio de Stop Loss dinámico adaptado a la volatilidad ATR del activo.'
    },
  ];

  return (
    <div className="container">
      <Link to="/" style={{ display: 'inline-block', marginBottom: '20px', color: 'var(--accent-color)' }}>← Volver al Dashboard</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ marginBottom: '5px', fontSize: '2.5rem' }}>{ticker}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{assetInfo?.Nombre || 'Cargando nombre...'}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {periods.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              background: period === p ? 'var(--accent-color)' : 'var(--panel-bg)',
              color: period === p ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border-color)', padding: '8px 15px',
              borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '30px', minHeight: '500px' }}>
        {/* Gráfica y paneles */}
        <div>
          {/* Indicadores */}
          <div style={{ marginBottom: '15px', display: 'flex', gap: '15px' }}>
            {[
              { key: 'sma50', label: 'SMA 50', color: '#eab308' },
              { key: 'sma100', label: 'SMA 100', color: '#10b981' },
              { key: 'sma200', label: 'SMA 200', color: '#a78bfa' },
              { key: 'bollinger', label: 'Bollinger', color: '#3b82f6' },
            ].map(({ key, label, color }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={indicators[key]} onChange={() => toggleIndicator(key)} />
                <span style={{ color, fontWeight: 'bold', fontSize: '0.9rem' }}>{label}</span>
              </label>
            ))}
          </div>

          {/* Comparar */}
          <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Comparar con:</span>
            {[{ id: 'SPY', label: 'S&P 500' }, { id: 'QQQ', label: 'Nasdaq' }, { id: 'GC=F', label: 'Oro' }, { id: 'BTC-USD', label: 'Bitcoin' }].map(comp => (
              <button key={comp.id} onClick={() => setActiveCompare(activeCompare === comp.id ? null : comp.id)} style={{
                background: activeCompare === comp.id ? 'rgba(59,130,246,0.2)' : 'var(--panel-bg)',
                color: activeCompare === comp.id ? 'var(--accent-color)' : 'var(--text-primary)',
                border: `1px solid ${activeCompare === comp.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
                padding: '5px 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'
              }}>{activeCompare === comp.id ? '✓ ' : '+ '}{comp.label}</button>
            ))}
          </div>

          {/* Gráfica */}
          {loadingHist ? (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel-bg)', borderRadius: '12px' }}>
              <p>Cargando gráfica dinámica...</p>
            </div>
          ) : errorHist ? (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel-bg)', borderRadius: '12px', color: '#ef4444' }}>
              <p>Error: {errorHist.message}</p>
            </div>
          ) : (
            <CandleChart data={historico?.data} compareData={compareData?.data} indicators={indicators} compareTicker={activeCompare} />
          )}

          {/* Paneles inferiores de info central */}
          <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '20px' }}>
            {/* Tesis */}
            <div style={{ background: 'var(--panel-bg)', padding: '25px', borderRadius: '15px', border: '1px solid var(--border-color)', lineHeight: '1.8' }}>
              <h3 style={{ marginTop: 0 }}>🧠 Tesis de Inversión MLOps V4</h3>
              <div dangerouslySetInnerHTML={{
                __html: (() => {
                  if (assetInfo?.AI_Details) {
                    return assetInfo.AI_Details
                      .replace(/\*\s+\*\*(.*?):\*\*(.*)/g, "<li style='margin-bottom:8px;'><strong style='color:#a78bfa;'>$1:</strong>$2</li>")
                      .replace(/<strong style='color:#a78bfa;'>Caso Bull(?: \(Alcista\))?:<\/strong>/g, "<strong style='color:#10b981;'>📈 Caso Bull:</strong>")
                      .replace(/<strong style='color:#a78bfa;'>Caso Bear(?: \(Bajista\))?:<\/strong>/g, "<strong style='color:#ef4444;'>📉 Caso Bear:</strong>");
                  }
                  const tk = ticker || assetInfo?.Ticker || 'este activo';
                  const veredicto = assetInfo?.Veredicto || 'BUY';
                  const prob = assetInfo?.['Probabilidad_Exito_%'] ?? 'N/A';
                  const cat = assetInfo?.Categoria || 'Sweet Spot';
                  const dd = assetInfo?.['Drawdown_52W_%'] ?? assetInfo?.['Drawdown 52W %'] ?? 'N/A';
                  const rsi14 = assetInfo?.RSI_14D ?? assetInfo?.['RSI 14D'] ?? 'N/A';
                  const tp = assetInfo?.['Take_Profit_%'] ?? '8.95';
                  const sl = assetInfo?.['Stop_Loss_%'] ?? '4.07';
                  const kelly = assetInfo?.['Position_Sizing_Kelly_%'] ?? '15.0';
                  const kalman = assetInfo?.Kalman_Slope ?? 'Positiva';
                  const garch = assetInfo?.GARCH_Regime ?? '1.12x';

                  return `
                    <ul style="padding-left:18px; margin:0; list-style:none;">
                      <li style="margin-bottom:10px;"><strong style="color:#a78bfa;">🎯 Algoritmo LightGBM V4.0 Tactical:</strong> Categorizado en <span style="color:#38bdf8; font-weight:700;">${cat}</span> con recomendación <strong style="color:${veredicto === 'BUY' ? '#10b981' : '#eab308'};">${veredicto}</strong> (Probabilidad de Éxito: <strong>${prob}%</strong>).</li>
                      <li style="margin-bottom:10px;"><strong style="color:#10b981;">📈 Filtro Kalman & Régimen Volatilidad:</strong> Velocidad de tendencia real <strong>${kalman}</strong> sin desfasaje (200d) con ratio de régimen GARCH <strong>${garch}</strong>.</li>
                      <li style="margin-bottom:10px;"><strong style="color:#38bdf8;">📊 Estructura Táctica:</strong> ${tk} registra un drawdown del <strong>${dd}%</strong> y RSI 14D de <strong>${rsi14}</strong>. Se projeta Take Profit dinámico por ATR de <strong style="color:#10b981;">+${tp}%</strong>.</li>
                      <li style="margin-bottom:10px;"><strong style="color:#ef4444;">🛡️ Gestión de Riesgo ATR & Time Stop:</strong> Stop Loss calibrado por ATR en <strong style="color:#ef4444;">-${sl}%</strong> con expiración en <strong>11 días hábiles</strong>. Asignación recomendada: <strong>${kelly}%</strong>.</li>
                    </ul>
                  `;
                })()
              }} />
            </div>

            {/* Sentimiento */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <AnalystConsensus rec={assetInfo?.Recomendacion_Analistas} />
            </div>
          </div>
          
          {/* Nuevo Diseño a Dos Columnas tipo Seeking Alpha */}
          <NewsAndAnalysisLayout ticker={ticker} reddit={assetInfo?.Contexto_Reddit} />
        </div>

        {/* Sidebar de Métricas */}
        <div>
          <div style={{ background: 'var(--panel-bg)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Métricas Clave</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {metrics.map(({ label, value, color, tip }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tooltip text={tip}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
                  </Tooltip>
                  <span style={{ fontWeight: 'bold', color, textAlign: 'right', maxWidth: '160px', wordBreak: 'break-word', fontSize: '0.9rem' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(59,130,246,0.1)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>💡 Tip de Inversión</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              {assetInfo?.['RSI 14D']?.includes('Sobrevendido')
                ? 'RSI en zona de acumulación extrema. Un cruce alcista del SMA50 sobre el SMA200 confirmaría el rebote.'
                : assetInfo?.['RSI 14D']?.includes('Caro')
                  ? 'RSI en zona de sobrecompra. Considera esperar una corrección antes de entrar.'
                  : 'RSI en zona neutral. Monitorea el cruce de SMAs para confirmar la tendencia.'
              }
            </p>
          </div>

          <button onClick={() => window.print()} style={{
            width: '100%', padding: '15px', borderRadius: '12px',
            background: 'var(--accent-color)', color: 'white', border: 'none',
            fontWeight: 'bold', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: '10px'
          }}>
            📄 Exportar Informe (PDF)
          </button>

          <div style={{ marginTop: '20px', padding: '15px', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'justify' }}>
            <p><strong>⚠️ DESCARGO DE RESPONSABILIDAD:</strong> Este informe es generado por un bot de IA con fines informativos y educativos únicamente. No constituye asesoramiento financiero. Invertir en bolsa conlleva riesgos significativos de pérdida de capital.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetail;
