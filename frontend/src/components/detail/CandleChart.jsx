import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';

const CandleChart = ({ data, indicators, compareData, compareTicker }) => {
  const chartContainerRef = useRef();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!data || data.length === 0 || !chartContainerRef.current) return;

    chartContainerRef.current.innerHTML = '';
    
    let chart;
    try {
      chart = createChart(chartContainerRef.current, {
        layout: { 
          background: { type: ColorType.Solid, color: '#0f172a' }, 
          textColor: '#94a3b8' 
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width: chartContainerRef.current.clientWidth || 800,
        height: 400,
        timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
        leftPriceScale: { visible: !!compareData, borderColor: 'rgba(255, 255, 255, 0.1)' },
      });

      // CREACIÓN DE VELAS (v5 syntax)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981', downColor: '#ef4444', 
        borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });

      candleSeries.setData(data.map(d => ({
        time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
      })));

      // INDICADORES (LineSeries)
      if (indicators?.sma50) {
        const sma50 = chart.addSeries(LineSeries, { color: '#eab308', lineWidth: 2, title: 'SMA 50' });
        sma50.setData(data.filter(d => d.sma50).map(d => ({ time: d.time, value: d.sma50 })));
      }

      if (indicators?.sma100) {
        const sma100 = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 2, title: 'SMA 100' });
        sma100.setData(data.filter(d => d.sma100).map(d => ({ time: d.time, value: d.sma100 })));
      }

      if (indicators?.sma200) {
        const sma200 = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, title: 'SMA 200' });
        sma200.setData(data.filter(d => d.sma200).map(d => ({ time: d.time, value: d.sma200 })));
      }

      // COMPARACIÓN
      if (compareData && compareData.length > 0) {
        const comp = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: compareTicker, priceScaleId: 'left' });
        comp.setData(compareData.map(d => ({ time: d.time, value: d.close })));
      }

      chart.timeScale().fitContent();

      return () => { if (chart) chart.remove(); };
    } catch (e) {
      console.error('Error v5:', e);
      setError(e.message);
    }
  }, [data, indicators, compareData, compareTicker]);

  if (error) return <div style={{ color: '#ef4444', padding: '20px', background: '#1e293b', borderRadius: '12px' }}>⚠️ Error: {error}</div>;
  return <div ref={chartContainerRef} style={{ width: '100%', minHeight: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }} />;
};

export default CandleChart;
