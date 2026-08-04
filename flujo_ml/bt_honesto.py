#!/usr/bin/env python3
"""
bt_honesto.py — Núcleo unificado del backtest honesto y dataset consistente
============================================================================
Módulo compartido (importable) que unifica la lógica que se ejecutó en la
sesión nocturna: features consistentes entre train y test, categorías y
TP/SL alineados con 1_extraer_dataset.py, backtest honesto (señales no
repetidas, entrada al close del día de señal) y métricas.

Fuente única de verdad para los scripts 13/14 y para V3 (redes neuronales).
"""
import os
import re
import json
import math
import logging
import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT = os.path.join(os.path.dirname(__file__), "..")
MODELOS = os.path.join(ROOT, "Modelos")
CACHE = os.path.join(MODELOS, "ohclv_cache.csv")
DATASET = os.path.join(MODELOS, "dataset_entrenamiento.csv")
FLUJO_DATOS = os.path.join(ROOT, "flujo_datos")
PRED_PATH = os.path.join(FLUJO_DATOS, "predicciones_v2.json")
LOG_FILE = os.path.join(os.path.dirname(__file__), "mlops.log")

# Logger compartido por todos los scripts que importen bt_honesto
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("bt_honesto")

# Features base (calculadas por compute_features / build_dataset)
FEATURES = [
    "Cat_Sweet_Spot", "Cat_Cazador_Dips", "Cat_Recup_Rapida", "Cat_Cuchillos_Cayendo",
    "RSI_2", "RSI_7", "RSI_14", "ATR_%", "Dist_SMA200_%", "RVOL_5D",
    "Return_5D_%", "Tendencia_Sana", "Drawdown_52W_%",
]
# Features de riesgo QUANT_RISK (derivadas) + fundamentales
RISK_FEATURES = ["RR_Ratio", "ATR_Risk_Pct", "TP_ATR", "Abs_Drawdown", "RSI2_DD", "RSI2_RSI14"]
FUND_FEATURES = ["FCF_log", "Beta"]
FULL_FEATURES = FEATURES + RISK_FEATURES + FUND_FEATURES

# TP/SL y límites ALINEADOS con 1_extraer_dataset.py (ventana target = 11 días)
CAT_PARAMS = {
    "Sweet Spot":        {"tp": 0.15, "sl": 0.06, "limite_dias": 11},
    "Cazador Dips":      {"tp": 0.12, "sl": 0.05, "limite_dias": 11},
    "Recup. Rapida":     {"tp": 0.10, "sl": 0.04, "limite_dias": 11},
    "Cuchillos Cayendo": {"tp": 0.08, "sl": 0.04, "limite_dias": 11},
}
FRICCION_USD = 0.15
HALFLIFE_DAYS = 90.0


# ── Indicadores ───────────────────────────────────────────────────────────────
def rsi(close, window):
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = (-delta.clip(upper=0)).rolling(window).mean()
    rs = gain / (loss + 1e-9)
    return 100 - (100 / (1 + rs))


def atr(df, window=14):
    h, l, c = df["High"], df["Low"], df["Close"]
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.rolling(window).mean()


def asignar_categoria(dd_52w, rsi14, rsi2, tendencia_sana):
    """Lógica IDÉNTICA a 1_extraer_dataset.py (incluye condiciones de RSI_2)."""
    if dd_52w < -35 and rsi14 < 32:
        return "Cazador Dips"
    elif tendencia_sana and dd_52w <= -20:
        return "Sweet Spot"
    elif tendencia_sana and rsi2 < 15:
        return "Recup. Rapida"
    elif not tendencia_sana and rsi2 < 5:
        return "Cuchillos Cayendo"
    return None


# ── Fundamentales ─────────────────────────────────────────────────────────────
def parse_fcf(s):
    if s is None:
        return np.nan
    s = str(s).strip().replace("$", "").replace(",", "")
    m = re.match(r"^([-\d.]+)\s*([MKTB]?)", s)
    if not m:
        return np.nan
    return float(m.group(1)) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9}[m.group(2) or ""]


def parse_float(s):
    if s is None:
        return np.nan
    if isinstance(s, (int, float)):
        return float(s)
    m = re.search(r"[-+]?\d*\.\d+|\d+", str(s))
    return float(m.group()) if m else np.nan


