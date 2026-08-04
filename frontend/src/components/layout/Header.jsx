import React from 'react';
import { Link } from 'react-router-dom';
import { useMarketData } from '../../hooks/useMarketData';
import { useAuth } from '../../store/AuthContext';

const Header = () => {
  const { data } = useMarketData();
  const { isAuthenticated, logout } = useAuth();
  const [copRate, setCopRate] = React.useState('3,230.44');
  
  const vix = data?.MACRO?.VIX || '18.3';

  React.useEffect(() => {
    // Consulta de TRM Oficial de Colombia (dolar-colombia.com) en vivo
    const fetchTrmOficial = async () => {
      try {
        const targetUrl = 'https://www.dolar-colombia.com/';
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const wrapper = await res.json();
          if (wrapper?.contents) {
            const match = wrapper.contents.match(/exchange-rate_up[^">]*>.*?([\d\.,]+)<\/span>/) ||
                          wrapper.contents.match(/3,[\d\.,]+/);
            if (match && match[1]) {
              setCopRate(match[1]);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('[TRM Colombia] Fallback a API global');
      }

      // Fallback a API global de tipos de cambio
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (res.ok) {
          const d = await res.json();
          if (d?.rates?.COP) {
            setCopRate(Number(d.rates.COP).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          }
        }
      } catch (e) {}
    };

    fetchTrmOficial();
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
