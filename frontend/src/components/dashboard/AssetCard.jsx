import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Paleta de categorías ─────────────────────────────────────────────────────
const CAT_CFG = {
  'Sweet Spot':        { emoji: '🎯', bg: 'rgba(234,179,8,0.15)',   color: '#eab308', border: '#eab308',
    desc: 'Acción sólida con fundamentos fuertes que está en una corrección temporal. Tendencia de largo plazo intacta. Zona ideal de acumulación Smart DCA.' },
  'Cazador Dips':      { emoji: '🔥', bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', border: '#ef4444',
    desc: 'Acción con caída agresiva (>35% desde máximos) y RSI < 32. Alto riesgo, alta recompensa. Estrategia Connors RSI(2D) en modo oportunidad extrema.' },
  'Recup. Rapida':     { emoji: '⚡', bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: '#10b981',
    desc: 'Acción en tendencia alcista con corrección menor. EMA20 ≥ SMA50, precio sobre SMA200. Recuperación rápida esperada según momentum técnico.' },
  'Cuchillos Cayendo': { emoji: '⚠️', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '#64748b',
    desc: 'Acción en tendencia bajista sin soporte claro. Mayor cautela. Solo para traders con alta tolerancia al riesgo y horizonte especulativo de corto plazo.' },
};
const DEFAULT_CFG = { emoji: '📊', bg: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '#818cf8',
  desc: 'Activo en evaluación. Los indicadores técnicos y el modelo ML están procesando la señal.' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, d = 1) => (v == null || v === 'N/A' ? 'N/A' : Number(v).toFixed(d));

const Bar = ({ value, max = 100, color = '#6366f1', label }) => {
  const pct = Math.min(100, Math.max(0, (Number(value) / max) * 100));
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginBottom: '3px' }}>
          <span>{label}</span>
          <span style={{ color, fontWeight: 700 }}>{fmt(value)}%</span>
        </div>
      )}
      <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width 0.7s ease' }} />
      </div>
    </div>
  );
};

const Pill = ({ label, value, color = '#94a3b8', bg = 'rgba(30,41,59,0.9)', border = 'rgba(255,255,255,0.08)', title = '' }) => (
  <span title={title} style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.77rem',
    padding: '4px 11px', borderRadius: '20px', background: bg, color, border: `1px solid ${border}`,
    fontWeight: 600, cursor: title ? 'help' : 'default', whiteSpace: 'nowrap',
  }}>
    <span style={{ color: '#475569', fontWeight: 400 }}>{label}</span>
    <span>{value}</span>
  </span>
);

// ─── Análisis AI (Tesis completa con Gemini) ─────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const buildThesisPrompt = (item) => {
  const {
    Ticker, Nombre, Categoria, Precio_Actual,
    'Probabilidad_Exito_%': prob, 'WinRate_Modelo_%': winRate,
    Veredicto_V2, 'Position_Sizing_Kelly_%': kelly,
    Stop_Loss_ATR_USD: stopLoss, Trailing_Stop_USD: trailing,
    'Drawdown_52W_%': drawdown, RSI_14D: rsi14, RSI_2D: rsi2,
    FCF: fcf, PE_Ratio: pe, Beta: beta,
  } = item;

  return `Eres un analista cuantitativo senior especializado en swing trading de dips. Usa el framework de los libros: Connors (RSI 2D), Van Tharp (Kelly/R-multiples), Elder (Triple Screen), O'Neil (fundamentos + momentum).

VECTOR COMPLETO DEL ACTIVO ${Ticker} (${Nombre}):
- Categoría de Dip: ${Categoria}
- Precio Actual: $${Precio_Actual}
- Probabilidad de Éxito (LightGBM V2, 219 activos, Win Rate 80%): ${prob}%
- Veredicto Modelo: ${Veredicto_V2}
- Drawdown 52 semanas: ${drawdown}%
- RSI 14D: ${rsi14} | RSI 2D (Connors): ${rsi2}
- FCF: ${fcf} | P/E Ratio: ${pe} | Beta (Volatilidad): ${beta}
- Position Sizing Half-Kelly: ${kelly}% del capital
- Stop Loss ATR (2x): $${stopLoss} | Trailing Stop (1.5x): $${trailing}
- Win Rate Histórico del Modelo: ${winRate}%

Genera una TESIS DE INVERSIÓN estructurada y concisa:

📈 **CASO BULL:**
[2-3 líneas: razones técnicas + fundamentales por las que podría subir. Menciona RSI, drawdown, y FCF si aplica.]

📉 **CASO BEAR:**
[2-3 líneas: riesgos principales, por qué el rebote puede fallar. Menciona Beta, sector, macro.]

🎯 **VEREDICTO CUANTITATIVO:**
[1-2 líneas: conclusión directa. Menciona la prob del modelo, el Kelly % y el stop loss concreto. Ejemplo: "Con 70.5% de prob y Kelly 25%, entrar entre $10.15 y $10.68. Stop Loss hard en $10.15."]

⚠️ **GESTIÓN DE RIESGO:**
[1 línea: regla concreta de salida (stop loss o time stop según la categoría).]

Responde en español. Sé directo, sin frases vacías. Máximo 200 palabras.`;
};

