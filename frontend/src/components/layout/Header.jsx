import React from 'react';
import { Link } from 'react-router-dom';
import { useMarketData } from '../../hooks/useMarketData';

const Header = () => {
  const { data } = useMarketData();
  const vix = data?.MACRO?.VIX || '18.3';
  const usdop = data?.MACRO?.['USD/COP'] || '3580';

  return (
    <header style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)', textDecoration: 'none' }}>
          🤖 InversionBot
        </Link>
        <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem' }}>
          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 'bold' }}>
            VIX: {vix} ⚡
          </span>
          <span style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(59,130,246,0.3)' }}>
            COP: ${usdop} 🇨🇴
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
