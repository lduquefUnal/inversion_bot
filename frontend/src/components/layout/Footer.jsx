import React from 'react';

const Footer = () => {
  return (
    <footer style={{ padding: '40px 20px', borderTop: '1px solid var(--border-color)', marginTop: 'auto', textAlign: 'center' }}>
      <div className="container">
        <h3>☕ ¿Te fue útil InversionBot?</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Si el análisis te ayudó, puedes invitarme a un café.</p>
        <div style={{ marginTop: '20px' }}>
          <a href="https://paypal.me/luisduquef" target="_blank" rel="noreferrer" style={{ background: '#ffc439', color: '#000', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold' }}>
            💛 Donar en PayPal
          </a>
        </div>
        <p style={{ marginTop: '40px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Hecho con ❤️ por Luis Duque · lduquefUnal
        </p>
      </div>
    </footer>
  );
};

export default Footer;
