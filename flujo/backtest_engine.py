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

TICKER_SECTORS = {
    "BTC-USD": "Cripto", "ETH-USD": "Cripto", "SOL-USD": "Cripto",
    "COIN": "Fintech & Crypto-Adj", "MSTR": "Fintech & Crypto-Adj",
    "NVDA": "Tecnología & IA", "AMD": "Tecnología & IA", "AAPL": "Tecnología & IA", "MSFT": "Tecnología & IA",
    "GOOGL": "Tecnología & IA", "AMZN": "Tecnología & IA", "TSLA": "Tecnología & IA", "META": "Tecnología & IA",
    "PLTR": "Tecnología & IA", "TSM": "Tecnología & IA",
    "GLD": "Commodities & Energía", "URNJ": "Commodities & Energía", "COPX": "Commodities & Energía",
    "SILJ": "Commodities & Energía", "CCJ": "Commodities & Energía", "FCX": "Commodities & Energía",
    "SPY": "ETFs & Índices", "QQQ": "ETFs & Índices", "VTI": "ETFs & Índices", "IWM": "ETFs & Índices",
    "DIA": "ETFs & Índices", "XLF": "ETFs & Índices", "XLE": "ETFs & Índices", "XLK": "ETFs & Índices",
    "XLV": "ETFs & Índices", "XBI": "ETFs & Índices", "EWW": "ETFs & Índices", "SCHD": "ETFs & Índices",
    "MELI": "LatAm & Emergentes", "NU": "LatAm & Emergentes", "PBR": "LatAm & Emergentes", "VALE": "LatAm & Emergentes",
    "O": "REITs & Inmobiliario", "PLD": "REITs & Inmobiliario", "AMT": "REITs & Inmobiliario"
}

TICKER_TYPES = {
    # Criptomonedas
    "BTC-USD": "Cripto", "ETH-USD": "Cripto", "SOL-USD": "Cripto",
    # ETFs e Índices
    "SPY": "ETF / Índice", "QQQ": "ETF / Índice", "VTI": "ETF / Índice", "IWM": "ETF / Índice", "DIA": "ETF / Índice",
    "XLF": "ETF / Índice", "XLE": "ETF / Índice", "XLK": "ETF / Índice", "XLV": "ETF / Índice", "XBI": "ETF / Índice",
    "GLD": "ETF / Índice", "URNJ": "ETF / Índice", "COPX": "ETF / Índice", "SILJ": "ETF / Índice", "EWW": "ETF / Índice", "SCHD": "ETF / Índice",
    # Acciones
    "COIN": "Acción", "MSTR": "Acción", "NVDA": "Acción", "AMD": "Acción", "AAPL": "Acción", "MSFT": "Acción",
    "GOOGL": "Acción", "AMZN": "Acción", "TSLA": "Acción", "META": "Acción", "PLTR": "Acción", "TSM": "Acción",
    "CCJ": "Acción", "FCX": "Acción", "MELI": "Acción", "NU": "Acción", "PBR": "Acción", "VALE": "Acción",
    "O": "Acción", "PLD": "Acción", "AMT": "Acción"
}

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
    target_tp = entry_price * (1 + tp_pct / 100.0)
    target_sl = entry_price * (1 - sl_pct / 100.0)

    end_idx = min(len(closes), entry_idx + 1 + max_days)
    for i in range(entry_idx + 1, end_idx):
        if highs[i] >= target_tp:
            return tp_pct, (i - entry_idx)
        if lows[i] <= target_sl:
            return -sl_pct, (i - entry_idx)

    if end_idx > entry_idx + 1:
        last_p = closes[end_idx - 1]
        pnl = ((last_p - entry_price) / entry_price) * 100.0
        return pnl, (end_idx - 1 - entry_idx)
    return 0.0, 1

