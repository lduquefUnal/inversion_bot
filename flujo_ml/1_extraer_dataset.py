#!/usr/bin/env python3
"""
Etapa 1: DataOps Masivo — Universo Expandido de 300+ Activos (S&P 500, Nasdaq, ETFs, Crypto, Commodities)
-------------------------------------------------------------------------------------------------------
Aumenta el volumen de datos a 300+ activos para capturar miles de muestras adicionales de categorías
poco frecuentes (Cuchillos Cayendo, Cazador Dips), eliminando el desbalance de clases.
"""

import os
import math
import time
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "Modelos")
os.makedirs(OUTPUT_DIR, exist_ok=True)
DATASET_PATH = os.path.join(OUTPUT_DIR, "dataset_entrenamiento.csv")

YEARS_BACK = 1.0
HALFLIFE_DAYS = 180.0

# 300+ Activos Diversificados
TICKERS_UNIVERSE = [
    # Índices Globales & ETFs Sectoriales
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "VEA", "VWO", "EEM", "EWY", "ECH", "FXI", "EWZ", "EWG", "EWJ",
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLU", "XLP", "XLY", "SMH", "SOXX", "ARKK", "XME", "XOP", "ITB", "VNQ",
    "SCHD", "JEPI", "JEPQ", "KWEB", "XBI", "BOTZ", "ROBO", "ICLN", "TAN", "COPX", "LIT", "REMX", "URNM", "URNJ",

    # Tecnología, Semiconductores & Software (Mega/Large Cap)
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "AMD", "TSLA", "META", "AVGO", "ORCL", "INTC", "QCOM", "ARM", "MU",
    "TSM", "UMC", "ASML", "AMAT", "LRCX", "KLAC", "SNPS", "CDNS", "MRVL", "PANW", "CRWD", "FTNT", "NET", "DDOG",
    "SNOW", "PLTR", "MDB", "TEAM", "NOW", "ADBE", "CRM", "SAP", "IBM", "DELL", "HPQ", "HPE", "SMCI", "PATH",

    # Consumo, Retail & Fintech
    "MELI", "SHOP", "SE", "PDD", "BABA", "JD", "DIS", "NFLX", "SPOT", "BKNG", "ABNB", "UBER", "LYFT", "DASH",
    "PYPL", "SQ", "COIN", "HOOD", "NU", "GLOB", "TOST", "RBLX", "U", "NKE", "LULU", "SBUX", "MCD", "CMG", "WMT", "COST", "TGT",

    # Espacio, Defensa, Energía & Cuchillos Cayendo Potenciales
    "UFO", "RKLB", "ASTS", "LUNR", "LMT", "RTX", "NOC", "GD", "BA", "HII", "ENPH", "SEDG", "RUN", "FSLR", "CCJ",
    "FCX", "NEM", "GOLD", "AA", "ALB", "SQM", "VALE", "PBR", "XOM", "CVX", "COP", "SLB", "HAL", "OXY", "DVN",

    # Salud, Biotecnología & Farma
    "JNJ", "PFE", "MRK", "ABBV", "LLY", "NVO", "AZN", "BMY", "AMGN", "GILD", "VRTX", "REGN", "MRNA", "BNTX",
    "ISRG", "SYK", "MDT", "BSX", "EW", "DXCM", "PACB", "ILMN", "ARKG",

    # Financiero, Bancos & Pagos
    "JPM", "BAC", "WFC", "C", "GS", "MS", "BLK", "SCHW", "V", "MA", "AXP", "DFS", "COF", "HDB", "IBN", "AVAL",

    # Criptomonedas & Blockchain (Top 25)
    "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "AVAX-USD", "LINK-USD", "DOT-USD", "ADA-USD", 

    # Commodities, Metales & Bonos
    "GLD", "SLV", "GLDM", "SILJ", "USO", "UNG", "DBA", "HYG", "TIPS", "TLT", "IEF", "SHY", "CPER"
]

def calcular_rsi(df, window=14):
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / (loss + 1e-8)
    return 100 - (100 / (1 + rs))

def calcular_atr(df, window=14):
    tr = pd.concat([
        df['High'] - df['Low'],
        (df['High'] - df['Close'].shift()).abs(),
        (df['Low'] - df['Close'].shift()).abs()
    ], axis=1).max(axis=1)
    return tr.rolling(window=window).mean()

