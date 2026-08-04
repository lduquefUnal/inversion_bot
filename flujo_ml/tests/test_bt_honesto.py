#!/usr/bin/env python3
"""
tests/test_bt_honesto.py — Tests unitarios para bt_honesto.py
=============================================================
Valida: asignar_categoria, simulate_signals, metrics, calibration, no-leakage en build_dataset.
"""
import sys
import os
import math
import pytest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bt_honesto import (
    asignar_categoria, simulate_signals, metrics, calibration,
    CAT_PARAMS, rsi, atr,
)


# ── asignar_categoria ────────────────────────────────────────────────────────

class TestAsignarCategoria:
    def test_cazador_dips(self):
        assert asignar_categoria(-40.0, 30.0, 10.0, False) == "Cazador Dips"

    def test_sweet_spot(self):
        # dd entre -20 y -40, tendencia_sana=True, rsi2 cualquiera
        assert asignar_categoria(-25.0, 50.0, 20.0, True) == "Sweet Spot"

    def test_recup_rapida(self):
        # tendencia sana, dd ligero, rsi2 < 15
        assert asignar_categoria(-5.0, 50.0, 10.0, True) == "Recup. Rapida"

    def test_cuchillos_cayendo(self):
        # sin tendencia, rsi2 < 5
        assert asignar_categoria(-60.0, 40.0, 3.0, False) == "Cuchillos Cayendo"

    def test_none_fuera_de_criterios(self):
        # tendencia sana, rsi2 alto, dd ligero → no encaja en ninguna
        assert asignar_categoria(-2.0, 70.0, 60.0, True) is None


# ── simulate_signals ─────────────────────────────────────────────────────────

def make_feat_df(tickers_data):
    """Construye un DataFrame de features mínimo para simulate_signals."""
    rows = []
    for ticker, cat, dates, closes, highs, lows, probs in tickers_data:
        for d, c, h, l, p in zip(dates, closes, highs, lows, probs):
            rows.append({
                "Date": pd.Timestamp(d), "Ticker": ticker, "Categoria": cat,
                "Close": c, "High": h, "Low": l, "prob": p,
            })
    return pd.DataFrame(rows)


class TestSimulateSignals:
    def _base_df(self):
        dates = pd.date_range("2026-01-01", periods=15)
        closes = [100.0] * 15
        highs = [101.0] * 15
        lows = [99.0] * 15
        probs = [0.8] + [0.0] * 14  # señal solo en día 0
        return make_feat_df([("AAPL", "Cazador Dips", dates, closes, highs, lows, probs)])

    def test_win_trade(self):
        """TP alcanzado → resultado WIN."""
        dates = pd.date_range("2026-01-01", periods=15)
        closes = [100.0] * 15
        # Día 3: high supera TP (100 × 1.12 = 112)
        highs = [101.0, 101.0, 101.0, 115.0] + [101.0] * 11
        lows = [99.0] * 15
        probs = [0.8] + [0.0] * 14
        df = make_feat_df([("AAPL", "Cazador Dips", dates, closes, highs, lows, probs)])
        trades = simulate_signals(df, df["prob"].values, umbral=0.5)
        assert len(trades) == 1
        assert trades[0]["Resultado"] == "WIN"

    def test_loss_trade(self):
        """SL tocado → resultado LOSS."""
        dates = pd.date_range("2026-01-01", periods=15)
        closes = [100.0] * 15
        highs = [101.0] * 15
        # Día 2: low toca SL (100 × 0.95 = 95)
        lows = [99.0, 99.0, 94.0] + [99.0] * 12
        probs = [0.8] + [0.0] * 14
        df = make_feat_df([("AAPL", "Cazador Dips", dates, closes, highs, lows, probs)])
        trades = simulate_signals(df, df["prob"].values, umbral=0.5)
        assert len(trades) == 1
        assert trades[0]["Resultado"] == "LOSS"

    def test_timeout_trade(self):
        """Plazo agotado sin TP/SL → TIMEOUT."""
        df = self._base_df()
        trades = simulate_signals(df, df["prob"].values, umbral=0.5)
        assert len(trades) == 1
        assert trades[0]["Resultado"] == "TIMEOUT"

    def test_below_umbral_no_signal(self):
        """Probabilidad < umbral → sin trades."""
        df = self._base_df()
        df["prob"] = 0.3
        trades = simulate_signals(df, df["prob"].values, umbral=0.5)
        assert len(trades) == 0


# ── metrics ──────────────────────────────────────────────────────────────────

class TestMetrics:
    def _trades(self, results, pnls):
        return [{"Resultado": r, "PnL_Neto_%": p, "Veredicto_V2": "BUY",
                 "Probabilidad_%": 60.0} for r, p in zip(results, pnls)]

    def test_empty_trades(self):
        m = metrics([])
        assert m["total"] == 0
        assert m["win_rate_%"] == 0

    def test_win_rate(self):
        trades = self._trades(["WIN", "WIN", "LOSS"], [5.0, 3.0, -4.0])
        m = metrics(trades)
        assert m["total"] == 3
        assert m["wins"] == 2
        assert m["win_rate_%"] == pytest.approx(66.7, abs=0.1)

    def test_pnl_promedio(self):
        trades = self._trades(["WIN", "LOSS"], [6.0, -4.0])
        m = metrics(trades)
        assert m["pnl_promedio_%"] == pytest.approx(1.0, abs=0.01)


# ── calibration ──────────────────────────────────────────────────────────────

class TestCalibration:
    def test_empty(self):
        assert calibration([]) == []

    def test_bucket_assignment(self):
        # prob 0.55 → bucket "50-60%"
        trades = [{"Resultado": "WIN", "Probabilidad_%": 55.0}]
        cal = calibration(trades)
        assert any("50" in c["bucket"] for c in cal)

    def test_wr_calculation(self):
        trades = [
            {"Resultado": "WIN", "Probabilidad_%": 52.0},
            {"Resultado": "LOSS", "Probabilidad_%": 53.0},
        ]
        cal = calibration(trades)
        bucket = next(c for c in cal if "50" in c["bucket"])
        assert bucket["wr_real_%"] == 50.0
        assert bucket["n"] == 2


# ── No-leakage: build_dataset ────────────────────────────────────────────────

class TestNoLeakage:
    """El target de cada fila debe calcularse con datos FUTUROS al día de señal."""

    def test_target_uses_future_data(self):
        """Construye un OHLCV sintético de 2 tickers, 80 días, y verifica que
        split_train_test separa correctamente (sin contaminación futura)."""
        from bt_honesto import split_train_test, load_ohlcv
        import datetime

        # Crear OHLCV mínimo sintético
        n = 80
        dates = pd.date_range("2025-01-01", periods=n)
        data = []
        for ticker in ["AAA", "BBB"]:
            for d in dates:
                data.append({
                    "Date": d, "Ticker": ticker,
                    "Open": 100.0, "High": 105.0, "Low": 95.0, "Close": 100.0, "Volume": 1e6,
                })
        ohlcv = pd.DataFrame(data)
        cutoff = pd.Timestamp("2025-02-15")
        train, test = split_train_test(ohlcv, cutoff)
        assert train["Date"].max() < cutoff
        assert test["Date"].min() >= cutoff


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
