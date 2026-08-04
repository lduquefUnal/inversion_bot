import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Paleta categorías ────────────────────────────────────────────────────────
const CAT_CFG = {
  'Sweet Spot': { emoji: '🎯', bg: 'rgba(234,179,8,0.15)', color: '#eab308', border: '#eab308', desc: 'Fundamentos sólidos, corrección temporal. Tendencia de largo plazo intacta (precio > SMA200).' },
  'Cazador Dips': { emoji: '🔥', bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '#ef4444', desc: 'Drawdown >35% + RSI 2D <10 (Connors). Alto riesgo, alta recompensa.' },
  'Recup. Rapida': { emoji: '⚡', bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: '#10b981', desc: 'EMA20 ≥ SMA50, precio sobre SMA200. Ciclo corto de recuperación con momentum alcista.' },
  'Cuchillos Cayendo': { emoji: '⚠️', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '#64748b', desc: 'Sin soporte claro. Máxima cautela. Solo traders con alta tolerancia al riesgo.' },
};
const DEF_CFG = { emoji: '📊', bg: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '#818cf8', desc: 'Activo en evaluación.' };

export const getCategoryWinRate = (catRaw) => {
  const cat = String(catRaw || '');
  if (cat.includes('Sweet')) return 33.3;
  if (cat.includes('Cazador')) return 45.5;
  if (cat.includes('Recup')) return 48.5;
  if (cat.includes('Cuchillo')) return 45.8;
  return 48.5;
};

export const getCategoryConfig = (catRaw) => {
  const cat = String(catRaw || '');
  if (cat.includes('Sweet')) return CAT_CFG['Sweet Spot'];
  if (cat.includes('Cazador')) return CAT_CFG['Cazador Dips'];
  if (cat.includes('Recup')) return CAT_CFG['Recup. Rapida'];
  if (cat.includes('Cuchillo')) return CAT_CFG['Cuchillos Cayendo'];
  return DEF_CFG;
};

export const getCategoryParams = (catRaw) => {
  const cat = String(catRaw || '');
  if (cat.includes('Sweet')) return { tp: 15, sl: 6, dias: 14 };
  if (cat.includes('Cazador')) return { tp: 12, sl: 5, dias: 11 };
  if (cat.includes('Recup')) return { tp: 10, sl: 4, dias: 7 };
  if (cat.includes('Cuchillo')) return { tp: 8, sl: 4, dias: 5 };
  return { tp: 10, sl: 4, dias: 7 };
};

// ─── API Gemini ───────────────────────────────────────────────────────────────
const getGeminiKey = () =>
  import.meta.env.VITE_GEMINI_API_KEY ||
  localStorage.getItem('VITE_GEMINI_API_KEY') ||
  localStorage.getItem('GEMINI_API_KEY') ||
  '';

const MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3-flash',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemma-4-26b-it',
];

