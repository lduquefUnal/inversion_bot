#!/usr/bin/env python3
"""
v3_grid_completo.py — Grid completo TP × SL × Días por categoría
=================================================================
Grid: TP {5,8,10,12,15,20} × SL {3,4,5,6,8,10} × días {5,7,11,15,21,30,45}.
Por cada horizonte de días se re-entrena un modelo (target coherente con el
horizonte, config skill), y sobre el backtest honesto de 90 días se simulan
todas las combinaciones TP/SL por categoría.

Métricas por categoría y combinación:
  E = WR*avgW - (1-WR)*avgL        (expectativa por trade, %)
  EA_lineal = E × trades/año       (monto fijo rotativo)
  EA_comp   = (1+E)^trades_año - 1 (reinvierte ganancias)
  $/año     = EA_lineal × CAPITAL  (CAPITAL=$125 por trade)

Elige el mejor (TP/SL/días) por categoría para EA_lineal y EA_comp.
"""
import os
import sys
import json
import math
import numpy as np
import pandas as pd
import lightgbm as lgb

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        rsi, atr, asignar_categoria, FULL_FEATURES, CACHE)

TEST_START = "2026-05-01"
CAPITAL = 125.0
CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]
TPS = [0.05, 0.08, 0.10, 0.12, 0.15, 0.20]
SLS = [0.03, 0.04, 0.05, 0.06, 0.08, 0.10]
DIAS = [5, 7, 11, 15, 21, 30, 45]

# Config skill para el target de entrenamiento (referencia por horizonte)
SKILL_TARGET = {"Sweet Spot": (0.15, 0.08), "Cazador Dips": (0.12, 0.08),
                "Recup. Rapida": (0.15, 0.05), "Cuchillos Cayendo": (0.08, 0.05)}


def build_ds(ohlcv, cfg, dias):
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
        for i in range(len(g) - dias):
            r = g.iloc[i]
            cat = asignar_categoria(r["Drawdown_52W_%"], r["RSI_14"], r["RSI_2"], bool(r["Tendencia_Sana"]))
            if cat is None:
                continue
            tp, sl = cfg[cat]
            tp_price = r["Close"] * (1 + tp)
            sl_price = r["Close"] * (1 - sl)
            fut = g.iloc[i + 1: i + 1 + dias]
            target = 0
            for _, f in fut.iterrows():
                if f["Low"] <= sl_price:
                    target = 0
                    break
                if f["High"] >= tp_price:
                    target = 1
                    break
            days_old = (ohlcv["Date"].max() - r["Date"]).days
            w = math.exp(-math.log(2) * (days_old / 90.0))
            rows.append({"Date": r["Date"], "Ticker": ticker, "Categoria": cat,
                         "Cat_Sweet_Spot": int(cat == "Sweet Spot"),
                         "Cat_Cazador_Dips": int(cat == "Cazador Dips"),
                         "Cat_Recup_Rapida": int(cat == "Recup. Rapida"),
                         "Cat_Cuchillos_Cayendo": int(cat == "Cuchillos Cayendo"),
                         "Close": r["Close"],
                         "RSI_2": r["RSI_2"], "RSI_7": r["RSI_7"], "RSI_14": r["RSI_14"],
                         "ATR_%": r["ATR_%"], "Dist_SMA200_%": r["Dist_SMA200_%"],
                         "RVOL_5D": r["RVOL_5D"], "Return_5D_%": r["Return_5D_%"],
                         "Tendencia_Sana": int(r["Tendencia_Sana"]),
                         "Drawdown_52W_%": r["Drawdown_52W_%"],
                         "Sample_Weight": round(w, 4), "Target": target})
    df = pd.DataFrame(rows)
    df = enrich_derived(df)
    df = enrich_fundamentals(df)
    return df


def simulate(ft, prob, dias, tp, sl, umbral=0.5):
    """Simula con TP/SL/días dados por ticker, 1 trade/ticker, dedupe."""
    feat = ft.copy()
    feat["prob"] = prob
    trades = []
    for ticker, g in feat.groupby("Ticker"):
        g = g.sort_values("Date").reset_index(drop=True)
        open_pos = None
        for _, row in g.iterrows():
            if open_pos is None:
                if row["prob"] >= umbral:
                    open_pos = {"tk": ticker, "cat": row["Categoria"], "ent": row["Date"],
                                "pe": row["Close"], "dias": 0}
            else:
                open_pos["dias"] += 1
                tp_p, sl_p = tp, sl
                tpp = open_pos["pe"] * (1 + tp_p)
                slp = open_pos["pe"] * (1 - sl_p)
                if row["High"] >= tpp:
                    res, pnl = "WIN", tp_p * 100
                elif row["Low"] <= slp:
                    res, pnl = "LOSS", -sl_p * 100
                elif open_pos["dias"] >= dias:
                    res = "TIMEOUT"
                    pnl = (row["Close"] - open_pos["pe"]) / open_pos["pe"] * 100
                else:
                    continue
                friccion = max(0.05, min(0.3, 0.15 / open_pos["pe"] * 100))
                trades.append({"Ticker": open_pos["tk"], "Categoria": open_pos["cat"],
                               "Resultado": res, "PnL_Neto_%": pnl - friccion})
                open_pos = None
    return trades


