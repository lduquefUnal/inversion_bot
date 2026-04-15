import React from 'react';
import { motion } from 'framer-motion';
import FilterBar from '../components/dashboard/FilterBar';
import StrategySelector from '../components/dashboard/StrategySelector';
import AssetGrid from '../components/dashboard/AssetGrid';
import { useMarketData } from '../hooks/useMarketData';
import { useAppStore } from '../store/useAppStore';
import { STRATEGIES } from '../store/strategies';

const Dashboard = () => {
  const { data, isLoading, error } = useMarketData();
  const { activeStrategy } = useAppStore();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>🤖 Analizando el mercado...</h2>
        <p>Cargando los últimos datos de los Dips Agresivos.</p>
        <div className="loading-spinner" style={{
           width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', 
           borderTop: '4px solid #3b82f6', borderRadius: '50%', margin: '20px auto', 
           animation: 'spin 1s linear infinite'
        }} />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#ef4444' }}>
        <h2>❌ Error cargando los datos</h2>
        <p>{error.message}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Intenta recargar la página más tarde.</p>
      </div>
    );
  }

  const ultimaVezString = data?.fecha_generacion ? `Actualizado: ${data.fecha_generacion} UTC` : 'Actualizando datos...';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Resultados del Escáner</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', background: 'var(--panel-bg)', padding: '5px 12px', borderRadius: '20px' }}>
          ⏱️ {ultimaVezString}
        </span>
      </div>

      <StrategySelector />

      <motion.div 
        key={activeStrategy}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: '30px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}
      >
        🎯 Estrategia <strong>{activeStrategy.charAt(0).toUpperCase() + activeStrategy.slice(1)}</strong>: {STRATEGIES[activeStrategy]?.description || ''}
      </motion.div>

      <FilterBar />
      <AssetGrid data={data} />

      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', marginTop: '50px' }}>
        <h4 style={{ color: '#f8fafc', marginBottom: '10px' }}>⚠️ Descargo de Responsabilidad (Disclaimer)</h4>
        <p style={{ fontSize: '0.85rem', lineHeight: '1.6', maxWidth: '800px', margin: '0 auto' }}>
          Este reporte es generado por inteligencia artificial con fines **lúdicos, educativos y de programación**.  
          Ni la IA, ni el programador (Luis Duque) son asesores financieros.  
          Los montos como "$100 USD" o "$120 USD" son **completamente ficticios** y forman parte de una simulación de la "Estrategia Valiente (Smart DCA)".
          <br /><br />
          Invertir en la bolsa conlleva riesgos de pérdida total de capital. Haz tu propia investigación antes de operar.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
