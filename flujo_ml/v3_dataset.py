#!/usr/bin/env python3
"""
v3_dataset.py — V3: dataset con features de la Skill de Swing Trading
=====================================================================
Adapta la estrategia de la skill (.agent/SWING_TRADING_SKILL.md) al pipeline:
- RSI(2) gatillo + RSI(4) confirmación (Connors)
- Filtro de tendencia Close > SMA200 (Connors) → ya en Tendencia_Sana
- Relative Strength vs SPY (O'Neil CANSLIM): RS Rating
- CMF_20 money flow (Cazador Dips) y RVOL (Cuchillos)
- Bollinger %B (Elder/Quantified), momentum, distancia al 52w
- R-múltiplos y expectativa por categoría

Genera Modelos/v3_dataset.csv con features consistentes train/test
(reutiliza la lógica de bt_honesto.build_dataset sin duplicar código).
"""
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (rsi, atr, asignar_categoria, CAT_PARAMS, compute_features,
                        enrich_derived, enrich_fundamentals, CACHE, MODELOS, HALFLIFE_DAYS)

HORIZON = 11


def bollinger_pctb(close, window=20, k=2.0):
    mid = close.rolling(window).mean()
    std = close.rolling(window).std()
    upper = mid + k * std
    lower = mid - k * std
    pctb = (close - lower) / (upper - lower + 1e-9)
    width = (upper - lower) / (mid + 1e-9)  # BB_Width: régimen de volatilidad
    return pctb, width


def consecutive_down_days(close):
    """Días consecutivos de cierre < cierre anterior (Connors streak)."""
    down = (close.diff() < 0).astype(int)
    streak = down.groupby((down != down.shift()).cumsum()).cumsum()
    return streak * down


def atr_regime(atr_series, window=20):
    """ATR actual / promedio móvil de ATR. >1.5 = régimen volátil (crashes)."""
    avg = atr_series.rolling(window).mean()
    return atr_series / (avg + 1e-9)


def cmf(df, window=20):
    mfm = ((df["Close"] - df["Low"]) - (df["High"] - df["Close"])) / (df["High"] - df["Low"] + 1e-9)
    mfv = mfm * df["Volume"]
    return mfv.rolling(window).sum() / (df["Volume"].rolling(window).sum() + 1e-9)


def rs_rating(close, spy_close, window=63):
    """RS Rating al estilo O'Neil: percentil del retorno relativo vs SPY.
    RS = 100 * percentil del (retorno activo / retorno SPY) en los últimos `window` días."""
    ret = close.pct_change(window)
    spy_ret = spy_close.pct_change(window)
    rel = ret / (spy_ret + 1e-9)
    # percentil rolling del ratio relativo (0-100)
    rating = rel.rolling(window).rank(pct=True) * 100.0
    return rating