def load_fundamentals():
    preds = json.load(open(PRED_PATH))["predicciones"]
    fund = {}
    for p in preds:
        fcf = parse_fcf(p.get("FCF"))
        fcf_log = np.sign(fcf) * np.log1p(abs(fcf)) if not np.isnan(fcf) else np.nan
        beta = parse_float(p.get("Beta"))
        fund[p["Ticker"]] = {"FCF_log": fcf_log, "Beta": beta}
    return pd.DataFrame.from_dict(fund, orient="index").reset_index().rename(columns={"index": "Ticker"})


# ── Features desde OHLCV (consistente train/test) ────────────────────────────
def compute_features(ohlcv):
    rows = []
    for ticker, g in ohlcv.groupby("Ticker"):
        g = g.sort_values("Date").reset_index(drop=True)
        if len(g) < 60:
            continue
        g["RSI_2"] = rsi(g["Close"], 2)
        g["RSI_7"] = rsi(g["Close"], 7)
        g["RSI_14"] = rsi(g["Close"], 14)
        g["ATR_14"] = atr(g)
        g["ATR_%"] = g["ATR_14"] / g["Close"] * 100.0
        g["SMA_200"] = g["Close"].rolling(200).mean()
        g["SMA_50"] = g["Close"].rolling(50).mean()
        g["EMA_20"] = g["Close"].ewm(span=20, adjust=False).mean()
        g["Dist_SMA200_%"] = (g["Close"] - g["SMA_200"]) / g["SMA_200"] * 100.0
        g["Vol_SMA20"] = g["Volume"].rolling(20).mean()
        g["RVOL_5D"] = g["Volume"] / (g["Vol_SMA20"] + 1e-5)
        g["Return_5D_%"] = g["Close"].pct_change(5) * 100.0
        hi52 = g["High"].rolling(252, min_periods=40).max()
        g["Drawdown_52W_%"] = (g["Close"] - hi52) / hi52 * 100.0
        g["Tendencia_Sana"] = ((g["Close"] >= g["SMA_200"]) & (g["EMA_20"] >= g["SMA_50"])).astype(int)
        g = g.dropna(subset=["RSI_2", "RSI_14", "ATR_%", "Dist_SMA200_%", "Drawdown_52W_%"]).reset_index(drop=True)

        for _, r in g.iterrows():
            cat = asignar_categoria(r["Drawdown_52W_%"], r["RSI_14"], r["RSI_2"], bool(r["Tendencia_Sana"]))
            if cat is None:
                continue
            rows.append({
                "Date": r["Date"], "Ticker": ticker, "Categoria": cat, "Close": r["Close"],
                "High": r["High"], "Low": r["Low"],
                "Cat_Sweet_Spot": int(cat == "Sweet Spot"),
                "Cat_Cazador_Dips": int(cat == "Cazador Dips"),
                "Cat_Recup_Rapida": int(cat == "Recup. Rapida"),
                "Cat_Cuchillos_Cayendo": int(cat == "Cuchillos Cayendo"),
                "RSI_2": r["RSI_2"], "RSI_7": r["RSI_7"], "RSI_14": r["RSI_14"],
                "ATR_%": r["ATR_%"], "Dist_SMA200_%": r["Dist_SMA200_%"],
                "RVOL_5D": r["RVOL_5D"], "Return_5D_%": r["Return_5D_%"],
                "Tendencia_Sana": int(r["Tendencia_Sana"]), "Drawdown_52W_%": r["Drawdown_52W_%"],
            })
    return pd.DataFrame(rows)


def enrich_derived(df):
    """Añade features derivadas de riesgo (necesitan Categoria + TP/SL)."""
    df = df.copy()
    pct = df["Categoria"].map({k: v["tp"] * 100.0 for k, v in CAT_PARAMS.items()})
    sl = df["Categoria"].map({k: v["sl"] * 100.0 for k, v in CAT_PARAMS.items()})
    df["TP_Pct"] = pct.values
    df["SL_Pct"] = sl.values
    df["RR_Ratio"] = df["TP_Pct"] / df["SL_Pct"].clip(lower=0.5)
    df["ATR_Risk_Pct"] = 2.0 * df["ATR_%"]
    df["TP_ATR"] = df["TP_Pct"] / df["ATR_%"].clip(lower=0.01)
    df["Abs_Drawdown"] = df["Drawdown_52W_%"].abs()
    df["RSI2_DD"] = df["RSI_2"] * df["Abs_Drawdown"] / 100.0
    df["RSI2_RSI14"] = df["RSI_2"] - df["RSI_14"]
    return df


def enrich_fundamentals(df):
    df = df.merge(load_fundamentals(), on="Ticker", how="left")
    return df


