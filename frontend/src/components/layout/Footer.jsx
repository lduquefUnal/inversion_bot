import React, { useState } from 'react';

const Footer = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyBreB = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText('@LDF628').then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  };

  return (
    <footer style={{ padding: '50px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 'auto', textAlign: 'center', background: 'rgba(10,16,28,0.7)' }}>
      <div className="container" style={{ maxWidth: '780px', margin: '0 auto' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.4rem', color: '#f8fafc' }}>
          ☕ ¿Te fue útil InversionBot?
        </h3>
        <p style={{ margin: '0 0 24px', color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Si el análisis cuantitativo te aportó valor o te ayudó a tomar mejores decisiones, puedes apoyar el desarrollo e investigación invitándome a un café.
        </p>

        {/* Opciones de Donación: Bre-B (Colombia) y PayPal (Internacional) */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'stretch',
          gap: '16px', flexWrap: 'wrap', margin: '0 auto 30px'
        }}>
          {/* Opción 1: Bre-B Colombia */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
            borderRadius: '16px', border: '1px solid rgba(16,185,129,0.3)',
            padding: '16px 20px', minWidth: '280px', flex: '1 1 300px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🇨🇴</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Bre-B · Colombia (Transferencias)
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px', lineHeight: 1.4 }}>
                Transfiere desde cualquier banco o billetera digital (Bancolombia, Nequi, Daviplata, etc.) usando la llave oficial:
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '8px 12px',
              border: '1px dashed rgba(16,185,129,0.4)'
            }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums' }}>
                @LDF628
              </span>
              <button
                onClick={handleCopyBreB}
                aria-label="Copiar llave Bre-B @LDF628"
                style={{
                  background: copied ? '#10b981' : 'rgba(16,185,129,0.2)',
                  color: copied ? '#fff' : '#10b981',
                  border: '1px solid rgba(16,185,129,0.4)',
                  borderRadius: '8px', padding: '6px 12px',
                  fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'background-color 0.2s ease, color 0.2s ease'
                }}
              >
                {copied ? '✅ ¡Copiada!' : '📋 Copiar'}
              </button>
            </div>
          </div>

          {/* Opción 2: PayPal Internacional */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
            borderRadius: '16px', border: '1px solid rgba(255,196,57,0.3)',
            padding: '16px 20px', minWidth: '240px', flex: '1 1 260px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🌎</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PayPal · Internacional
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px', lineHeight: 1.4 }}>
                Aportes internacionales en USD o cualquier moneda mediante tarjeta o saldo PayPal:
              </div>
            </div>

            <a
              href="https://paypal.me/luisduquef"
              target="_blank"
              rel="noreferrer"
              aria-label="Donar en PayPal a Luis Duque"
              style={{
                background: 'linear-gradient(135deg, #ffc439, #f59e0b)',
                color: '#0f172a', padding: '10px 18px', borderRadius: '12px',
                fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
                transition: 'transform 0.2s ease'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              💛 Donar en PayPal
            </a>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569' }}>
          Hecho con rigor cuantitativo por Luis Duque · lduquefUnal · InversionBot V5.0 MLOps
        </p>
      </div>
    </footer>
  );
};

export default Footer;
