#!/usr/bin/env python3
"""
11_descargar_ohclv.py — Descarga y cachea OHLCV de los tickers activos
----------------------------------------------------------------------
Descarga histórico de los 59 tickers de predicciones_v2.json (más margen de 200 días)
para poder reconstruir señales históricas honestas (features → modelo → señal).

Caché en: Modelos/ohclv_cache.csv
"""
import os, json, time
import pandas as pd
import yfinance as yf

ROOT = os.path.join(os.path.dirname(__file__), "..")
FLUJO_DATOS = os.path.join(ROOT, "flujo_datos")
CACHE = os.path.join(ROOT, "Modelos", "ohclv_cache.csv")

DAYS_BACK = int(os.environ.get("DAYS_BACK", 1825))


def get_tickers():
    """Unión de tickers de paso1_descargar, predicciones_v2.json y dataset_entrenamiento.csv."""
    tickers = set()
    try:
        import sys
        if ROOT not in sys.path:
            sys.path.insert(0, ROOT)
        from flujo.paso1_descargar import get_expanded_universe
        tickers.update(get_expanded_universe())
    except Exception as e:
        print(f"⚠️ Warning importing paso1_descargar universe: {e}")

    try:
        preds_path = os.path.join(FLUJO_DATOS, "predicciones_v2.json")
        if os.path.exists(preds_path):
            preds = json.load(open(preds_path))["predicciones"]
            tickers.update(p["Ticker"] for p in preds)
    except Exception: pass

    try:
        ds_path = os.path.join(ROOT, "Modelos", "dataset_entrenamiento.csv")
        if os.path.exists(ds_path):
            ds = pd.read_csv(ds_path)
            tickers.update(ds["Ticker"].unique())
    except Exception: pass

    return sorted(tickers)


def download_chunk(tickers, start, end):
    for attempt in range(4):
        try:
            raw = yf.download(tickers, start=start, end=end, group_by="ticker", progress=False, auto_adjust=True)
            frames = []
            if len(tickers) == 1:
                raw = {tickers[0]: raw}
            else:
                raw = {t: raw[t] for t in tickers}
            for t, df in raw.items():
                df = df.dropna(how="all")
                if df.empty:
                    continue
                df = df.reset_index().rename(columns={"index": "Date"})
                if "Date" not in df.columns:
                    df = df.reset_index().rename(columns={df.columns[0]: "Date"})
                df["Ticker"] = t
                frames.append(df[["Date", "Ticker", "Open", "High", "Low", "Close", "Volume"]])
            return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
        except Exception as e:
            time.sleep(5 * (attempt + 1))
    return pd.DataFrame()


def main():
    tickers = get_tickers()
    print(f"📡 Descargando OHLCV para {len(tickers)} tickers ({DAYS_BACK} días)...")
    end = pd.Timestamp.now().normalize()
    start = end - pd.Timedelta(days=DAYS_BACK)

    all_frames = []
    for i in range(0, len(tickers), 8):
        chunk = tickers[i:i + 8]
        df = download_chunk(chunk, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        all_frames.append(df)
        print(f"   [{i//8+1}/{(len(tickers)+7)//8}] {len(chunk)} tickers → {len(df)} filas")
        time.sleep(1.2)

    out = pd.concat(all_frames, ignore_index=True)
    out = out.drop_duplicates(subset=["Date", "Ticker"]).sort_values(["Ticker", "Date"])
    out.to_csv(CACHE, index=False)
    print(f"✅ Caché guardado: {CACHE} ({len(out)} filas, {out['Ticker'].nunique()} tickers)")
    print(out.groupby("Ticker").size().describe())


if __name__ == "__main__":
    main()