def add_skill_features(ohlcv):
    """Añade las features de la skill a OHLCV (por ticker) y devuelve el df plano.

    Features base (Connors/Elder/O'Neil/Grimes) + nuevas 2024-2025:
      BB_Width           — régimen de volatilidad (ancho de banda normalizado)
      Consecutive_Down_Days — streak bajista de Connors (más predictivo que RSI crudo)
      CMF_Slope_3D       — tendencia del flujo de capital en 3 días
      ATR_Regime         — ATR / avg_ATR20: filtro anti-crash (>1.5 = no operar)
      RSI2_Pct100        — percentil del RSI2 en ventana de 100 obs por ticker
    """
    spy = ohlcv[ohlcv["Ticker"] == "SPY"][["Date", "Close"]].rename(columns={"Close": "SPY_Close"})
    spy = spy.set_index("Date")

    rows = []
    for ticker, g in ohlcv.groupby("Ticker"):
        g = g.sort_values("Date").reset_index(drop=True)
        if len(g) < 120:
            continue
        g["RSI_2"] = rsi(g["Close"], 2)
        g["RSI_4"] = rsi(g["Close"], 4)
        g["RSI_7"] = rsi(g["Close"], 7)
        g["RSI_14"] = rsi(g["Close"], 14)
        g["ATR_14"] = atr(g)
        g["ATR_%"] = g["ATR_14"] / g["Close"] * 100.0
        g["BB_PctB"], g["BB_Width"] = bollinger_pctb(g["Close"])
        g["CMF_20"] = cmf(g)
        g["CMF_Slope_3D"] = g["CMF_20"].diff(3)  # tendencia del flujo
        g["SMA_200"] = g["Close"].rolling(200).mean()
        g["SMA_50"] = g["Close"].rolling(50).mean()
        g["EMA_20"] = g["Close"].ewm(span=20, adjust=False).mean()
        g["Dist_SMA200_%"] = (g["Close"] - g["SMA_200"]) / g["SMA_200"] * 100.0
        g["Vol_SMA20"] = g["Volume"].rolling(20).mean()
        g["RVOL_5D"] = g["Volume"] / (g["Vol_SMA20"] + 1e-5)
        g["Return_5D_%"] = g["Close"].pct_change(5) * 100.0
        g["Return_20D_%"] = g["Close"].pct_change(20) * 100.0
        hi52 = g["High"].rolling(252, min_periods=40).max()
        g["Drawdown_52W_%"] = (g["Close"] - hi52) / hi52 * 100.0
        g["Dist_52W_High_%"] = (g["Close"] / hi52 - 1) * 100.0
        g["EMA_13"] = g["Close"].ewm(span=13, adjust=False).mean()
        g["Tendencia_Sana"] = ((g["Close"] >= g["SMA_200"]) & (g["EMA_20"] >= g["SMA_50"])).astype(int)
        g["Impulse_System"] = ((g["Close"] > g["EMA_13"]) & (g["Close"] > g["EMA_20"])).astype(int)
        # Nuevas 2024-2025
        g["Consecutive_Down_Days"] = consecutive_down_days(g["Close"])
        g["ATR_Regime"] = atr_regime(g["ATR_14"])
        g["RSI2_Pct100"] = g["RSI_2"].rolling(100, min_periods=20).rank(pct=True) * 100.0

        # RS Rating vs SPY
        g = g.merge(spy, left_on="Date", right_index=True, how="left")
        g["RS_Rating"] = rs_rating(g["Close"], g["SPY_Close"].ffill())
        g = g.drop(columns=["SPY_Close"])

        g = g.dropna(subset=["RSI_2", "RSI_14", "ATR_%", "Dist_SMA200_%", "Drawdown_52W_%"]).reset_index(drop=True)

        for _, r in g.iterrows():
            cat = asignar_categoria(r["Drawdown_52W_%"], r["RSI_14"], r["RSI_2"], bool(r["Tendencia_Sana"]))
            if cat is None:
                continue
            rows.append({
                "Date": r["Date"], "Ticker": ticker, "Categoria": cat,
                "Close": r["Close"], "High": r["High"], "Low": r["Low"],
                "Cat_Sweet_Spot": int(cat == "Sweet Spot"),
                "Cat_Cazador_Dips": int(cat == "Cazador Dips"),
                "Cat_Recup_Rapida": int(cat == "Recup. Rapida"),
                "Cat_Cuchillos_Cayendo": int(cat == "Cuchillos Cayendo"),
                "RSI_2": r["RSI_2"], "RSI_4": r["RSI_4"], "RSI_7": r["RSI_7"], "RSI_14": r["RSI_14"],
                "ATR_%": r["ATR_%"],
                "BB_PctB": r["BB_PctB"], "BB_Width": r["BB_Width"],
                "CMF_20": r["CMF_20"], "CMF_Slope_3D": r.get("CMF_Slope_3D", np.nan),
                "Dist_SMA200_%": r["Dist_SMA200_%"],
                "RVOL_5D": r["RVOL_5D"],
                "Return_5D_%": r["Return_5D_%"], "Return_20D_%": r["Return_20D_%"],
                "Tendencia_Sana": int(r["Tendencia_Sana"]),
                "Impulse_System": int(r["Impulse_System"]),
                "Consecutive_Down_Days": r.get("Consecutive_Down_Days", 0),
                "ATR_Regime": r.get("ATR_Regime", 1.0),
                "RSI2_Pct100": r.get("RSI2_Pct100", np.nan),
                "Drawdown_52W_%": r["Drawdown_52W_%"],
                "Dist_52W_High_%": r["Dist_52W_High_%"],
                "RS_Rating": r["RS_Rating"],
            })
    return pd.DataFrame(rows)


