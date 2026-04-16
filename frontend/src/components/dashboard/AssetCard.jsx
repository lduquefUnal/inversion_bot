import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

// Tooltip inline para métricas del dashboard
const Tip = ({ text, children }) => {
  const [v, setV] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'help' }}
      onMouseEnter={() => setV(true)} onMouseLeave={() => setV(false)}>
      {children}
      <span style={{ fontSize: '0.65rem', opacity: 0.4, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: '12px', height: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>?</span>
      {v && (
        <span style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid rgba(100,116,139,0.5)', borderRadius: '8px', padding: '7px 10px', fontSize: '0.75rem', color: '#cbd5e1', whiteSpace: 'nowrap', zIndex: 999, lineHeight: '1.5', boxShadow: '0 8px 25px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>{text}</span>
      )}
    </span>
  );
};

const CAT_CONFIG = {
  "Recuperacion Rapida": { emoji: "⚡", label: "Recup. Rápida", bg: "rgba(16,185,129,0.2)", color: "#10b981", border: "#10b981" },
  "Sweet Spot":          { emoji: "🎯", label: "Sweet Spot",    bg: "rgba(234,179,8,0.2)",  color: "#eab308", border: "#eab308" },
  "Cazador de Dips":     { emoji: "🔥", label: "Cazador Dips",  bg: "rgba(239,68,68,0.2)",  color: "#ef4444", border: "#ef4444" },
  "Cuchillo Cayendo":    { emoji: "⚠️", label: "Cuchillo",      bg: "rgba(100,116,139,0.2)",color: "#94a3b8", border: "#64748b" },
  "Recup. Rápida": { emoji: "⚡", label: "Recup. Rápida", bg: "rgba(16,185,129,0.2)", color: "#10b981", border: "#10b981" },
  "Cazador Dips":  { emoji: "🔥", label: "Cazador Dips",  bg: "rgba(239,68,68,0.2)",  color: "#ef4444", border: "#ef4444" },
  "Cuchillo":      { emoji: "⚠️", label: "Cuchillo",      bg: "rgba(100,116,139,0.2)",color: "#94a3b8", border: "#64748b" },
  "Momentum":      { emoji: "🚀", label: "Momentum",      bg: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "#60a5fa" },
};

const DIP_COLORS = { "Leve": "#10b981", "Medio": "#eab308", "Alto": "#ef4444" };