def ea_of(trades, dias_ventana=90):
    if not trades:
        return None
    wins = [t for t in trades if t["Resultado"] == "WIN"]
    losses = [t for t in trades if t["Resultado"] in ("LOSS", "TIMEOUT")]
    p = len(wins) / len(trades)
    aw = np.mean([t["PnL_Neto_%"] for t in wins]) if wins else 0.0
    al = np.mean([t["PnL_Neto_%"] for t in losses]) if losses else 0.0
    e = p * aw + (1 - p) * al
    freq = len(trades) / dias_ventana * 365.0
    return {"n": len(trades), "wr": p, "e": e, "aw": aw, "al": al, "freq": freq,
            "ea_lin": e * freq / 100.0,
            "ea_comp": (1 + e / 100.0) ** freq - 1.0,
            "usd": e * freq / 100.0 * CAPITAL}


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    ts = pd.Timestamp(TEST_START)
    params = json.load(open("Modelos/modelo_metadata_noche.json"))["best_params"]
    params["n_estimators"] = 300

    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= ts].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)

    print(f"Grid: {len(TPS)} TP × {len(SLS)} SL × {len(DIAS)} días × 4 categorías")
    print(f"Reentrenando {len(DIAS)} modelos (1 por horizonte)...")
    by_dias = {}
    for dias in DIAS:
        df = build_ds(ohlcv, SKILL_TARGET, dias)
        df["Date"] = pd.to_datetime(df["Date"])
        train = df[df["Date"] < ts].reset_index(drop=True)
        m = lgb.LGBMClassifier(**params, verbose=-1)
        m.fit(train[FULL_FEATURES], train["Target"], sample_weight=train["Sample_Weight"])
        prob = m.predict_proba(feat_test[FULL_FEATURES])[:, 1]
        by_dias[dias] = prob
        print(f"  ✓ días={dias}: train={len(train)} filas")

    # Grid por categoría
    best_lin = {}   # cat -> (combo, ea)
    best_comp = {}
    all_rows = []
    for cat in CATS:
        cat_best_lin = None
        cat_best_comp = None
        for dias in DIAS:
            prob = by_dias[dias]
            for tp in TPS:
                for sl in SLS:
                    trades = simulate(feat_test, prob, dias, tp, sl)
                    ct = [t for t in trades if t["Categoria"] == cat]
                    r = ea_of(ct)
                    if r is None or r["n"] < 3:
                        continue
                    combo = (tp, sl, dias)
                    row = {"cat": cat, "tp": tp, "sl": sl, "dias": dias,
                           "n": r["n"], "wr": round(r["wr"] * 100, 1),
                           "e": round(r["e"], 2), "ea_lin": round(r["ea_lin"] * 100, 1),
                           "ea_comp": round(r["ea_comp"] * 100, 1),
                           "usd": round(r["usd"], 1), "freq": round(r["freq"], 0)}
                    all_rows.append(row)
                    if cat_best_lin is None or r["ea_lin"] > cat_best_lin[1]["ea_lin"]:
                        cat_best_lin = (combo, r)
                    if cat_best_comp is None or r["ea_comp"] > cat_best_comp[1]["ea_comp"]:
                        cat_best_comp = (combo, r)
        best_lin[cat] = cat_best_lin
        best_comp[cat] = cat_best_comp

    print("\n" + "=" * 100)
    print(f"🏆 MEJOR COMBINACIÓN POR CATEGORÍA — {len(all_rows)} combos evaluados (n≥3)")
    print("=" * 100)
    for cat in CATS:
        for metric, best in [("EA LINEAL", best_lin[cat]), ("EA COMPUESTO", best_comp[cat])]:
            if best is None:
                print(f"\n  {cat}: sin datos suficientes")
                continue
            (tp, sl, dias), r = best
            print(f"\n  {cat} — mejor {metric}: TP={tp*100:.0f}% SL={sl*100:.0f}% días={dias} "
                  f"(n={r['n']}, freq={r['freq']:.0f}/año)")
            print(f"      WR={r['wr']:.1f}% E={r['e']:+.2f}% | EA_lineal={r['ea_lin']*100:+.1f}% | "
                  f"EA_comp={r['ea_comp']*100:+.1f}% | ${r['usd']:+.0f}/año @${CAPITAL:.0f}")

    # Top global lineal
    df_rows = pd.DataFrame(all_rows)
    print("\n" + "=" * 100)
    print("🏆 TOP 10 COMBOS GLOBALES por EA lineal ($/año @ $125)")
    print("=" * 100)
    top = df_rows.sort_values("ea_lin", ascending=False).head(10)
    for _, r in top.iterrows():
        print(f"  {r['cat']:22s} TP={r['tp']*100:3.0f}% SL={r['sl']*100:3.0f}% días={r['dias']:2d} "
              f"n={r['n']:3d} WR={r['wr']:5.1f}% E={r['e']:+5.2f}% EA_lin={r['ea_lin']:+6.1f}% "
              f"EA_comp={r['ea_comp']:+6.1f}% ${r['usd']:+.0f}/año")

    df_rows.to_csv("Modelos/grid_ea_resultados.csv", index=False)
    json.dump({"best_por_categoria_lin": {c: (best_lin[c][0], best_lin[c][1]) if best_lin[c] else None for c in CATS},
               "best_por_categoria_comp": {c: (best_comp[c][0], best_comp[c][1]) if best_comp[c] else None for c in CATS}},
              open("Modelos/grid_ea_mejores.json", "w"), indent=2, default=str)
    print("\n✅ Guardado: Modelos/grid_ea_resultados.csv + grid_ea_mejores.json")


if __name__ == "__main__":
    main()
