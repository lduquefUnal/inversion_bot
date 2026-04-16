import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Dashboard from './pages/Dashboard';
import AssetDetail from './pages/AssetDetail';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const { zoomedImage, setZoomedImage } = useAppStore();

  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/activo/:ticker" element={<AssetDetail />} />
        </Routes>
      </main>
      <Footer />

      {/* Modal global de Zoom */}
      {zoomedImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setZoomedImage(null)}>
          <button style={{
             position: 'absolute', top: '20px', right: '30px', background: 'rgba(255,255,255,0.1)', 
             border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 15px', 
             borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold'
          }} onClick={() => setZoomedImage(null)}>✕</button>
          <img src={zoomedImage} style={{ maxWidth: '90vw', maxHeight: '90vh', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} alt="Zoomed Asset" onClick={(e) => e.stopPropagation()}/>
        </div>
      )}
    </div>
  );
}

export default App;
