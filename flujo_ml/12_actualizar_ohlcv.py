#!/usr/bin/env python3
"""
12_actualizar_ohlcv.py — Actualización Incremental de OHLCV (1x/día)
----------------------------------------------------------------------
Descarga e integra incrementalmente los últimos datos OHLCV sin rehacer
todo el histórico. Aplica una ventana de solapamiento de 10 días para
garantizar consistencia ante dividendo/splits (auto_adjust=True).

Guarda en: Modelos/ohclv_cache.csv
"""
import os
import sys
import json
import time
import pandas as pd
import yfinance as yf

ROOT = os.path.join(os.path.dirname(__file__), "..")
FLUJO_DATOS = os.path.join(ROOT, "flujo_datos")
CACHE = os.path.join(ROOT, "Modelos", "ohclv_cache.csv")
OVERLAP_DAYS = 10


def get_tickers():
    """Obtiene el universo completo de tickers a actualizar."""
    tickers = set()
    try:
        if ROOT not in sys.path:
            sys.path.insert(0, ROOT)
        from flujo.paso1_descargar import get_expanded_universe
        tickers.update(get_expanded_universe())
    except Exception as e:
        print(f"⚠️ Warning importando paso1_descargar universe: {e}")

    try:
        preds_path = os.path.join(FLUJO_DATOS, "predicciones_v2.json")
        if os.path.exists(preds_path):
            preds = json.load(open(preds_path, encoding="utf-8")).get("predicciones", [])
            tickers.update(p["Ticker"] for p in preds if "Ticker" in p)
    except Exception:
        pass

    try:
        ds_path = os.path.join(ROOT, "Modelos", "dataset_entrenamiento.csv")
        if os.path.exists(ds_path):
            ds = pd.read_csv(ds_path, usecols=["Ticker"])
            tickers.update(ds["Ticker"].dropna().unique())
    except Exception:
        pass

    if os.path.exists(CACHE):
        try:
            cache_tickers = pd.read_csv(CACHE, usecols=["Ticker"])["Ticker"].dropna().unique()
            tickers.update(cache_tickers)
        except Exception:
            pass

    return sorted(tickers)


def download_chunk(tickers, start_str, end_str):
    """Descarga chunk de tickers de forma robusta con reintentos."""
    for attempt in range(4):
        try:
            raw = yf.download(tickers, start=start_str, end=end_str, group_by="ticker", progress=False, auto_adjust=True)
            frames = []
            if len(tickers) == 1:
                raw = {tickers[0]: raw}
            else:
                raw = {t: raw[t] for t in tickers if t in raw}
            for t, df in raw.items():
                if df is None or df.empty:
                    continue
                df = df.dropna(how="all")
                if df.empty:
                    continue
                df = df.reset_index()
                date_col = "Date" if "Date" in df.columns else df.columns[0]
                df = df.rename(columns={date_col: "Date"})
                df["Ticker"] = t
                cols = [c for c in ["Date", "Ticker", "Open", "High", "Low", "Close", "Volume"] if c in df.columns]
                frames.append(df[cols])
            return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
        except Exception as e:
            time.sleep(3 * (attempt + 1))
    return pd.DataFrame()


def actualizar_ohlcv():
    tickers = get_tickers()
    if not tickers:
        print("❌ Error: No se encontraron tickers para actualizar.")
        return

    existing_df = pd.DataFrame()
    last_date = None

    if os.path.exists(CACHE):
        print(f"📦 Cargando caché existente: {CACHE}")
        existing_df = pd.read_csv(CACHE, parse_dates=["Date"])
        if not existing_df.empty and "Date" in existing_df.columns:
            last_date = existing_df["Date"].max()
            print(f"   Max Date en caché: {last_date.strftime('%Y-%m-%d')}")

    now = pd.Timestamp.now().normalize()
    if last_date is None:
        start_dt = now - pd.Timedelta(days=1825)
    else:
        start_dt = last_date - pd.Timedelta(days=OVERLAP_DAYS)

    end_dt = now + pd.Timedelta(days=1)
    start_str = start_dt.strftime("%Y-%m-%d")
    end_str = end_dt.strftime("%Y-%m-%d")

    print(f"📡 Descargando OHLCV incremental para {len(tickers)} tickers desde {start_str} hasta {end_str}...")

    all_frames = []
    chunk_size = 12
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i:i + chunk_size]
        df_chunk = download_chunk(chunk, start_str, end_str)
        if not df_chunk.empty:
            all_frames.append(df_chunk)
        print(f"   [{i//chunk_size + 1}/{(len(tickers) + chunk_size - 1)//chunk_size}] {len(chunk)} tickers → {len(df_chunk)} filas")
        time.sleep(0.5)

    if not all_frames and existing_df.empty:
        print("❌ No se pudieron obtener datos nuevos ni se tenía caché previo.")
        return

    if all_frames:
        new_df = pd.concat(all_frames, ignore_index=True)
        new_df["Date"] = pd.to_datetime(new_df["Date"])

        if not existing_df.empty:
            combined = pd.concat([existing_df, new_df], ignore_index=True)
        else:
            combined = new_df
    else:
        combined = existing_df

    combined["Date"] = pd.to_datetime(combined["Date"])
    combined = combined.drop_duplicates(subset=["Date", "Ticker"], keep="last").sort_values(["Ticker", "Date"])

    # Normalizar formato de fecha a YYYY-MM-DD para compatibilidad
    combined["Date"] = combined["Date"].dt.strftime("%Y-%m-%d")

    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    combined.to_csv(CACHE, index=False)

    max_date_str = combined["Date"].max()
    print(f"✅ Caché OHLCV actualizado exitosamente: {CACHE}")
    print(f"   Total filas: {len(combined)} | Tickers: {combined['Ticker'].nunique()} | Última fecha OHLCV: {max_date_str}")


if __name__ == "__main__":
    actualizar_ohlcv()
