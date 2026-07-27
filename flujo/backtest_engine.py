import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import datetime

# Universo ampliado: Acciones, ETFs/Índices y Cripto
TICKERS_UNIVERSE = [
    # Índices y Fondos (ETFs)
    "SPY", "QQQ", "VTI", "IWM", "DIA", "XLF", "XLE", "XLK", "XLV", "XBI",
    # Criptomonedas y Crypto-Adjacent
    "BTC-USD", "ETH-USD", "SOL-USD", "COIN", "MSTR",
    # Tecnología e IA
    "NVDA", "AMD", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "PLTR", "TSM",
    # Materias Primas y Energía
    "GLD", "URNJ", "COPX", "SILJ", "CCJ", "FCX",
    # LatAm y Emergentes
    "MELI", "NU", "PBR", "VALE", "EWW",
    # REITs y Dividendos
    "O", "PLD", "AMT", "SCHD"
]

def calcular_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-8)
    return 100 - (100 / (1 + rs))

def detectar_categoria_dip(row):
    dd = float(row.get('Drawdown52', 0))
    rsi = float(row.get('RSI', 50))
    cambio_5d = float(row.get('Cambio5D', 0))

    if dd <= -40 and rsi < 35:
        return "🔥 Cazador Dips"
    elif dd <= -20 and rsi < 45:
        return "🎯 Sweet Spot"
    elif rsi < 32 and cambio_5d > 2.0:
        return "⚡ Recup. Rápida"
    elif dd <= -45:
        return "⚠️ Cuchillos Cayendo"
    return None

def simular_trade_fast(highs, lows, closes, dates, entry_idx, tp_pct, sl_pct, max_days):
    entry_price = closes[entry_idx]
    entry_date = dates[entry_idx]
    target_tp = entry_price * (1 + tp_pct / 100.0)
    target_sl = entry_price * (1 - sl_pct / 100.0)

    end_idx = min(len(closes), entry_idx + 1 + max_days)
    for i in range(entry_idx + 1, end_idx):
        if highs[i] >= target_tp:
            return tp_pct
        if lows[i] <= target_sl:
            return -sl_pct

    if end_idx > entry_idx + 1:
        last_p = closes[end_idx - 1]
        return ((last_p - entry_price) / entry_price) * 100.0
    return 0.0

def optimizar_categoria(trades_list):
    if not trades_list:
        return {
            "tpPct": 5, "slPct": 8, "maxDays": 30,
            "winRate": 0.0, "avgPnlPct": 0.0, "totalTrades": 0, "expectancy": 0.0
        }

    # Pre-extraer estructuras numpy
    pre_extracted = []
    for item in trades_list:
        df = item['df']
        pre_extracted.append({
            "highs": df['High'].to_numpy(),
            "lows": df['Low'].to_numpy(),
            "closes": df['Close'].to_numpy(),
            "dates": df.index,
            "entry_idx": item['entry_idx']
        })

    tp_grid = [3, 5, 8, 10, 15]
    sl_grid = [5, 8, 10, 12, 15]
    days_grid = [15, 30, 45, 60]

    best_result = None
    best_score = -999999

    for tp in tp_grid:
        for sl in sl_grid:
            for days in days_grid:
                trade_results = []
                for item in pre_extracted:
                    res = simular_trade_fast(item['highs'], item['lows'], item['closes'], item['dates'], item['entry_idx'], tp, sl, days)
                    trade_results.append(res)

                if not trade_results: continue

                wins = [r for r in trade_results if r > 0]
                win_rate = (len(wins) / len(trade_results)) * 100.0
                avg_pnl = float(np.mean(trade_results))
                expectancy = (win_rate / 100.0 * tp) - ((1 - win_rate / 100.0) * sl)

                score = avg_pnl * 0.6 + expectancy * 0.4

                if score > best_score:
                    best_score = score
                    best_result = {
                        "tpPct": tp,
                        "slPct": sl,
                        "maxDays": days,
                        "winRate": round(float(win_rate), 1),
                        "avgPnlPct": round(float(avg_pnl), 2),
                        "totalTrades": len(trade_results),
                        "expectancy": round(float(expectancy), 2)
                    }

    return best_result or {
        "tpPct": 5, "slPct": 8, "maxDays": 30,
        "winRate": 50.0, "avgPnlPct": 0.0, "totalTrades": len(trades_list), "expectancy": 0.0
    }