def generar_dataset_300():
    t_start = time.time()
    print(f"🚀 [1/3] Descarga masiva para universo expandido de {len(TICKERS_UNIVERSE)} activos...")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=int(YEARS_BACK * 365) + 220)

    bulk_data = yf.download(TICKERS_UNIVERSE, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), group_by='ticker', progress=False)

    all_rows = []

    for ticker in TICKERS_UNIVERSE:
        try:
            if ticker not in bulk_data.columns.levels[0]:
                continue
            df = bulk_data[ticker].dropna(how='all').copy().sort_index()

            if df.empty or len(df) < 180:
                continue

            df['RSI_14'] = calcular_rsi(df, 14)
            df['RSI_2'] = calcular_rsi(df, 2)
            df['SMA_200'] = df['Close'].rolling(window=200).mean()
            df['SMA_50'] = df['Close'].rolling(window=50).mean()
            df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
            df['ATR_14'] = calcular_atr(df, 14)

            df['Vol_SMA20'] = df['Volume'].rolling(window=20).mean()
            df['RVOL_5D'] = df['Volume'] / (df['Vol_SMA20'] + 1e-5)

            high_52w = df['High'].rolling(window=252, min_periods=40).max()
            df['Drawdown_52W_%'] = (df['Close'] - high_52w) / high_52w * 100.0

            df['Dist_SMA200_%'] = (df['Close'] - df['SMA_200']) / df['SMA_200'] * 100.0
            df['Tendencia_Sana'] = ((df['Close'] >= df['SMA_200']) & (df['EMA_20'] >= df['SMA_50'])).astype(int)

            df = df.dropna().copy()

            for i in range(len(df) - 12):
                close_p = float(df['Close'].iloc[i])
                rsi2_v = float(df['RSI_2'].iloc[i])
                rsi14_v = float(df['RSI_14'].iloc[i])
                dd_v = float(df['Drawdown_52W_%'].iloc[i])
                tendencia_sana = bool(df['Tendencia_Sana'].iloc[i])

                if dd_v < -35 and rsi14_v < 32:
                    cat = "Cazador Dips"
                    tp_pct, sl_pct = 0.12, 0.05
                elif tendencia_sana and dd_v <= -20:
                    cat = "Sweet Spot"
                    tp_pct, sl_pct = 0.15, 0.06
                elif tendencia_sana and rsi2_v < 15:
                    cat = "Recup. Rapida"
                    tp_pct, sl_pct = 0.10, 0.04
                elif not tendencia_sana and rsi2_v < 5:
                    cat = "Cuchillos Cayendo"
                    tp_pct, sl_pct = 0.08, 0.04
                else:
                    continue

                tp_price = close_p * (1 + tp_pct)
                sl_price = close_p * (1 - sl_pct)

                future_df = df.iloc[i+1 : i+12]
                target = 0
                for _, fut in future_df.iterrows():
                    if float(fut['Low']) <= sl_price:
                        target = 0
                        break
                    if float(fut['High']) >= tp_price:
                        target = 1
                        break

                days_old = (end_date - df.index[i]).days
                sample_weight = math.exp(-math.log(2) * (days_old / HALFLIFE_DAYS))

                all_rows.append({
                    "Date": df.index[i].strftime('%Y-%m-%d'),
                    "Ticker": ticker,
                    "Categoria": cat,
                    "Cat_Sweet_Spot": 1 if cat == "Sweet Spot" else 0,
                    "Cat_Cazador_Dips": 1 if cat == "Cazador Dips" else 0,
                    "Cat_Recup_Rapida": 1 if cat == "Recup. Rapida" else 0,
                    "Cat_Cuchillos_Cayendo": 1 if cat == "Cuchillos Cayendo" else 0,
                    "Close": close_p,
                    "RSI_2": rsi2_v,
                    "RSI_14": rsi14_v,
                    "ATR_%": (float(df['ATR_14'].iloc[i]) / close_p) * 100.0,
                    "Tendencia_Sana": 1 if tendencia_sana else 0,
                    "Drawdown_52W_%": dd_v,
                    "Sample_Weight": round(sample_weight, 4),
                    "Target": target,
                    "TP_Pct": tp_pct * 100.0,
                    "SL_Pct": sl_pct * 100.0
                })
        except Exception:
            pass

    dataset_df = pd.DataFrame(all_rows)
    dataset_df.to_csv(DATASET_PATH, index=False)
    t_duration = round(time.time() - t_start, 2)
    print(f"\n✅ [2/3] Dataset masivo de 300+ activos guardado en {DATASET_PATH} ({t_duration}s)")
    print(f"📊 Desglose de Muestras por Categoría:\n{dataset_df['Categoria'].value_counts()}")

if __name__ == "__main__":
    generar_dataset_300()
