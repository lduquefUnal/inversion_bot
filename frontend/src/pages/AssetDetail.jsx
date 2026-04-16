import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import CandleChart from '../components/detail/CandleChart';
import { useHistorico } from '../hooks/useHistorico';
import { useMarketData } from '../hooks/useMarketData';

const AssetDetail = () => {
  const { ticker } = useParams();
  const [period, setPeriod] = useState('1A');
  const [indicators, setIndicators] = useState({
    sma50: true,
    sma100: false,
    sma200: true,
    bollinger: false
  });
  const [activeCompare, setActiveCompare] = useState(null); // 'SPY', 'QQQ', 'GC=F', 'BTC-USD'

  const { data: historico, isLoading: loadingHist, error: errorHist } = useHistorico(ticker, period);
  const { data: compareData, isLoading: loadingCompare } = useHistorico(activeCompare, period, !!activeCompare);
  const { data: marketData } = useMarketData();

  const assetInfo = marketData?.TOP_25_DIPS?.find(a => a.Ticker === ticker);

  const periods = ['1S', '1M', '3M', '1A', '3A', '5A'];

  const toggleIndicator = (name) => {
    setIndicators(prev => ({ ...prev, [name]: !prev[name] }));
  };

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
            <button 
              key={p} 
              onClick={() => setPeriod(p)}
              style={{
                background: period === p ? 'var(--accent-color)' : 'var(--panel-bg)',
                color: period === p ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '8px 15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '30px', minHeight: '500px' }}>
        {/* Gráfica y Toggles */}
        <div>
          <div style={{ marginBottom: '15px', display: 'flex', gap: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={indicators.sma50} onChange={() => toggleIndicator('sma50')} />
              <span style={{ color: '#eab308', fontWeight: 'bold', fontSize: '0.9rem' }}>SMA 50</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={indicators.sma100} onChange={() => toggleIndicator('sma100')} />
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>SMA 100</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={indicators.sma200} onChange={() => toggleIndicator('sma200')} />
              <span style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '0.9rem' }}>SMA 200</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={indicators.bollinger} onChange={() => toggleIndicator('bollinger')} />
              <span style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '0.9rem' }}>Bollinger</span>
            </label>
          </div>

          <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Comparar con:</span>
            {[
              { id: 'SPY', label: 'S&P 500' },
              { id: 'QQQ', label: 'Nasdaq' },
              { id: 'GC=F', label: 'Oro' },
              { id: 'BTC-USD', label: 'Bitcoin' }
            ].map(comp => (
              <button
                key={comp.id}
                onClick={() => setActiveCompare(activeCompare === comp.id ? null : comp.id)}
                style={{
                  background: activeCompare === comp.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--panel-bg)',
                  color: activeCompare === comp.id ? 'var(--accent-color)' : 'var(--text-primary)',
                  border: `1px solid ${activeCompare === comp.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
                  padding: '5px 12px',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}
              >
                {activeCompare === comp.id ? '✓ ' : '+ '}{comp.label}
              </button>
            ))}
          </div>

          {loadingHist ? (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel-bg)', borderRadius: '12px' }}>
              <p>Cargando gráfica dinámica...</p>
            </div>
          ) : errorHist ? (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'red', borderRadius: '12px', color: 'white' }}>
              <p>Error: {errorHist.message}</p>
            </div>
          ) : (
            <CandleChart data={historico?.data} compareData={compareData?.data} indicators={indicators} compareTicker={activeCompare} />
          )}

          <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Tesis */}
            <div style={{ background: 'var(--panel-bg)', padding: '25px', borderRadius: '15px', border: '1px solid var(--border-color)', lineHeight: '1.8' }}>
              <h3 style={{ marginTop: 0 }}>🧠 Tesis de Inversión</h3>
              <div dangerouslySetInnerHTML={{ __html: assetInfo?.AI_Details?.replace(/\*\s+\*\*(.*?):\*\*(.*)/g, "<li style='margin-bottom:8px;'><strong style='color:#a78bfa;'>$1:</strong>$2</li>")
                .replace(/<strong style='color:#a78bfa;'>Caso Bull(?: \(Alcista\))?:<\/strong>/g, "<strong style='color:#10b981;'>📈 Caso Bull:</strong>")
                .replace(/<strong style='color:#a78bfa;'>Caso Bear(?: \(Bajista\))?:<\/strong>/g, "<strong style='color:#ef4444;'>📉 Caso Bear:</strong>") || 'No hay detalles disponibles.' }}
              />
            </div>

            {/* Sentimiento y Noticias */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Sentimiento */}
              <div style={{ background: 'var(--panel-bg)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 15px 0' }}>🎭 Sentimiento de Comunidad (Reddit)</h4>
                <div style={{ height: '10px', width: '100%', background: '#2d3748', borderRadius: '5px', overflow: 'hidden', display: 'flex', marginBottom: '10px' }}>
                   <div style={{ width: `${100 - (assetInfo?.Sentimiento_Reddit || 50)}%`, background: '#ef4444', transition: 'width 1s ease-out' }} title="Bajista"></div>
                   <div style={{ width: `${assetInfo?.Sentimiento_Reddit || 50}%`, background: '#10b981', transition: 'width 1s ease-out' }} title="Alcista"></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>📉 Bajista ({100 - (assetInfo?.Sentimiento_Reddit || 50)}%)</span>
                  <span>📈 Alcista ({assetInfo?.Sentimiento_Reddit || 50}%)</span>
                </div>
                <p style={{ fontSize: '0.75rem', marginTop: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  *Basado en volumen y palabras clave en r/wallstreetbets y foros especializados.
                </p>
              </div>

              {/* Noticias */}
              <div style={{ background: 'var(--panel-bg)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)', flex: 1 }}>
                <h4 style={{ margin: '0 0 15px 0' }}>📰 Fuentes y Discusión</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {assetInfo?.Contexto_Reddit?.map((n, i) => (
                    <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ 
                      padding: '12px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', background: 'rgba(15,23,42,0.3)',
                      textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                    >
                      {n.titulo} <span style={{ color: 'var(--accent-color)' }}>↗</span>
                    </a>
                  ))}
                  {(!assetInfo?.Contexto_Reddit || assetInfo?.Contexto_Reddit.length === 0) && <p style={{ color: 'var(--text-secondary)' }}>No hay noticias recientes.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar de Métricas */}
        <div>
          <div style={{ background: 'var(--panel-bg)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Métricas Clave</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Score Total:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{assetInfo?.Score_Total || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Drawdown:</span>
                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{assetInfo?.['Drawdown 52W %']}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>RSI 14D:</span>
                <span style={{ fontWeight: 'bold' }}>{assetInfo?.['RSI 14D']}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monto DCA:</span>
                <span style={{ fontWeight: 'bold', color: '#eab308' }}>{assetInfo?.['Monto Sugerido (SmartDCA)'] || '$100 USD'}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '20px' }}>
             <h4 style={{ margin: '0 0 10px 0' }}>💡 Tip de Inversión</h4>
             <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
               Esta acción tiene un RSI {assetInfo?.['RSI 14D']?.includes('Sobrevendido') ? 'en zona de acumulación extrema' : 'neutral'}. 
               Si el SMA 200 es superado, podría confirmar el cambio de tendencia.
             </p>
          </div>

          <button 
            onClick={() => window.print()}
            style={{ 
              width: '100%', padding: '15px', borderRadius: '12px', background: 'var(--accent-color)', 
              color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', gap: '10px' 
            }}
          >
            📄 Exportar Informe (PDF)
          </button>

          <div style={{ marginTop: '40px', padding: '15px', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'justify' }}>
             <p><strong>⚠️ DESCARGO DE RESPONSABILIDAD:</strong> Este informe es generado por un bot de IA con fines informativos y educativos únicamente. No constituye asesoramiento financiero profesional. Invertir en bolsa conlleva riesgos significativos de pérdida de capital. Realice su propia investigación antes de tomar cualquier decisión.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetail;
