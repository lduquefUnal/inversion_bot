import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { STRATEGIES } from '../../store/strategies';

const StrategySelector = () => {
  const { activeStrategy, setActiveStrategy } = useAppStore();

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {Object.values(STRATEGIES).map((strategy) => (
          <button
            key={strategy.id}
            disabled={!strategy.available}
            onClick={() => setActiveStrategy(strategy.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: `1px solid ${activeStrategy === strategy.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: activeStrategy === strategy.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--panel-bg)',
              color: activeStrategy === strategy.id ? 'var(--accent-color)' : (strategy.available ? 'var(--text-primary)' : 'var(--text-secondary)'),
              cursor: strategy.available ? 'pointer' : 'not-allowed',
              opacity: strategy.available ? 1 : 0.6,
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            {strategy.emoji} {strategy.label} {!strategy.available && '(Pronto)'}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
        {STRATEGIES[activeStrategy]?.description}
      </p>
    </div>
  );
};

export default StrategySelector;