def build_v3_dataset(ohlcv, horizon=HORIZON):
    """Dataset de entrenamiento V3 con features de la skill + target TP/SL
    (SL-prioridad, ventana horizon, alineado con 1_extraer_dataset.py)."""
    import math
    feats = add_skill_features(ohlcv)
    feats["Date"] = pd.to_datetime(feats["Date"])

    rows = []
    ohlcv_by_t = {t: g.sort_values("Date").reset_index(drop=True) for t, g in ohlcv.groupby("Ticker")}
    for _, r in feats.iterrows():
        g = ohlcv_by_t.get(r["Ticker"])
        if g is None:
            continue
        # localizar índice del día en el OHLCV
        idx = g.index[g["Date"] == r["Date"]]
        if len(idx) == 0:
            continue
        i = idx[0]
        fut = g.iloc[i + 1: i + 1 + horizon]
        if len(fut) < horizon:
            continue
        p = CAT_PARAMS[r["Categoria"]]
        tp_price = r["Close"] * (1 + p["tp"])
        sl_price = r["Close"] * (1 - p["sl"])
        target = 0
        for _, f in fut.iterrows():
            if f["Low"] <= sl_price:
                target = 0
                break
            if f["High"] >= tp_price:
                target = 1
                break
        days_old = (ohlcv["Date"].max() - r["Date"]).days
        w = math.exp(-math.log(2) * (days_old / HALFLIFE_DAYS))
        row = r.drop(labels=["Close"]).to_dict()
        row["Sample_Weight"] = round(w, 4)
        row["Target"] = target
        row["TP_Pct"] = p["tp"] * 100.0
        row["SL_Pct"] = p["sl"] * 100.0
        rows.append(row)

    df = pd.DataFrame(rows)
    df = enrich_derived(df)
    df = enrich_fundamentals(df)
    return df


V3_FEATURES = [
    # Categoría (one-hot)
    "Cat_Sweet_Spot", "Cat_Cazador_Dips", "Cat_Recup_Rapida", "Cat_Cuchillos_Cayendo",
    # RSI familia (Connors)
    "RSI_2", "RSI_4", "RSI_7", "RSI_14",
    # Volatilidad y bandas
    "ATR_%", "BB_PctB", "BB_Width",
    # Flujo de capital
    "CMF_20", "CMF_Slope_3D",
    # Distancias y tendencia
    "Dist_SMA200_%", "RVOL_5D",
    "Return_5D_%", "Return_20D_%", "Tendencia_Sana", "Impulse_System",
    "Drawdown_52W_%", "Dist_52W_High_%", "RS_Rating",
    # Nuevas 2024-2025 (Connors streak + régimen ATR + percentil RSI2)
    "Consecutive_Down_Days", "ATR_Regime", "RSI2_Pct100",
    # Derivadas de riesgo
    "RR_Ratio", "ATR_Risk_Pct", "TP_ATR", "Abs_Drawdown", "RSI2_DD", "RSI2_RSI14",
    # Fundamentales
    "FCF_log", "Beta",
]  # Total: 33 features


if __name__ == "__main__":
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    print(f"📦 OHLCV: {len(ohlcv)} filas, {ohlcv['Ticker'].nunique()} tickers")
    df = build_v3_dataset(ohlcv)
    out = os.path.join(MODELOS, "v3_dataset.csv")
    df.to_csv(out, index=False)
    print(f"✅ V3 dataset: {len(df)} filas, {df['Ticker'].nunique()} tickers, base rate {df['Target'].mean():.3f}")
    print(f"   Features: {len(V3_FEATURES)}")
    y = df["Target"].values
    print("   Coherencia Pearson vs Target:")
    for c in V3_FEATURES:
        m = df[c].notna()
        if m.sum() > 50:
            print(f"     {c:22s} r={np.corrcoef(df.loc[m, c], y[m])[0,1]:+.3f}  n={m.sum()}")
