import React from 'react';
import { Link } from 'react-router-dom';
import { useMarketData } from '../../hooks/useMarketData';
import { useAuth } from '../../store/AuthContext';

const Header = () => {
  const { data } = useMarketData();
  const { isAuthenticated, logout } = useAuth();
  const [copRate, setCopRate] = React.useState('3.155');
  
  const vix = data?.MACRO?.VIX || '18.3';

  React.useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.rates && d.rates.COP) {
          setCopRate(Number(d.rates.COP).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
        } else {
          return fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(d2 => {
            if (d2?.rates?.COP) setCopRate(Number(d2.rates.COP).toLocaleString('es-CO'));
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🤖 <span style={{ background: 'linear-gradient(135deg, #00ff88, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>InversionBot</span>
          </Link>
          
          <nav style={{ display: 'flex', gap: '20px' }}>
            <Link to="/" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>Explorar</Link>
            <Link to="/backtesting" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>📊 Backtesting</Link>
            <Link to="/portfolio" style={{ color: isAuthenticated ? '#00ff88' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>Mi Portafolio</Link>
          </nav>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
            <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 'bold' }}>
              VIX: {vix} ⚡
            </span>
            <span style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: 'bold' }}>
              COP: ${copRate} 🇨🇴
            </span>
          </div>

          {isAuthenticated && (
            <button 
              onClick={logout}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ff4444', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Salir
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
