import React from 'react';
import AssetCard from './AssetCard';
import { useAppStore } from '../../store/useAppStore';
import { STRATEGIES } from '../../store/strategies';
import { motion, AnimatePresence } from 'framer-motion';

const AssetGrid = ({ data }) => {
  const { activeCategory, activeStrategy, searchTerm } = useAppStore();
  
  if (!data?.TOP_25_DIPS) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No hay datos disponibles.</div>;
  }

  // Filter by category
  let filteredData = data.TOP_25_DIPS;
  
  if (activeCategory !== 'all') {
    if (activeCategory === 'veredicto') {
       filteredData = filteredData.filter(item => item.AI_Details && item.AI_Details.includes('✅'));
    } else {
       filteredData = filteredData.filter(item => {
         const cat = item.Categoria || "Sweet Spot";
         return cat === activeCategory;
       });
    }
  }

  // Filter by search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredData = filteredData.filter(item => 
      item.Ticker.toLowerCase().includes(term) || 
      item.Nombre.toLowerCase().includes(term)
    );
  }

  // Filter by strategy
  const strategyInfo = STRATEGIES[activeStrategy];
  if (strategyInfo && strategyInfo.filter) {
      filteredData = filteredData.filter(strategyInfo.filter);
  }

  if (filteredData.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)', background: 'var(--panel-bg)', borderRadius: '12px' }}
      >
        <h3>No hay activos que cumplan con los filtros actuales.</h3>
        <p>Intenta cambiar la categoría o la estrategia seleccionada.</p>
      </motion.div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '30px', 
      marginTop: '30px',
      maxWidth: '1000px',
      margin: '20px auto'
    }}>
      <AnimatePresence mode='popLayout'>
        {filteredData.map((item, i) => (
          <motion.div
            key={item.Ticker}
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <AssetCard item={item} index={data.TOP_25_DIPS.indexOf(item)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AssetGrid;