// ─── Constructor del prompt (exportado para mostrarlo al usuario) ──────────────
export const buildPrompt = (item) => {
  const {
    Ticker, Nombre, Categoria, Precio_Actual,
    'Probabilidad_Exito_%': prob, 'WinRate_Modelo_%': winRate,
    Veredicto, Veredicto_V2,
    'Drawdown_52W_%': drawdown, RSI_14D: rsi14, RSI_2D: rsi2,
    FCF: fcf, PE_Ratio: pe, Beta: beta,
  } = item;

  const veredictoVal = Veredicto || Veredicto_V2 || 'HOLD';
  const p = getCategoryParams(Categoria);
  const tpPct = item['Take_Profit_%'] ?? p.tp;
  const slPct = item['Stop_Loss_%'] ?? p.sl;
  const limiteDias = item['Limite_Dias'] ?? p.dias;

  const priceNum = Number(Precio_Actual || 0);
  const tpPrice = item.Take_Profit_$ ?? (priceNum ? (priceNum * (1 + tpPct / 100)).toFixed(2) : 'N/A');
  const slPrice = item.Stop_Loss_ATR_$ ?? item.Stop_Loss_ATR_USD ?? (priceNum ? (priceNum * (1 - slPct / 100)).toFixed(2) : 'N/A');

  return `Eres un analista cuantitativo senior especializado en Swing Trading y Captura Táctica de Dips.
Estrategia: Swing trading de dips tácticos de corto plazo (sobreventa RSI 2D/14D, rebote en soportes y modelos ML especializados V3.7).

DATOS DEL ACTIVO — ${Ticker} (${Nombre}):
• Categoría de Estrategia: ${Categoria}
• Precio Actual: $${Precio_Actual} | Probabilidad Modelo ML: ${prob}% | Veredicto: ${veredictoVal}
• Drawdown 52W: ${drawdown}% | RSI 14D: ${rsi14} | RSI 2D (Connors): ${rsi2}
• FCF: ${fcf} | P/E: ${pe} | Beta: ${beta}
• Parámetros Operativos: Take Profit +${tpPct}% ($${tpPrice}) | Stop Loss -${slPct}% ($${slPrice}) | Límite Días (Time Stop): ${limiteDias} días

INSTRUCCIONES OBLIGATORIAS:
- PROHIBIDO mencionar "ATR", "Trailing Stop" o "Kelly %".
- Enfoca todo el análisis en la estrategia de Swing Trading de Dips Tácticos.

Genera una TESIS DE INVERSIÓN estructurada:

📈 **CASO BULL:**
[2-3 líneas: catalizadores técnicos y fundamentales de rebote. RSI, drawdown y solidez de caja.]

📉 **CASO BEAR:**
[2-3 líneas: riesgos principales de mercado, Beta alta o flujos de caja.]

🎯 **VEREDICTO CUANTITATIVO:**
[1-2 líneas directas evaluando si la probabilidad del ${prob}% valida la entrada al objetivo de Take Profit de $${tpPrice} (+${tpPct}%).]

⚠️ **GESTIÓN DE RIESGO:**
[1 línea: salida estricta si toca el Stop Loss en $${slPrice} (-${slPct}%) o al vencer el Time Stop de ${limiteDias} días.]

Español. Tono cuantitativo y limpio. Sin relleno. Máximo 200 palabras.`;
};

// ─── Hook: llama Gemini con fallback ─────────────────────────────────────────
const useGeminiThesis = (item) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [error, setError] = useState('');
  const [modelUsed, setModelUsed] = useState('');

  const run = useCallback(async () => {
    const activeKey = getGeminiKey();
    if (!activeKey) {
      setError('Configura VITE_GEMINI_API_KEY en Vercel > Settings > Environment Variables.');
      return;
    }
    setLoading(true); setText(''); setError(''); setModelUsed('');
    const prompt = buildPrompt(item);
    let success = false;
    let lastErrMsg = '';

    for (const model of MODELS) {
      setCurrentModel(model);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
        );
        const d = await res.json();
        if (d.error) {
          const msg = d.error.message || '';
          lastErrMsg = msg;
          if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('limit') || msg.includes('not found')) continue;
          throw new Error(msg);
        }
        const result = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (result) { setText(result); setModelUsed(model); success = true; break; }
      } catch (e) {
        lastErrMsg = e.message || 'Error de red / API';
      }
    }

    if (!success) setError(lastErrMsg || 'Sin cuota disponible en los modelos Gemini. Revisa tu API key.');
    setCurrentModel('');
    setLoading(false);
  }, [item]);

  // NO auto-ejecutar — se dispara con botón
  return { text, loading, currentModel, error, modelUsed, generate: run };
};