def optimizar_categoria(trades_1d, trades_2d):
    if not trades_1d and not trades_2d:
        return {
            "tpPct": 5, "slPct": 8, "maxDays": 30, "diasConsecutivos": 1,
            "winRate": 0.0, "avgPnlPct": 0.0, "avgDaysHeld": 0, "cagrPct": 0.0, "totalTrades": 0, "expectancy": 0.0
        }, []

    def prepare_data(trades_list):
        res = []
        for item in trades_list:
            df = item['df']
            res.append({
                "ticker": item['ticker'],
                "sector": item.get('sector', 'Otros'),
                "highs": df['High'].to_numpy(),
                "lows": df['Low'].to_numpy(),
                "closes": df['Close'].to_numpy(),
                "dates": df.index,
                "entry_idx": item['entry_idx']
            })
        return res

    data_1d = prepare_data(trades_1d)
    data_2d = prepare_data(trades_2d)

    tp_grid = [5, 8, 10, 12, 15]
    sl_grid = [5, 8, 10, 12, 15]
    days_grid = [7, 14, 21, 30, 45, 60, 75]
    consec_grid = [(1, data_1d), (2, data_2d)]

    best_result = None
    best_score = -999999
    best_trade_details = []

    for c_days, dataset in consec_grid:
        if not dataset: continue
        for tp in tp_grid:
            for sl in sl_grid:
                for days in days_grid:
                    trade_results = []
                    days_held_list = []
                    current_details = []
                    for item in dataset:
                        pnl, d_held = simular_trade_fast(item['highs'], item['lows'], item['closes'], item['dates'], item['entry_idx'], tp, sl, days)
                        trade_results.append(pnl)
                        days_held_list.append(max(1, d_held))
                        current_details.append({ "sector": item['sector'], "pnl": pnl })

                    if not trade_results: continue

                    wins = [r for r in trade_results if r > 0]
                    win_rate = (len(wins) / len(trade_results)) * 100.0
                    if win_rate < 45.0: continue # Filtro mínimo de protección de aciertos

                    avg_pnl = float(np.mean(trade_results))
                    avg_days = float(np.mean(days_held_list))
                    expectancy = (win_rate / 100.0 * tp) - ((1 - win_rate / 100.0) * sl)

                    # Tasa de Rentabilidad Anualizada basada en velocidad de rotación
                    daily_speed = avg_pnl / avg_days
                    cagr_pct = daily_speed * 365.0

                    # Score Fine Tuning (Combina Anualizado + Tasa Aciertos + Expectativa)
                    score = (cagr_pct * 0.40) + (win_rate * 0.35) + (expectancy * 0.25)

                    if score > best_score:
                        best_score = score
                        best_trade_details = current_details
                        best_result = {
                            "tpPct": tp,
                            "slPct": sl,
                            "maxDays": days,
                            "diasConsecutivos": c_days,
                            "winRate": round(float(win_rate), 1),
                            "avgPnlPct": round(float(avg_pnl), 2),
                            "avgDaysHeld": round(float(avg_days), 1),
                            "cagrPct": round(float(cagr_pct), 1),
                            "totalTrades": len(trade_results),
                            "expectancy": round(float(expectancy), 2)
                        }

    return (best_result or {
        "tpPct": 5, "slPct": 8, "maxDays": 30, "diasConsecutivos": 1,
        "winRate": 50.0, "avgPnlPct": 0.0, "avgDaysHeld": 15, "cagrPct": 0.0, "totalTrades": len(trades_1d), "expectancy": 0.0
    }), best_trade_details

