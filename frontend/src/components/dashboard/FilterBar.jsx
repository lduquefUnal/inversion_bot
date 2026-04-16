import React from 'react';
import { useAppStore } from '../../store/useAppStore';

const CATEGORIES = [
  { id: 'all', label: '🔭 Todos', type: 'all' },
  { id: 'Recuperacion Rapida', label: '⚡ Recup. Rápida', type: 'verde' },
  { id: 'Sweet Spot', label: '🎯 Sweet Spot', type: 'yellow' },
  { id: 'Cazador de Dips', label: '🔥 Cazador Dips', type: 'red' },
  { id: 'Cuchillo Cayendo', label: '⚠️ Cuchillos', type: 'gray' },
];

const FilterBar = () => {
  const { activeCategory, setActiveCategory, searchTerm, setSearchTerm } = useAppStore();

  const getColorConfig = (type) => {
    switch(type) {
      case 'verde': return { bg: 'rgba(16,185,129,0.2)', color: '#10b981', border: '#10b981' };
      case 'yellow': return { bg: 'rgba(234,179,8,0.2)', color: '#eab308', border: '#eab308' };
      case 'red': return { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '#ef4444' };
      case 'gray': return { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8', border: '#64748b' };
      default: return { bg: '#3b82f6', color: 'white', border: '#3b82f6' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: '20px 0' }}>
      {/* Buscador */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
        <input 
          type="text" 
          placeholder="🔍 Buscar ticker o empresa..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: '100%', padding: '12px 20px', borderRadius: '30px', 
            background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-color)',
            color: 'white', fontSize: '0.95rem', outline: 'none'
          }}
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem'}}
          >✕</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id;
          const cfg = getColorConfig(cat.type);
          
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: isActive ? cfg.bg : 'var(--panel-bg)',
                color: isActive ? cfg.color : 'var(--text-secondary)',
                border: `1px solid ${isActive ? cfg.border : 'var(--border-color)'}`,
                padding: '10px 20px',
                borderRadius: '30px',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: isActive ? `0 4px 15px ${cfg.bg}` : 'none'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterBar;