def main():
    print("🚀 Ejecutando Motor de Backtesting V2 (Trade-a-Trade + Grid Search TP/SL/Días)...")

    # Almacenamiento por categoría
    trades_by_category = {
        "🔥 Cazador Dips": [],
        "🎯 Sweet Spot": [],
        "⚡ Recup. Rápida": [],
        "⚠️ Cuchillos Cayendo": []
    }

    # Registro del último mes
    recent_signals = []

    now_date = datetime.datetime.now(datetime.timezone.utc)
    one_month_ago = now_date - datetime.timedelta(days=35)

    for ticker in TICKERS_UNIVERSE:
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period="3y")
            if df.empty or len(df) < 100: continue

            df['RSI'] = calcular_rsi(df['Close'])
            df['High52'] = df['High'].rolling(window=252, min_periods=50).max()
            df['Drawdown52'] = ((df['Close'] - df['High52']) / df['High52']) * 100
            df['Cambio5D'] = df['Close'].pct_change(periods=5) * 100

            for i in range(50, len(df) - 1):
                row = df.iloc[i]
                cat = detectar_categoria_dip(row)
                if cat:
                    trades_by_category[cat].append({
                        "ticker": ticker,
                        "entry_date": df.index[i],
                        "entry_idx": i,
                        "df": df
                    })

                    # Si ocurrió en los últimos 35 días, guardarlo como señal reciente
                    signal_dt = df.index[i].to_pydatetime()
                    if signal_dt.tzinfo is None:
                        signal_dt = signal_dt.replace(tzinfo=datetime.timezone.utc)

                    if signal_dt >= one_month_ago:
                        curr_price = float(df['Close'].iloc[-1])
                        entry_price = float(row['Close'])
                        pnl_current = ((curr_price - entry_price) / entry_price) * 100.0
                        recent_signals.append({
                            "ticker": ticker,
                            "categoria": cat,
                            "fechaAlerta": signal_dt.strftime('%Y-%m-%d'),
                            "precioEntrada": round(entry_price, 2),
                            "precioActual": round(curr_price, 2),
                            "pnlPct": round(pnl_current, 2),
                            "estado": "Ganadora 🎯" if pnl_current >= 5.0 else ("Perdedora 🔴" if pnl_current <= -8.0 else "En Proceso ⏳")
                        })
        except Exception as e:
            print(f"Error procesando {ticker}: {e}")

    print("📊 Optimizando parámetros por Categoría de Dip...")
    optimizations = {}
    for cat, trades in trades_by_category.items():
        opt = optimizar_categoria(trades)
        optimizations[cat] = opt
        print(f"  - {cat}: Optimo TP+{opt['tpPct']}% / SL-{opt['slPct']}% / {opt['maxDays']}d (WR: {opt['winRate']}%, Avg: {opt['avgPnlPct']}%)")

    # Formatear alertas recientes (ordenadas por fecha descendente)
    recent_signals = sorted(recent_signals, key=lambda x: x['fechaAlerta'], reverse=True)[:25]

    output_data = {
        "fecha_generacion": now_date.strftime('%Y-%m-%d %H:%M UTC'),
        "optimizacionesPorCategoria": optimizations,
        "alertasUltimoMes": recent_signals
    }

    os.makedirs("flujo_datos", exist_ok=True)
    with open("flujo_datos/backtest_results.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)

    try:
        os.makedirs("frontend/public", exist_ok=True)
        with open("frontend/public/backtest_results.json", "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=4, ensure_ascii=False)
    except: pass

    print("✅ Motor de Backtesting V2 completado exitosamente.")

if __name__ == "__main__":
    main()
