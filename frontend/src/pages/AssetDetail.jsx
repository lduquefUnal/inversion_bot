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

// ── Sources / Discussion ──────────────────────────────────────────────
const SourcesPanel = ({ reddit, ticker }) => {
  const hasRealLinks = reddit && reddit.length > 0 &&
    reddit[0]?.titulo !== 'Sin foros' && reddit[0] !== 'Sin foros';

  // Fallback links útiles
  const fallbackLinks = [
    { label: '📰 Yahoo Finance', url: `https://finance.yahoo.com/quote/${ticker}/analysis/` },
    { label: '🔍 Seeking Alpha', url: `https://seekingalpha.com/symbol/${ticker}` },
    { label: '📱 Reddit Search', url: `https://www.reddit.com/search/?q=${ticker}+stock&sort=new` },
    { label: '📊 TradingView', url: `https://www.tradingview.com/symbols/${ticker}/` },
  ];

  const links = hasRealLinks
    ? reddit.slice(0, 4).map(n => {
      const obj = typeof n === 'string' ? { titulo: n, url: `https://reddit.com/search?q=${ticker}` } : n;
      let title = obj.titulo;
      let badge = '';
      if (title.startsWith('[') && title.includes(']:')) {
        const parts = title.split(']:');
        badge = parts[0].replace('[', '').trim();
        title = parts[1]?.trim() || title;
      }
      return { label: title.length > 70 ? title.substring(0, 67) + '…' : title, url: obj.url, badge };
    })
    : fallbackLinks;

  return (
    <div style={{ background: 'var(--panel-bg)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <h4 style={{ margin: 0 }}>📰 Fuentes y Discusión</h4>
        {!hasRealLinks && (
          <span style={{ fontSize: '0.7rem', color: '#64748b', background: 'rgba(100,116,139,0.1)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(100,116,139,0.3)' }}>
            Links rápidos
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map((link, i) => (
          <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{
            padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px', background: 'rgba(15,23,42,0.3)',
            textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.88rem',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(15,23,42,0.3)'; }}
          >
            {link.badge && (
              <span style={{ fontSize: '0.68rem', background: 'rgba(255,69,0,0.15)', color: '#ff6b35', border: '1px solid rgba(255,69,0,0.3)', padding: '1px 6px', borderRadius: '8px', flexShrink: 0 }}>
                {link.badge}
              </span>
            )}
            <span style={{ flex: 1 }}>{link.label}</span>
            <span style={{ color: 'var(--accent-color)', flexShrink: 0 }}>↗</span>
          </a>
        ))}
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

  const assetInfo = marketData?.TOP_25_DIPS?.find(a => a.Ticker === ticker);
  const periods = ['1S', '1M', '3M', '1A', '3A', '5A'];
  const toggleIndicator = name => setIndicators(prev => ({ ...prev, [name]: !prev[name] }));

  // Métricas con tooltips
  const metrics = [
    {
      label: 'Score Total',
      value: assetInfo?.Score_Total ?? 'N/A',
      color: 'var(--accent-color)',
      tip: 'Puntuación ponderada (0-100) basada en drawdown, RSI, tendencia SMA200, calidad fundamental y momentum de 5 días. > 70 = oportunidad interesante.'
    },
    {
      label: 'Drawdown 52W',
      value: assetInfo?.['Drawdown 52W %'] ? `${assetInfo['Drawdown 52W %']}%` : 'N/A',
      color: '#ef4444',
      tip: 'Caída máxima desde el precio más alto de los últimos 52 semanas. Un dip > 40% puede ser zona de acumulación agresiva.'
    },
    {
      label: 'RSI 14D',
      value: assetInfo?.['RSI 14D'] ?? 'N/A',
      color: assetInfo?.['RSI 14D']?.includes('Sobrevendido') ? '#10b981' : assetInfo?.['RSI 14D']?.includes('Caro') ? '#ef4444' : '#f8fafc',
      tip: 'Relative Strength Index (0-100). < 35 = Sobrevendido (posible rebote) | > 70 = Sobrecomprado (posible corrección) | 35-70 = Zona neutral.'
    },
    {
      label: 'FCF',
      value: assetInfo?.FCF ?? 'N/A',
      color: assetInfo?.FCF?.startsWith('$') && !assetInfo.FCF.includes('-') ? '#10b981' : '#ef4444',
      tip: 'Flujo de Caja Libre (Free Cash Flow). Dinero real generado tras gastos de capital. Positivo = empresa sana financieramente. Negativo en growth = puede ser normal.'
    },
    {
      label: 'P/E Ratio',
      value: assetInfo?.['Valor Mercado (P/E Ratio)'] ? parseFloat(assetInfo['Valor Mercado (P/E Ratio)']).toFixed(1) : 'N/A',
      color: '#eab308',
      tip: 'Precio / Beneficio. Cuánto pagas por cada $1 de ganancia. < 15 = barato | 15-30 = razonable | > 30 = caro o alto crecimiento esperado. Negativo = empresa con pérdidas.'
    },
    {
      label: 'Monto DCA',
      value: assetInfo?.['Monto Sugerido (SmartDCA)'] ?? '$100 USD',
      color: '#eab308',
      tip: 'Monto sugerido por la estrategia Smart DCA según el nivel de riesgo. $80 = conservador (dip leve) | $100 = moderado | $120 = agresivo (dip fuerte). Puramente educativo.'
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

          {/* Paneles inferiores */}
          <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Tesis */}
            <div style={{ background: 'var(--panel-bg)', padding: '25px', borderRadius: '15px', border: '1px solid var(--border-color)', lineHeight: '1.8' }}>
              <h3 style={{ marginTop: 0 }}>🧠 Tesis de Inversión</h3>
              <div dangerouslySetInnerHTML={{
                __html: (assetInfo?.AI_Details || 'No hay detalles disponibles.')
                  .replace(/\*\s+\*\*(.*?):\*\*(.*)/g, "<li style='margin-bottom:8px;'><strong style='color:#a78bfa;'>$1:</strong>$2</li>")
                  .replace(/<strong style='color:#a78bfa;'>Caso Bull(?: \(Alcista\))?:<\/strong>/g, "<strong style='color:#10b981;'>📈 Caso Bull:</strong>")
                  .replace(/<strong style='color:#a78bfa;'>Caso Bear(?: \(Bajista\))?:<\/strong>/g, "<strong style='color:#ef4444;'>📉 Caso Bear:</strong>")
              }} />
            </div>

            {/* Sentimiento + Fuentes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <AnalystConsensus rec={assetInfo?.Recomendacion_Analistas} />
              <SourcesPanel reddit={assetInfo?.Contexto_Reddit} ticker={ticker} />
            </div>
          </div>
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