const AssetCard = ({ item, index }) => {
  const navigate = useNavigate();
  const { setZoomedImage } = useAppStore();
  
  const {
    Ticker, Nombre, "Drawdown 52W %": Drawdown, "RSI 14D": RSI_Str, "Tendencias": SMA200_Tendencia, 
    "Score_Ranking": score_ranking, "Score_Total": score_total_val, "Categoria": categoria_raw, 
    "Tipo_Dip": tipo_dip_raw, "Cambio 5D %": cambio_5d,
    "Monto Sugerido (SmartDCA)": monto_dca,
    "Contexto_Reddit": reddit_news,
    AI_Details
  } = item;

  const score_val = score_total_val || score_ranking;

  const categoria = categoria_raw || "Sweet Spot";
  const tipo_dip = tipo_dip_raw || "Medio";
  const cfg = CAT_CONFIG[categoria] || CAT_CONFIG["Sweet Spot"];
  const dip_color = DIP_COLORS[tipo_dip] || "#94a3b8";
  
  const score_display = score_val ? Math.abs(Math.round(score_val)) : "N/A";
  
  const cambio = cambio_5d !== undefined ? cambio_5d : 0;
  const cambio_5d_str = (typeof cambio === 'number') ? (cambio >= 0 ? `+${cambio}%` : `${cambio}%`) : cambio;
  const cambio_color = (typeof cambio === 'number' && cambio < 0) ? "#ef4444" : "#10b981";
  
  // Ruta primaria: /imagen/ (Flask en prod/dev). Fallback: /top_N_TICKER.png (Vite public)
  const imgPrimary = `/imagen/top_${index + 1}_${Ticker}.png`;
  const imgFallback = `/top_${index + 1}_${Ticker}.png`;
  const fcf = item.FCF;

  const handleImgError = (e) => {
    if (e.currentTarget.src.includes('/imagen/')) {
      e.currentTarget.src = imgFallback;
    } else {
      e.currentTarget.style.display = 'none';
    }
  };

  let aiHtml = AI_Details || "";
  if (aiHtml) {
      aiHtml = aiHtml.replace(/\*\s+\*\*(.*?):\*\*(.*)/g, "<li style='margin-bottom:8px;'><strong style='color:#a78bfa;'>$1:</strong>$2</li>");
      aiHtml = aiHtml.replace(/<strong style='color:#a78bfa;'>Caso Bull(?: \(Alcista\))?:<\/strong>/g, "<strong style='color:#10b981;'>📈 Caso Bull:</strong>");
      aiHtml = aiHtml.replace(/<strong style='color:#a78bfa;'>Caso Bear(?: \(Bajista\))?:<\/strong>/g, "<strong style='color:#ef4444;'>📉 Caso Bear:</strong>");
  }

  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.4)',
      backdropFilter: 'blur(16px)',
      borderRadius: '20px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
      transition: 'transform 0.3s ease, border-color 0.3s',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      color: 'var(--text-primary)'
    }}
    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.2)'; }}
    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; }}
    >
      {/* Columna Izquierda: Información de Texto (Clickeable) */}
      <div 
        style={{ padding: '30px', flex: '1 1 50%', minWidth: '300px', cursor: 'pointer' }}
        onClick={() => navigate(`/activo/${Ticker}`)}
      >
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.8rem', color: '#f8fafc' }}>
          {Ticker} <span style={{ fontWeight: 300, fontSize: '1.2rem', color: 'var(--text-secondary)' }}>({Nombre})</span>
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
          <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#2dd4bf', color: '#0f172a', fontWeight: 'bold', fontSize: '0.9rem' }}>#{index + 1}</span>
          <span style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid #818cf8', fontWeight: 'bold', fontSize: '0.8rem' }}>
            📊 Score: {score_display}
          </span>
          <span style={{ fontSize: '0.85rem', background: 'rgba(234,179,8,0.2)', padding: '4px 10px', borderRadius: '12px', color: '#eab308', border: '1px solid #eab308' }}>🛒 {monto_dca}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <span style={{ padding: '4px 10px', borderRadius: '20px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 'bold', fontSize: '0.8rem' }}>
            {cfg.emoji} {cfg.label}
          </span>
          <span style={{ fontSize: '0.85rem', background: 'rgba(15,23,42,0.8)', padding: '4px 10px', borderRadius: '12px', color: dip_color, border: `1px solid ${dip_color}` }}>Dip {tipo_dip}</span>
          <span style={{ fontSize: '0.85rem', background: 'rgba(15,23,42,0.8)', padding: '4px 10px', borderRadius: '12px', color: cambio_color }}>5D: {cambio_5d_str}</span>
        </div>

        {/* Chips de métricas clave con tooltip */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '15px' }}>
          <Tip text="RSI < 35 = sobrevendido (buena zona de entrada). RSI > 70 = caro.">
            <span style={{ fontSize: '0.78rem', background: 'rgba(30,41,59,0.8)', padding: '3px 9px', borderRadius: '10px', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>RSI: {RSI_Str?.split(' ')[0] || 'N/A'}</span>
          </Tip>
          <Tip text="Caída desde el máximo de 52 semanas. > 40% = zona de dip agresivo."><span style={{ fontSize: '0.78rem', background: 'rgba(30,41,59,0.8)', padding: '3px 9px', borderRadius: '10px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>DD: {Drawdown}%</span>
          </Tip>
          {fcf && fcf !== 'N/A' && (
            <Tip text="Flujo de Caja Libre. Positivo = empresa genera caja real. Negativo puede ser normal en growth.">
              <span style={{ fontSize: '0.78rem', background: fcf.startsWith('$-') || fcf.startsWith('-') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', padding: '3px 9px', borderRadius: '10px', color: fcf.startsWith('$-') || fcf.startsWith('-') ? '#ef4444' : '#10b981', border: `1px solid ${fcf.startsWith('$-') || fcf.startsWith('-') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>💵 FCF: {fcf}</span>
            </Tip>
          )}
          <Tip text="Tendencia de la SMA 200. Sana/Normal = precio sobre media de largo plazo (alcista)."><span style={{ fontSize: '0.78rem', background: 'rgba(30,41,59,0.8)', padding: '3px 9px', borderRadius: '10px', color: SMA200_Tendencia?.includes('Cuchillo') ? '#f59e0b' : '#10b981', border: '1px solid rgba(255,255,255,0.08)' }}>{SMA200_Tendencia?.includes('Cuchillo') ? '⚠️ Bajista' : '✅ Alcista'}</span>
          </Tip>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.7' }}>
          {aiHtml ? (
            <div dangerouslySetInnerHTML={{ __html: aiHtml }} />
          ) : (
             <>
               <li style={{marginBottom:'8px'}}><strong>Caída (Drawdown):</strong> {Drawdown}%</li>
               <li style={{marginBottom:'8px'}}><strong>RSI 14D:</strong> {RSI_Str || 'N/A'}</li>
               <li style={{marginBottom:'8px'}}><strong>Tendencia Técnica:</strong> {SMA200_Tendencia || 'N/A'}</li>
             </>
          )}
        </ul>
      </div>

      {/* Columna Derecha: Imagen + Noticias */}
      <div 
        style={{ flex: '1 1 45%', background: '#0b1120', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '20px', alignSelf: 'stretch' }}
      >
         <img 
          src={imgPrimary} 
          alt={`Gráfica ${Ticker}`} 
          style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'zoom-in', marginBottom: '20px', background: '#fff' }} 
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            setZoomedImage(imgPrimary); 
          }}
          onError={handleImgError}
        />

        {reddit_news && reddit_news.length > 0 && reddit_news[0] !== "Sin foros" && reddit_news[0]?.titulo !== "Sin foros" && (
          <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
                <svg width='16' height='16' viewBox='0 0 24 24' fill='#ff4500'><path d='M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z'/></svg>
                <span style={{ color:'#94a3b8', fontSize:'0.85rem', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>Fuentes para contrastar (Reddit)</span>
            </div>
            {reddit_news.slice(0, 3).map((noticia, i) => {
              const obj = typeof noticia === 'string' ? { titulo: noticia, url: `https://reddit.com/search?q=${Ticker}` } : noticia;
              let title = obj.titulo;
              let badge = '';
              if (title.startsWith('[') && title.includes(']:')) {
                 const parts = title.split(']:');
                 badge = parts[0].replace('[', '').trim();
                 title = parts[1].trim();
              }
              const truncTitle = title.length > 90 ? title.substring(0, 87) + '...' : title;
              return (
                <a key={i} href={obj.url} target='_blank' rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'block', textDecoration: 'none', marginBottom: '8px' }}>
                  <div style={{
                       display:'flex', alignItems:'flex-start', gap:'10px', background:'rgba(15,23,42,0.5)', 
                       border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px', padding:'12px 15px', transition:'all 0.2s'
                  }} 
                  onMouseOver={(e)=>{e.currentTarget.style.borderColor='rgba(96,165,250,0.4)'; e.currentTarget.style.background='rgba(30,58,95,0.4)'}}
                  onMouseOut={(e)=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; e.currentTarget.style.background='rgba(15,23,42,0.5)'}}
                  >
                     <div style={{flex:1}}>
                        {badge && <span style={{fontSize:'0.7rem', background:'rgba(255,69,0,0.15)', color:'#ff6b35', border:'1px solid rgba(255,69,0,0.3)', padding:'2px 7px', borderRadius:'10px', marginRight:'6px', display:'inline-block', marginBottom:'4px'}}>{badge}</span>}
                        <p style={{margin:0, fontSize:'0.9rem', color:'#cbd5e1', lineHeight:1.4}}>{truncTitle}</p>
                     </div>
                     <span style={{color:'#60a5fa', fontSize:'1rem', flexShrink:0}}>↗</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetCard;