def main():
    print("🚀 Ejecutando Motor de Backtesting V4 (Optimización Sectorial + Corrección SL Auditoría)...")

    trades_1d = { "🔥 Cazador Dips": [], "🎯 Sweet Spot": [], "⚡ Recup. Rápida": [], "⚠️ Cuchillos Cayendo": [] }
    trades_2d = { "🔥 Cazador Dips": [], "🎯 Sweet Spot": [], "⚡ Recup. Rápida": [], "⚠️ Cuchillos Cayendo": [] }

    raw_audit_signals = []

    now_date = datetime.datetime.now(datetime.timezone.utc)
    ninety_days_ago = now_date - datetime.timedelta(days=90)

    for ticker in TICKERS_UNIVERSE:
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period="5y")
            if df.empty or len(df) < 100: continue

            df['RSI'] = calcular_rsi(df['Close'])
            df['High52'] = df['High'].rolling(window=252, min_periods=50).max()
            df['Drawdown52'] = ((df['Close'] - df['High52']) / df['High52']) * 100
            df['Cambio5D'] = df['Close'].pct_change(periods=5) * 100

            sector = TICKER_SECTORS.get(ticker, "Otros")
            tipo_activo = TICKER_TYPES.get(ticker, "Acción")

            last_entry_1d = -999
            last_entry_2d = -999

            for i in range(50, len(df) - 1):
                row_hoy = df.iloc[i]
                row_ayer = df.iloc[i - 1]
                cat_hoy = detectar_categoria_dip(row_hoy)
                cat_ayer = detectar_categoria_dip(row_ayer)

                if cat_hoy:
                    if (i - last_entry_1d) >= 14:
                        last_entry_1d = i
                        trades_1d[cat_hoy].append({
                            "ticker": ticker,
                            "tipoActivo": tipo_activo,
                            "sector": sector,
                            "entry_date": df.index[i],
                            "entry_idx": i,
                            "df": df
                        })

                if cat_hoy and cat_hoy == cat_ayer:
                    if (i - last_entry_2d) >= 14:
                        last_entry_2d = i
                        trades_2d[cat_hoy].append({
                            "ticker": ticker,
                            "tipoActivo": tipo_activo,
                            "sector": sector,
                            "entry_date": df.index[i],
                            "entry_idx": i,
                            "df": df
                        })

                        signal_dt = df.index[i].to_pydatetime()
                        if signal_dt.tzinfo is None:
                            signal_dt = signal_dt.replace(tzinfo=datetime.timezone.utc)

                        if signal_dt >= ninety_days_ago:
                            raw_audit_signals.append({
                                "ticker": ticker,
                                "tipoActivo": tipo_activo,
                                "sector": sector,
                                "categoria": cat_hoy,
                                "signal_dt": signal_dt,
                                "entry_idx": i,
                                "row_hoy": row_hoy,
                                "df": df
                            })

        except Exception as e:
            print(f"Error procesando {ticker}: {e}")

    print("📊 Optimizando parámetros por Categoría y analizando sectores...")
    optimizations = {}
    sector_trades = {}

    for cat in trades_1d.keys():
        opt, details = optimizar_categoria(trades_1d[cat], trades_2d[cat])
        optimizations[cat] = opt
        print(f"  - {cat}: Optimo TP+{opt['tpPct']}% / SL-{opt['slPct']}% / {opt['maxDays']}d (WR: {opt['winRate']}%, Avg: {opt['avgPnlPct']}%)")

        for d in details:
            sec = d['sector']
            if sec not in sector_trades:
                sector_trades[sec] = []
            sector_trades[sec].append(d['pnl'])

    analisis_sector = {}
    for sec, pnl_list in sector_trades.items():
        if not pnl_list: continue
        wins = [p for p in pnl_list if p > 0]
        wr = (len(wins) / len(pnl_list)) * 100.0
        avg_p = float(np.mean(pnl_list))
        analisis_sector[sec] = {
            "totalTrades": len(pnl_list),
            "winRate": round(float(wr), 1),
            "avgPnlPct": round(float(avg_p), 2)
        }

    # Evaluar señales de Auditoría usando los parámetros dinámicos óptimos de cada categoría (ej. SL -12% para Sweet Spot)
    audit_signals = []
    for item in raw_audit_signals:
        cat = item['categoria']
        opt = optimizations.get(cat, {"tpPct": 15, "slPct": 12, "maxDays": 60})
        tp_val = opt['tpPct']
        sl_val = opt['slPct']
        max_d = opt['maxDays']

        df = item['df']
        i = item['entry_idx']
        entry_price = float(item['row_hoy']['Close'])
        signal_dt = item['signal_dt']

        highs = df['High'].to_numpy()
        lows = df['Low'].to_numpy()
        closes = df['Close'].to_numpy()

        target_tp = entry_price * (1 + tp_val / 100.0)
        target_sl = entry_price * (1 - sl_val / 100.0)

        estado = "En Proceso ⏳"
        precio_salida = float(closes[-1])
        pnl_current = ((precio_salida - entry_price) / entry_price) * 100.0

        for idx_fut in range(i + 1, min(len(closes), i + 1 + max_d)):
            h = highs[idx_fut]
            l = lows[idx_fut]
            if h >= target_tp:
                estado = "Ganadora 🎯"
                pnl_current = float(tp_val)
                precio_salida = target_tp
                break
            elif l <= target_sl:
                estado = "Perdedora 🔴"
                pnl_current = -float(sl_val)
                precio_salida = target_sl
                break

        if estado == "En Proceso ⏳":
            days_passed = (now_date - signal_dt).days
            if (i + max_d < len(closes)) or (days_passed >= max_d):
                idx_close = min(len(closes) - 1, i + max_d)
                precio_salida = float(closes[idx_close])
                pnl_current = ((precio_salida - entry_price) / entry_price) * 100.0
                estado = "Salida x Tiempo ⏱️" if pnl_current >= 0 else "Perdedora 🔴"

        audit_signals.append({
            "ticker": item['ticker'],
            "tipoActivo": item['tipoActivo'],
            "sector": item['sector'],
            "categoria": cat,
            "fechaAlerta": signal_dt.strftime('%Y-%m-%d'),
            "precioEntrada": round(entry_price, 2),
            "precioActual": round(precio_salida, 2),
            "pnlPct": round(pnl_current, 2),
            "estado": estado
        })

    audit_signals = sorted(audit_signals, key=lambda x: x['fechaAlerta'], reverse=True)

    output_data = {
        "fecha_generacion": now_date.strftime('%Y-%m-%d %H:%M UTC'),
        "optimizacionesPorCategoria": optimizations,
        "analisisPorSector": analisis_sector,
        "alertasUltimoMes": audit_signals
    }

    os.makedirs("flujo_datos", exist_ok=True)
    with open("flujo_datos/backtest_results.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)

    try:
        os.makedirs("frontend/public", exist_ok=True)
        with open("frontend/public/backtest_results.json", "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=4, ensure_ascii=False)
    except: pass

    print("✅ Motor de Backtesting V4 completado con análisis por sector y auditoría corregida.")

if __name__ == "__main__":
    main()

