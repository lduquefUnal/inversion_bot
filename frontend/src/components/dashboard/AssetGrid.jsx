import React from 'react';
import AssetCard from './AssetCard';
import { useAppStore } from '../../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';

const CAT_KEYS = {
  'Sweet Spot': 'Sweet Spot',
  'Cazador Dips': 'Cazador Dips',
  'Recup. Rapida': 'Recup. Rapida',
  'Cuchillos Cayendo': 'Cuchillos Cayendo',
};

const AssetGrid = ({ data }) => {
  const { activeCategory, searchTerm } = useAppStore();

  if (!data?.TOP_25_DIPS || data.TOP_25_DIPS.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        No hay datos disponibles.
      </div>
    );
  }

  // Datos ya vienen ordenados por Probabilidad_Exito_% desc desde el JSON
  let filtered = data.TOP_25_DIPS;

  if (activeCategory && activeCategory !== 'all') {
    if (activeCategory === 'veredicto') {
      filtered = filtered.filter(item => item.Veredicto_V2 === 'BUY');
    } else {
      filtered = filtered.filter(item => item.Categoria === CAT_KEYS[activeCategory] || item.Categoria === activeCategory);
    }
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.Ticker?.toLowerCase().includes(term) ||
        item.Nombre?.toLowerCase().includes(term),
    );
  }

  if (filtered.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--text-secondary)', background: 'var(--panel-bg)', borderRadius: '12px',
        }}
      >
        <h3>No hay activos que cumplan con los filtros actuales.</h3>
        <p>Intenta cambiar la categoría o el término de búsqueda.</p>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px', maxWidth: '1050px', margin: '20px auto' }}>
      <AnimatePresence mode="popLayout">
        {filtered.map((item, i) => (
          <motion.div
            key={item.Ticker}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            <AssetCard item={item} rank={i + 1} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AssetGrid;