def enrich_feat(df):
    """Aplica derivadas + fundamentales a un df de features (train o test)."""
    df = enrich_derived(df)
    df = enrich_fundamentals(df)
    return df


# ── Dataset de entrenamiento consistente ─────────────────────────────────────
def build_dataset(ohlcv, horizon=11):
    """Reconstruye dataset con MISMAS features que compute_features y target TP/SL
    (SL-prioridad, ventana horizon, igual a 1_extraer_dataset.py)."""
    rows = []
    for ticker, g in ohlcv.groupby("Ticker"):
        g = g.sort_values("Date").reset_index(drop=True)
        if len(g) < 60:
            continue
        g["RSI_2"] = rsi(g["Close"], 2)
        g["RSI_7"] = rsi(g["Close"], 7)
        g["RSI_14"] = rsi(g["Close"], 14)
        g["ATR_14"] = atr(g)
        g["ATR_%"] = g["ATR_14"] / g["Close"] * 100.0
        g["SMA_200"] = g["Close"].rolling(200).mean()
        g["SMA_50"] = g["Close"].rolling(50).mean()
        g["EMA_20"] = g["Close"].ewm(span=20, adjust=False).mean()
        g["Dist_SMA200_%"] = (g["Close"] - g["SMA_200"]) / g["SMA_200"] * 100.0
        g["Vol_SMA20"] = g["Volume"].rolling(20).mean()
        g["RVOL_5D"] = g["Volume"] / (g["Vol_SMA20"] + 1e-5)
        g["Return_5D_%"] = g["Close"].pct_change(5) * 100.0
        hi52 = g["High"].rolling(252, min_periods=40).max()
        g["Drawdown_52W_%"] = (g["Close"] - hi52) / hi52 * 100.0
        g["Tendencia_Sana"] = ((g["Close"] >= g["SMA_200"]) & (g["EMA_20"] >= g["SMA_50"])).astype(int)
        g = g.dropna(subset=["RSI_2", "RSI_14", "ATR_%", "Dist_SMA200_%", "Drawdown_52W_%"]).reset_index(drop=True)

        for i in range(len(g) - horizon):
            r = g.iloc[i]
            cat = asignar_categoria(r["Drawdown_52W_%"], r["RSI_14"], r["RSI_2"], bool(r["Tendencia_Sana"]))
            if cat is None:
                continue
            p = CAT_PARAMS[cat]
            tp_price = r["Close"] * (1 + p["tp"])
            sl_price = r["Close"] * (1 - p["sl"])
            fut = g.iloc[i + 1: i + 1 + horizon]
            target = 0
            for _, f in fut.iterrows():
                if f["Low"] <= sl_price:      # SL primero (igual que 1_extraer)
                    target = 0
                    break
                if f["High"] >= tp_price:
                    target = 1
                    break
            days_old = (ohlcv["Date"].max() - r["Date"]).days
            w = math.exp(-math.log(2) * (days_old / HALFLIFE_DAYS))
            rows.append({
                "Date": r["Date"], "Ticker": ticker, "Categoria": cat,
                "Cat_Sweet_Spot": int(cat == "Sweet Spot"),
                "Cat_Cazador_Dips": int(cat == "Cazador Dips"),
                "Cat_Recup_Rapida": int(cat == "Recup. Rapida"),
                "Cat_Cuchillos_Cayendo": int(cat == "Cuchillos Cayendo"),
                "Close": r["Close"],
                "RSI_2": r["RSI_2"], "RSI_7": r["RSI_7"], "RSI_14": r["RSI_14"],
                "ATR_%": r["ATR_%"], "Dist_SMA200_%": r["Dist_SMA200_%"],
                "RVOL_5D": r["RVOL_5D"], "Return_5D_%": r["Return_5D_%"],
                "Tendencia_Sana": int(r["Tendencia_Sana"]), "Drawdown_52W_%": r["Drawdown_52W_%"],
                "Sample_Weight": round(w, 4), "Target": target,
                "TP_Pct": p["tp"] * 100.0, "SL_Pct": p["sl"] * 100.0,
            })
    df = pd.DataFrame(rows)
    df = enrich_derived(df)
    df = enrich_fundamentals(df)
    return df