// ─── Render de la tesis con colores ──────────────────────────────────────────
const ThesisText = ({ text }) => {
  if (!text) return null;
  return (
    <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: '#cbd5e1' }}>
      {text.split('\n').filter(l => l.trim()).map((line, i) => {
        const cleaned = line.replace(/\*\*/g, '').replace(/^#+\s*/, '');
        const isBull = line.includes('📈') || line.toUpperCase().includes('BULL');
        const isBear = line.includes('📉') || line.toUpperCase().includes('BEAR');
        const isVerdict = line.includes('🎯') || line.toUpperCase().includes('VEREDICTO');
        const isRisk = line.includes('⚠️') || line.toUpperCase().includes('GESTIÓN');
        const color = isBull ? '#10b981' : isBear ? '#ef4444' : isVerdict ? '#a78bfa' : isRisk ? '#f59e0b' : '#cbd5e1';
        const isHeader = isBull || isBear || isVerdict || isRisk;
        return (
          <p key={i} style={{ margin: isHeader ? '10px 0 4px' : '0 0 2px', color, fontWeight: isHeader ? 700 : 400 }}>
            {cleaned}
          </p>
        );
      })}
    </div>
  );
};

// ─── Widget TradingView mini ──────────────────────────────────────────────────
const TradingViewChart = ({ ticker }) => {
  // Detecta si es cripto
  const isCrypto = ticker.includes('-USD') || ticker === 'BTC' || ticker === 'ETH';
  const symbol = isCrypto ? `CRYPTO:${ticker.replace('-USD', '')}USD` : `${ticker}`;

  const src = `https://www.tradingview.com/embed-widget/advanced-chart/?locale=es#${encodeURIComponent(JSON.stringify({
    symbol,
    interval: 'D',
    width: '100%',
    height: '100%',
    theme: 'dark',
    style: '1',
    toolbar_bg: '#0b1120',
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
    container_id: `tv_${ticker}`,
    backgroundColor: 'rgba(11,17,32,1)',
    gridColor: 'rgba(255,255,255,0.04)',
  }))}`;

  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', display: 'block' }}
      title={`Chart ${ticker}`}
      loading="lazy"
      allowTransparency
    />
  );
};

// ─── Pill de métrica ──────────────────────────────────────────────────────────
const Pill = ({ label, value, color = '#94a3b8', bg = 'rgba(30,41,59,0.9)', border = 'rgba(255,255,255,0.08)', title: tip = '' }) => (
  <span title={tip} style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
    padding: '4px 10px', borderRadius: '20px', background: bg, color, border: `1px solid ${border}`,
    fontWeight: 600, cursor: tip ? 'help' : 'default', whiteSpace: 'nowrap',
  }}>
    <span style={{ color: '#475569', fontWeight: 400 }}>{label}</span>
    <span>{value}</span>
  </span>
);