const AIThesisPanel = ({ item }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [currentModel, setCurrentModel] = useState('');

  const runAnalysis = async () => {
    if (!GEMINI_API_KEY) {
      setError('⚙️ Configura VITE_GEMINI_API_KEY en el .env.local del frontend (o en Vercel > Settings > Environment Variables).');
      return;
    }
    setLoading(true); setError(''); setResult(''); setCurrentModel('');
    const prompt = buildThesisPrompt(item);
    // Modelos ordenados por disponibilidad real de cuota (RPD):
    // gemini-3.1-flash-lite → 500 RPD | gemini-3.5-flash-lite → 500 RPD
    // gemini-2.5-flash → 20 RPD | gemini-3-flash → 20 RPD | gemini-3.5-flash → 20 RPD
    // gemma-4-26b-it → 14.4K RPD (fallback texto)
    const MODELS = [
      'gemini-3.1-flash-lite',       // 15 RPM · 500 RPD ← más cuota
      'gemini-3.5-flash-lite',       // 15 RPM · 500 RPD ← más cuota
      'gemini-2.5-flash-lite',       // 10 RPM · 20 RPD
      'gemini-2.5-flash',            //  5 RPM · 20 RPD
      'gemini-3-flash',              //  5 RPM · 20 RPD
      'gemini-3.5-flash',            //  5 RPM · 20 RPD
      'gemini-3.6-flash',            //  5 RPM · 20 RPD
      'gemini-2.5-flash-preview-05-20', // fallback preview
      'gemma-4-26b-it',              // 30 RPM · 14.4K RPD (Gemma 4)
    ];

    let lastError = '';
    let success = false;

    for (const model of MODELS) {
      try {
        setCurrentModel(model);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
        const d = await res.json();
        // Si hay error de cuota, intenta el siguiente modelo
        if (d.error) {
          const msg = d.error.message || '';
          if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('limit')) {
            lastError = `Cuota agotada en ${model}, intentando siguiente modelo…`;
            continue;
          }
          throw new Error(msg);
        }
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          setResult(`${text}\n\n*— Generado con ${model}*`);
          success = true;
          break;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!success) {
      setError(`Sin cuota disponible en todos los modelos Gemini. ${lastError}. Verifica el plan en console.cloud.google.com`);
    }
    setLoading(false);
  };

  // Parsea el markdown de Gemini a HTML básico con colores
  const renderResult = (text) => {
    if (!text) return null;
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map((line, i) => {
      const isBull = line.includes('BULL') || line.includes('📈');
      const isBear = line.includes('BEAR') || line.includes('📉');
      const isVerdict = line.includes('VEREDICTO') || line.includes('🎯');
      const isRisk = line.includes('GESTIÓN') || line.includes('⚠️');
      const isBold = line.startsWith('**') || line.startsWith('##') || line.startsWith('📈') || line.startsWith('📉') || line.startsWith('🎯') || line.startsWith('⚠️');

      const color = isBull ? '#10b981' : isBear ? '#ef4444' : isVerdict ? '#a78bfa' : isRisk ? '#f59e0b' : '#cbd5e1';
      const cleaned = line.replace(/\*\*/g, '').replace(/^#+\s*/, '');

      return (
        <p key={i} style={{
          margin: '4px 0', color, fontSize: '0.88rem', lineHeight: 1.65,
          fontWeight: isBold ? 700 : 400,
        }}>
          {cleaned}
        </p>
      );
    });
  };

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '18px 24px', background: 'rgba(12,18,35,0.7)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🤖</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Tesis de Inversión (Gemini AI)
          </span>
        </div>
        {!result && (
          <button
            onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
            disabled={loading}
            style={{
              padding: '6px 16px', borderRadius: '8px', border: 'none',
              cursor: loading ? 'wait' : 'pointer',
              background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap',
            }}
          >
            {loading ? '⏳ Buscando modelo…' : '✨ Generar Tesis'}
          </button>
        )}
        {result && (
          <button
            onClick={(e) => { e.stopPropagation(); setResult(''); }}
            style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            ↺ Nueva
          </button>
        )}
      </div>
      {/* Indicador de modelo en progreso */}
      {loading && currentModel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 0', padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Probando: </span>
          <span style={{ fontSize: '0.75rem', color: '#818cf8', fontFamily: 'monospace', fontWeight: 600 }}>{currentModel}</span>
        </div>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: '8px 0 0' }}>{error}</p>}

      {result && (
        <div style={{
          background: 'rgba(20,28,48,0.8)', borderRadius: '12px',
          border: '1px solid rgba(99,102,241,0.15)', padding: '16px', marginTop: '10px',
        }}>
          {renderResult(result)}
        </div>
      )}

      {!result && !error && !loading && (
        <p style={{ color: '#334155', fontSize: '0.75rem', margin: '4px 0 0' }}>
          Tesis Bull/Bear + veredicto cuantitativo con todos los datos del vector ML.
        </p>
      )}
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const AssetCard = ({ item, rank }) => {
  const navigate = useNavigate();
  const [showAI, setShowAI] = useState(false);
  const [nameHover, setNameHover] = useState(false);

  const {
    Ticker, Nombre, Categoria, Precio_Actual,
    'Probabilidad_Exito_%': prob,
    'Umbral_Requerido_%': umbral,
    Veredicto_V2, Emoji,
    'Position_Sizing_Kelly_%': kelly,
    Stop_Loss_ATR_USD: stopLoss,
    Trailing_Stop_USD: trailing,
    'WinRate_Modelo_%': winRate,
    'Drawdown_52W_%': drawdown,
    RSI_14D: rsi14,
    RSI_2D: rsi2,
    FCF: fcf,
    PE_Ratio: pe,
    Beta: beta,
  } = item;

  const cfg = CAT_CFG[Categoria] || DEFAULT_CFG;
  const probNum = Number(prob ?? 0);
  const probColor = probNum >= 60 ? '#10b981' : probNum >= 40 ? '#eab308' : '#ef4444';
  const verdColor = Veredicto_V2 === 'BUY' ? '#10b981' : Veredicto_V2 === 'WATCH' ? '#eab308' : '#94a3b8';
  const fcfNeg = typeof fcf === 'string' && (fcf.startsWith('-') || fcf.startsWith('$-'));
  const dd = Math.abs(Number(drawdown ?? 0));
  const drawdownColor = dd > 40 ? '#ef4444' : dd > 20 ? '#f59e0b' : '#10b981';
  const rsi14Num = Number(rsi14 ?? 50);
  const rsiColor = rsi14Num < 30 ? '#10b981' : rsi14Num > 70 ? '#ef4444' : '#eab308';
  const betaNum = Number(beta ?? 0);

  const goToDetail = (e) => {
    // No navegar si se hizo click en el botón AI
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
    navigate(`/activo/${Ticker}`);
  };

  return (
    <div
      onClick={goToDetail}
      style={{
        background: 'rgba(18, 26, 44, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, border-color 0.2s, box-shadow 0.2s',
        color: 'var(--text-primary, #f1f5f9)',
        cursor: 'pointer',
      }}
      onMouseOver={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
        e.currentTarget.style.boxShadow = '0 16px 48px -8px rgba(0,0,0,0.6)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.boxShadow = '0 8px 32px -8px rgba(0,0,0,0.5)';
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 14px', flexWrap: 'wrap', gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Rank badge */}
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.88rem', fontWeight: 900, color: '#fff',
          }}>
            #{rank}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>{Ticker}</h2>
              {/* Nombre con tooltip de descripción */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span
                  style={{
                    fontSize: '0.85rem', color: '#64748b', cursor: 'help',
                    borderBottom: '1px dashed rgba(100,116,139,0.4)',
                    textDecoration: 'none', transition: 'color 0.2s',
                  }}
                  onMouseEnter={() => setNameHover(true)}
                  onMouseLeave={() => setNameHover(false)}
                >
                  {Nombre}
                </span>
                {nameHover && (
                  <div style={{
                    position: 'absolute', left: 0, top: '100%', marginTop: '6px',
                    zIndex: 100, width: '260px',
                    background: 'rgba(15,23,42,0.98)', backdropFilter: 'blur(12px)',
                    border: `1px solid ${cfg.border}44`,
                    borderRadius: '12px', padding: '12px 14px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '1rem' }}>{cfg.emoji}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{Categoria}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>{cfg.desc}</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '7px' }}>
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 700,
                background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
              }}>{cfg.emoji} {Categoria}</span>
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 700,
                background: `${verdColor}1a`, color: verdColor, border: `1px solid ${verdColor}`,
              }}>{Emoji} {Veredicto_V2}</span>
            </div>
          </div>
        </div>

        {/* Precio + indicador de click */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.5px' }}>
            ${Number(Precio_Actual).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#334155', marginTop: '2px' }}>
            🔍 Click para ver gráfica
          </div>
        </div>
      </div>

      {/* ── Barras de probabilidad ──────────────────────────────────────── */}
      <div style={{ padding: '14px 24px', display: 'flex', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Bar value={probNum} color={probColor} label="Probabilidad éxito" />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Bar value={winRate ?? 0} color="#6366f1" label="Win Rate Modelo" />
        </div>
        <div style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#475569' }}>Umbral mínimo</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{umbral}%</div>
        </div>
      </div>

      {/* ── Pills métricas quant ────────────────────────────────────────── */}
      <div style={{ padding: '14px 24px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <Pill
          label="Drawdown 52W:"
          value={drawdown != null ? `${drawdown}%` : 'N/A'}
          color={drawdownColor} bg={`${drawdownColor}18`} border={`${drawdownColor}44`}
          title="Caída desde el máximo de 52 semanas. >40% = zona de dip agresivo (Connors/Elder)."
        />
        <Pill
          label="RSI 14D:"
          value={fmt(rsi14Num)}
          color={rsiColor} bg={`${rsiColor}18`} border={`${rsiColor}44`}
          title="RSI de 14 días. <30 = sobreventa extrema. >70 = sobrecompra. Neutral: 30-70."
        />
        <Pill
          label="RSI 2D:"
          value={rsi2 != null ? fmt(rsi2) : 'N/A'}
          color={Number(rsi2) < 10 ? '#10b981' : '#a78bfa'}
          title="RSI de 2 días (estrategia Connors). <10 = señal de entrada extrema de corto plazo."
        />
        <Pill
          label="FCF:"
          value={fcf != null && fcf !== 'N/A' ? String(fcf) : 'N/A'}
          color={fcfNeg ? '#ef4444' : '#10b981'}
          bg={fcfNeg ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}
          border={fcfNeg ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}
          title="Free Cash Flow. Positivo = empresa genera dinero real. Negativo = quema de caja."
        />
        <Pill
          label="P/E:"
          value={pe != null && pe !== 'N/A' ? String(pe) : 'N/A'}
          title="Price to Earnings. N/A = empresa sin utilidades (growth). <15 barato, >30 caro."
        />
        <Pill
          label="Beta:"
          value={beta != null && beta !== 'N/A' ? fmt(betaNum) : 'N/A'}
          color={betaNum > 1.5 ? '#f59e0b' : '#94a3b8'}
          title="Volatilidad vs S&P 500. >1 = más volátil que el mercado. >2 = activo especulativo."
        />
      </div>

      {/* ── Position Sizing & Stops ─────────────────────────────────────── */}
      <div style={{ padding: '14px 24px', display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ flex: '1 1 120px', background: 'rgba(99,102,241,0.08)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.18)', padding: '11px 16px' }}>
          <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Kelly % capital</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#818cf8' }}>{kelly ?? 0}%</div>
        </div>
        <div style={{ flex: '1 1 120px', background: 'rgba(239,68,68,0.08)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.18)', padding: '11px 16px' }}>
          <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Stop Loss ATR</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ef4444' }}>${stopLoss}</div>
        </div>
        <div style={{ flex: '1 1 120px', background: 'rgba(234,179,8,0.08)', borderRadius: '12px', border: '1px solid rgba(234,179,8,0.18)', padding: '11px 16px' }}>
          <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Trailing Stop</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#eab308' }}>${trailing}</div>
        </div>
      </div>

      {/* ── Toggle Tesis AI ─────────────────────────────────────────────── */}
      <div
        style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setShowAI(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: showAI ? 'rgba(167,139,250,0.12)' : 'none',
            border: '1px solid rgba(167,139,250,0.25)', borderRadius: '10px',
            padding: '7px 16px', cursor: 'pointer', color: '#a78bfa',
            fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.12)'; }}
          onMouseOut={e => { if (!showAI) e.currentTarget.style.background = 'none'; }}
        >
          🤖 {showAI ? 'Ocultar tesis AI' : 'Ver tesis de inversión'}
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{showAI ? '▲' : '▼'}</span>
        </button>
        <span style={{ fontSize: '0.7rem', color: '#334155' }}>powered by Gemini</span>
      </div>

      {/* ── Panel Tesis AI ──────────────────────────────────────────────── */}
      {showAI && <AIThesisPanel item={item} />}
    </div>
  );
};

export default AssetCard;
