import sys
import os
import pandas as pd
import warnings
warnings.filterwarnings("ignore")
import yfinance as yf

def test_lider_tendencia():
    tickers = ["AAPL", "INTC", "PFE", "O", "TSLA", "NVDA", "BA"]
    print("Iniciando escaneo rápido de 7 acciones para prueba local (Etapa 4)...")
    
    resultados = []
    
    for t in tickers:
        stock = yf.Ticker(t)
        hist = stock.history(period="2y")
        
        if hist.empty or len(hist) < 260:
            continue
            
        current_price = float(hist['Close'].iloc[-1])
        hist_52w = hist.tail(252)
        max_price_52w = float(hist_52w['High'].max())
        drawdown_52w_pct = ((current_price - max_price_52w) / max_price_52w * 100) if max_price_52w > 0 else 0
        
        hist['SMA200'] = hist['Close'].rolling(window=200).mean()
        sma_200_actual = float(hist['SMA200'].iloc[-1])
        sma_200_pasada = float(hist['SMA200'].iloc[-21]) if len(hist) > 220 else sma_200_actual
        
        tendencia_bajista = False
        if not pd.isna(sma_200_actual) and not pd.isna(sma_200_pasada):
            if sma_200_actual < sma_200_pasada:
                tendencia_bajista = True
                
        score_ranking = drawdown_52w_pct
        if tendencia_bajista:
            score_ranking += 50.0  # Penalización
            
        resultados.append({
            "Ticker": t,
            "Drawdown Original": round(drawdown_52w_pct, 2),
            "Tendencia Bajista": tendencia_bajista,
            "Score Rank": round(score_ranking, 2)
        })
        
    print("\n--- RESULTADO TOP 7 (Orden natural del Score) ---")
    resultados = sorted(resultados, key=lambda x: x["Score Rank"])
    for i, r in enumerate(resultados):
        estado_tend = "⚠️ CUCHILLO CAYENDO" if r["Tendencia Bajista"] else "✅ TENDENCIA SANA"
        print(f"Top {i+1}: {r['Ticker']} | Drawdown Real: {r['Drawdown Original']}% | Score Rank Final: {r['Score Rank']} | {estado_tend}")

if __name__ == "__main__":
    test_lider_tendencia()