# ── Simulación honesta ───────────────────────────────────────────────────────
def simulate_signals(feat_df, prob_col, umbral, max_trades_per_ticker=1, dedupe_same_day=True):
    """
    Recorre día a día la ventana de test. Abre trade al close del día de señal.
    Señales NO repetidas: máx `max_trades_per_ticker` por ticker y nunca 2 entradas
    consecutivas con el mismo ticker. Retorna lista de trades.
    """
    feat = feat_df.copy()
    feat["prob"] = prob_col
    trades = []

    for ticker, g in feat.groupby("Ticker"):
        g = g.sort_values("Date").reset_index(drop=True)
        open_pos = None
        count = 0
        for i, row in g.iterrows():
            if open_pos is None:
                if row["prob"] >= umbral and count < max_trades_per_ticker:
                    cat = row["Categoria"]
                    p = CAT_PARAMS.get(cat, {"tp": 0.10, "sl": 0.07, "limite_dias": 11})
                    open_pos = {
                        "Ticker": ticker, "Categoria": cat, "prob": row["prob"],
                        "Fecha_Entrada": row["Date"], "Precio_Entrada": row["Close"],
                        "tp_p": p["tp"], "sl_p": p["sl"], "limite": p["limite_dias"], "dias": 0,
                    }
            else:
                open_pos["dias"] += 1
                tp_p, sl_p = open_pos["tp_p"], open_pos["sl_p"]
                tp_price = open_pos["Precio_Entrada"] * (1 + tp_p)
                sl_price = open_pos["Precio_Entrada"] * (1 - sl_p)
                if row["High"] >= tp_price:
                    res, pnl_pct, exit_p = "WIN", tp_p * 100, tp_price
                elif row["Low"] <= sl_price:
                    res, pnl_pct, exit_p = "LOSS", -sl_p * 100, sl_price
                elif open_pos["dias"] >= open_pos["limite"]:
                    res = "TIMEOUT"
                    pnl_pct = (row["Close"] - open_pos["Precio_Entrada"]) / open_pos["Precio_Entrada"] * 100
                    exit_p = row["Close"]
                else:
                    continue
                friccion = max(0.05, min(0.3, 0.15 / open_pos["Precio_Entrada"] * 100))
                trades.append({
                    "Ticker": open_pos["Ticker"], "Categoria": open_pos["Categoria"],
                    "Veredicto_V2": "BUY",
                    "Probabilidad_%": round(open_pos["prob"] * 100, 1),
                    "Fecha_Entrada": open_pos["Fecha_Entrada"].strftime("%Y-%m-%d"),
                    "Precio_Entrada_Hist": round(open_pos["Precio_Entrada"], 2),
                    "Precio_Salida": round(exit_p, 2),
                    "Resultado": res, "Dias_Trade": open_pos["dias"],
                    "PnL_%": round(pnl_pct, 2),
                    "PnL_Neto_%": round(pnl_pct - friccion, 2),
                    "TP_%": round(tp_p * 100, 1), "SL_%": round(sl_p * 100, 1),
                })
                count += 1
                open_pos = None
                if count >= max_trades_per_ticker:
                    break
    return trades


def metrics(trades):
    total = len(trades)
    if total == 0:
        return {"total": 0, "wins": 0, "losses": 0, "timeouts": 0, "win_rate_%": 0,
                "pnl_promedio_%": 0, "buy_signals": 0}
    wins = sum(1 for t in trades if t["Resultado"] == "WIN")
    losses = sum(1 for t in trades if t["Resultado"] == "LOSS")
    to = sum(1 for t in trades if t["Resultado"] == "TIMEOUT")
    return {
        "total": total, "wins": wins, "losses": losses, "timeouts": to,
        "win_rate_%": round(wins / total * 100, 1),
        "pnl_promedio_%": round(float(np.mean([t["PnL_Neto_%"] for t in trades])), 2),
        "buy_signals": sum(1 for t in trades if t["Veredicto_V2"] == "BUY"),
    }


def calibration(trades):
    if not trades:
        return []
    out = []
    edges = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1.01]
    for a, b in zip(edges, edges[1:]):
        grp = [t for t in trades if a <= t["Probabilidad_%"] / 100.0 < b]
        if not grp:
            continue
        wins = sum(1 for t in grp if t["Resultado"] == "WIN")
        out.append({"bucket": f"{a*100:.0f}-{min(100,b*100):.0f}%", "n": len(grp),
                    "wr_real_%": round(wins / len(grp) * 100, 1),
                    "prob_prom_%": round(float(np.mean([t["Probabilidad_%"] for t in grp])), 1)})
    return out


def load_ohlcv():
    return pd.read_csv(CACHE, parse_dates=["Date"])


def split_train_test(df, test_start):
    return df[df["Date"] < test_start].reset_index(drop=True), df[df["Date"] >= test_start]