const Bar = ({ value, color = '#6366f1' }) => {
  const pct = Math.min(100, Math.max(0, Number(value)));
  return (
    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexGrow: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width 0.6s' }} />
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const AssetCard = ({ item, rank }) => {
  const navigate = useNavigate();
  const [nameHover, setNameHover] = useState(false);

  const {
    Ticker, Nombre, Categoria, Precio_Actual,
    'Probabilidad_Exito_%': prob,
    'Drawdown_52W_%': drawdown,
    RSI_14D: rsi14,
    RSI_2D: rsi2,
    FCF: fcf,
    PE_Ratio: pe,
    Beta: beta,
  } = item;

  const p = getCategoryParams(Categoria);
  const tpPct = item['Take_Profit_%'] ?? p.tp;
  const slPct = item['Stop_Loss_%'] ?? p.sl;
  const limiteDias = item['Limite_Dias'] ?? p.dias;

  const priceNum = Number(Precio_Actual || 0);
  const tpPrice = item.Take_Profit_$ ?? (priceNum ? (priceNum * (1 + tpPct / 100)).toFixed(2) : 'N/A');
  const slPrice = item.Stop_Loss_ATR_$ ?? item.Stop_Loss_ATR_USD ?? (priceNum ? (priceNum * (1 - slPct / 100)).toFixed(2) : 'N/A');

  const veredictoVal = item.Veredicto || item.Veredicto_V2 || 'HOLD';
  const emojiVal = item.Emoji || (veredictoVal === 'BUY' ? '💎' : veredictoVal === 'WATCH' ? '👀' : '⏳');
  const umbralVal = item['Umbral_Optimo_%'] ?? item['Umbral_Requerido_%'] ?? 40.0;
  const winRateVal = item['WinRate_Modelo_%'] ?? getCategoryWinRate(Categoria);

  const cfg = getCategoryConfig(Categoria);
  const probNum = Number(prob ?? 0);
  const probColor = probNum >= 60 ? '#10b981' : probNum >= 40 ? '#eab308' : '#ef4444';
  const verdColor = veredictoVal === 'BUY' ? '#10b981' : veredictoVal === 'WATCH' ? '#eab308' : '#94a3b8';
  const fcfNeg = typeof fcf === 'string' && (fcf.startsWith('-') || fcf.startsWith('$-'));
  const dd = Math.abs(Number(drawdown ?? 0));
  const rsi14n = Number(rsi14 ?? 50);
  const betaN = Number(beta ?? 0);

  const { text: thesis, loading, currentModel, error, modelUsed, generate } = useGeminiThesis(item);

  const goToDetail = (e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('iframe')) return;
    navigate(`/activo/${Ticker}`);
  };

  return (
    <div
      onClick={goToDetail}
      style={{
        background: 'rgba(14, 20, 36, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, border-color 0.2s',
        color: 'var(--text-primary, #f1f5f9)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)'; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
    >
      {/* ══ COLUMNA IZQUIERDA: Métricas + Tesis ══════════════════════════ */}
      <div style={{ flex: '1 1 380px', minWidth: '320px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>
              #{rank}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#f8fafc' }}>{Ticker}</h2>
                {/* Nombre con tooltip */}
                <div style={{ position: 'relative' }}>
                  <span
                    style={{ fontSize: '0.82rem', color: '#64748b', cursor: 'help', borderBottom: '1px dashed rgba(100,116,139,0.4)' }}
                    onMouseEnter={() => setNameHover(true)}
                    onMouseLeave={() => setNameHover(false)}
                  >
                    {Nombre}
                  </span>
                  {nameHover && (
                    <div style={{
                      position: 'absolute', left: 0, top: '100%', marginTop: '6px', zIndex: 200,
                      width: '230px', background: 'rgba(10,16,28,0.98)', backdropFilter: 'blur(12px)',
                      border: `1px solid ${cfg.border}44`, borderRadius: '12px', padding: '10px 13px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color }}>{cfg.emoji} {Categoria}</span>
                      <p style={{ margin: '5px 0 0', fontSize: '0.77rem', color: '#64748b', lineHeight: 1.5 }}>{cfg.desc}</p>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.emoji} {Categoria}</span>
                <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: `${verdColor}1a`, color: verdColor, border: `1px solid ${verdColor}` }}>{emojiVal} {veredictoVal}</span>
              </div>
            </div>
          </div>

          {/* Precio */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.5px' }}>
              ${Number(Precio_Actual).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#334155' }}>🔍 ver gráfica →</div>
          </div>
        </div>

        {/* Barras prob + winrate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: '#475569', width: '110px', flexShrink: 0 }}>Prob. Éxito</span>
            <Bar value={probNum} color={probColor} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: probColor, width: '40px', textAlign: 'right' }}>{probNum}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: '#475569', width: '110px', flexShrink: 0 }}>Win Rate Modelo</span>
            <Bar value={Number(winRateVal ?? 0)} color="#6366f1" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', width: '40px', textAlign: 'right' }}>{winRateVal}%</span>
          </div>
        </div>

        {/* Pills de métricas */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <Pill label="DD 52W:" value={drawdown != null ? `${drawdown}%` : 'N/A'}
            color={dd > 40 ? '#ef4444' : dd > 20 ? '#f59e0b' : '#10b981'}
            bg={dd > 40 ? 'rgba(239,68,68,0.1)' : dd > 20 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'}
            border={dd > 40 ? 'rgba(239,68,68,0.3)' : dd > 20 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}
            title="Caída desde máximo 52 semanas. >40% = dip agresivo (Connors)." />
          <Pill label="RSI 14D:" value={rsi14n.toFixed(1)}
            color={rsi14n < 30 ? '#10b981' : rsi14n > 70 ? '#ef4444' : '#eab308'}
            bg={rsi14n < 30 ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.9)'}
            border={rsi14n < 30 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}
            title="RSI 14 días. <30 = sobreventa. >70 = sobrecompra." />
          <Pill label="RSI 2D:" value={rsi2 != null ? Number(rsi2).toFixed(1) : 'N/A'}
            color={Number(rsi2) < 10 ? '#10b981' : '#a78bfa'}
            title="RSI 2 días (Connors). <10 = entrada extrema de corto plazo." />
          <Pill label="FCF:" value={fcf != null && fcf !== 'N/A' ? String(fcf) : 'N/A'}
            color={fcfNeg ? '#ef4444' : '#10b981'}
            bg={fcfNeg ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}
            border={fcfNeg ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}
            title="Free Cash Flow. Positivo = empresa genera caja real." />
          <Pill label="P/E:" value={pe != null && pe !== 'N/A' ? String(pe) : 'N/A'} title="Price/Earnings. <15 barato, >30 caro." />
          <Pill label="Beta:" value={beta != null && beta !== 'N/A' ? Number(betaN).toFixed(2) : 'N/A'}
            color={betaN > 1.5 ? '#f59e0b' : '#94a3b8'}
            title="Volatilidad vs S&P 500. >1.5 = activo especulativo." />
        </div>

        {/* Parámetros Operativos V3.7: TP, SL, Días y Umbral */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 95px', background: 'rgba(16,185,129,0.08)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🎯 Take Profit</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981' }}>+{tpPct}%</div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>(${tpPrice})</div>
          </div>
          <div style={{ flex: '1 1 95px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🛑 Stop Loss</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ef4444' }}>-{slPct}%</div>
            <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>(${slPrice})</div>
          </div>
          <div style={{ flex: '1 1 95px', background: 'rgba(96,165,250,0.08)', borderRadius: '10px', border: '1px solid rgba(96,165,250,0.2)', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⏱️ Límite Días</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#60a5fa' }}>{limiteDias}d</div>
            <div style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600, marginTop: '2px' }}>expiración</div>
          </div>
          <div style={{ flex: '1 1 95px', background: 'rgba(30,41,59,0.8)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Umbral Modelo</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#94a3b8' }}>{umbralVal}%</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>prob. mínima</div>
          </div>
        </div>

        {/* ── Tesis AI (auto-generada) ──────────────────────────────────── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🤖 Tesis de Inversión</span>
              {modelUsed && <span style={{ fontSize: '0.65rem', color: '#334155', fontFamily: 'monospace' }}>· {modelUsed}</span>}
            </div>
            {!thesis && !loading && (
              <button
                onClick={generate}
                style={{ padding: '5px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}
              >
                ✨ Generar Tesis
              </button>
            )}
            {thesis && !loading && (
              <button onClick={generate} style={{ background: 'none', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', color: '#64748b', fontSize: '0.68rem' }}>↺ Nueva</button>
            )}
          </div>

          {/* Estado de carga */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                Generando tesis · <span style={{ color: '#818cf8', fontFamily: 'monospace' }}>{currentModel}</span>
              </span>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p style={{ margin: 0, color: '#ef4444', fontSize: '0.75rem' }}>{error}</p>
            </div>
          )}

          {thesis && !loading && (
            <div style={{ background: 'rgba(10,16,28,0.7)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.12)', padding: '14px 16px' }}>
              <ThesisText text={thesis} />
            </div>
          )}
        </div>
      </div>

      {/* ══ COLUMNA DERECHA: Gráfica TradingView ═════════════════════════ */}
      <div style={{
        flex: '1 1 380px', minWidth: '300px', minHeight: '480px',
        background: '#0a1020', borderLeft: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>📈 GRÁFICA · {Ticker}</span>
          <a href={`/activo/${Ticker}`} style={{ fontSize: '0.68rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }} onClick={e => e.stopPropagation()}>Ver análisis completo ↗</a>
        </div>
        <div style={{ flex: 1, padding: '8px' }}>
          <TradingViewChart ticker={Ticker} />
        </div>
      </div>
    </div>
  );
};

export default AssetCard;
