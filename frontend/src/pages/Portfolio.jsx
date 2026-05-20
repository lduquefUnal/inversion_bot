import React from 'react';
import './Portfolio.css';

const Portfolio = () => {
    // Datos Dummy para el MVP de la Maqueta
    const myAssets = [
        { ticker: 'TSLA', buyPrice: 175.50, currentPrice: 182.30, amount: 10, dailyChange: 2.5, weeklyChange: 5.1 },
        { ticker: 'NVDA', buyPrice: 850.00, currentPrice: 890.15, amount: 2, dailyChange: -0.5, weeklyChange: 12.3 },
        { ticker: 'BTC-USD', buyPrice: 62000, currentPrice: 65400, amount: 0.1, dailyChange: 1.2, weeklyChange: -2.4 },
    ];

    const calculateProfit = (asset) => {
        const totalProfit = ((asset.currentPrice - asset.buyPrice) / asset.buyPrice) * 100;
        return totalProfit.toFixed(2);
    };

    return (
        <div className="portfolio-container">
            <header className="portfolio-header">
                <div className="header-info">
                    <h1>Mi Portafolio</h1>
                    <p className="subtitle">Seguimiento de activos personales</p>
                </div>
                <div className="total-value-card">
                    <span className="label">Valor Total Estimado</span>
                    <span className="value">$4,520.30</span>
                    <span className="profit-summary positive">+6.2% Total</span>
                </div>
            </header>

            <section className="portfolio-actions">
                <button className="add-asset-btn">+ Añadir Activo</button>
            </section>

            <div className="portfolio-grid">
                {myAssets.map((asset) => (
                    <div key={asset.ticker} className="portfolio-card">
                        <div className="card-top">
                            <div className="ticker-info">
                                <h2>{asset.ticker}</h2>
                                <span className="amount">{asset.amount} unidades</span>
                            </div>
                            <div className="total-profit-badge positive">
                                {calculateProfit(asset)}%
                            </div>
                        </div>

                        <div className="price-trends">
                            {/* Placeholder para la gráfica de la etapa 3 */}
                            <div className="mini-chart-mock">
                                <span className="chart-label">Tendencia 7D (Mockup)</span>
                                <div className="trend-line"></div>
                            </div>
                        </div>

                        <div className="card-metrics">
                            <div className="metric">
                                <span className="label">Promedio de Compra</span>
                                <span className="val">${asset.buyPrice.toLocaleString()}</span>
                            </div>
                            <div className="metric">
                                <span className="label">Precio Actual</span>
                                <span className="val">${asset.currentPrice.toLocaleString()}</span>
                            </div>
                            <div className="metric">
                                <span className="label">Cambio Diario</span>
                                <span className={`val ${asset.dailyChange >= 0 ? 'pos' : 'neg'}`}>
                                    {asset.dailyChange >= 0 ? '▲' : '▼'} {Math.abs(asset.dailyChange)}%
                                </span>
                            </div>
                            <div className="metric">
                                <span className="label">Cambio Semanal</span>
                                <span className={`val ${asset.weeklyChange >= 0 ? 'pos' : 'neg'}`}>
                                    {asset.weeklyChange >= 0 ? '▲' : '▼'} {Math.abs(asset.weeklyChange)}%
                                </span>
                            </div>
                        </div>

                        <div className="sell-oracle-badge hold">
                            <span className="icon">🛡️</span> VEREDICTO: HOLD
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Portfolio;
