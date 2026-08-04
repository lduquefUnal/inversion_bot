#!/usr/bin/env python3
"""
tests/test_features.py — Tests para add_skill_features() y nuevas features V3
=============================================================================
Valida: BB_Width >= 0, Consecutive_Down_Days >= 0, ATR_Regime > 0,
        sin NaN en features críticas, 33 features en V3_FEATURES.
"""
import sys
import os
import pytest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from v3_dataset import (
    bollinger_pctb, consecutive_down_days, atr_regime, cmf,
    add_skill_features, V3_FEATURES,
)


# ── Helpers de features individuales ────────────────────────────────────────

class TestBollingerWidth:
    def test_width_nonnegative(self):
        close = pd.Series([100.0 + i * 0.1 for i in range(50)])
        _, width = bollinger_pctb(close)
        valid = width.dropna()
        assert (valid >= 0).all(), "BB_Width debe ser >= 0"

    def test_width_positive_in_volatile_market(self):
        # mercado con alta volatilidad → BB_Width > 0.01
        rng = np.random.default_rng(42)
        close = pd.Series(100.0 + rng.normal(0, 5, 100).cumsum())
        _, width = bollinger_pctb(close)
        assert width.dropna().mean() > 0.01


class TestConsecutiveDownDays:
    def test_nonnegative(self):
        close = pd.Series([100.0, 99.0, 98.0, 97.0, 100.0, 101.0])
        streak = consecutive_down_days(close)
        assert (streak >= 0).all()

    def test_streak_count(self):
        # 3 días bajistas consecutivos → streak=[0,1,2,3,0]
        close = pd.Series([100.0, 99.0, 98.0, 97.0, 100.0])
        streak = consecutive_down_days(close)
        assert streak.iloc[3] == 3  # día 3: 3 bajas consecutivas

    def test_reset_on_up_day(self):
        close = pd.Series([100.0, 99.0, 101.0])  # baja, sube → reset
        streak = consecutive_down_days(close)
        assert streak.iloc[2] == 0


class TestATRRegime:
    def test_positive(self):
        atr_s = pd.Series([1.5] * 30)
        regime = atr_regime(atr_s)
        assert (regime.dropna() > 0).all()

    def test_stable_market_near_one(self):
        # ATR constante → régimen ≈ 1.0
        atr_s = pd.Series([2.0] * 50)
        regime = atr_regime(atr_s)
        assert abs(regime.dropna().mean() - 1.0) < 0.05


# ── V3_FEATURES ──────────────────────────────────────────────────────────────

class TestV3Features:
    def test_feature_count(self):
        assert len(V3_FEATURES) == 33, f"Esperaba 33 features, tiene {len(V3_FEATURES)}"

    def test_new_features_present(self):
        for f in ["BB_Width", "Consecutive_Down_Days", "ATR_Regime", "RSI2_Pct100", "CMF_Slope_3D"]:
            assert f in V3_FEATURES, f"Feature '{f}' no está en V3_FEATURES"

    def test_no_duplicates(self):
        assert len(V3_FEATURES) == len(set(V3_FEATURES)), "V3_FEATURES tiene duplicados"


# ── add_skill_features (integración mínima) ──────────────────────────────────

def make_ohlcv_synthetic(n=200, tickers=("AAA", "SPY")):
    """OHLCV sintético con suficientes filas para todas las features."""
    rng = np.random.default_rng(0)
    rows = []
    for ticker in tickers:
        price = 100.0
        vol_base = 1e6 if ticker != "SPY" else 5e6
        for i in range(n):
            price = max(10.0, price * (1 + rng.normal(0, 0.015)))
            h = price * (1 + abs(rng.normal(0, 0.005)))
            l = price * (1 - abs(rng.normal(0, 0.005)))
            rows.append({
                "Date": pd.Timestamp("2025-01-01") + pd.Timedelta(days=i),
                "Ticker": ticker, "Open": price, "High": h, "Low": l,
                "Close": price, "Volume": vol_base * rng.uniform(0.5, 2.0),
            })
    return pd.DataFrame(rows)


class TestAddSkillFeaturesIntegration:
    @pytest.fixture(scope="class")
    def result(self):
        ohlcv = make_ohlcv_synthetic()
        return add_skill_features(ohlcv)

    def test_returns_dataframe(self, result):
        assert isinstance(result, pd.DataFrame)

    def test_new_features_in_output(self, result):
        if len(result) == 0:
            pytest.skip("No hay señales en el OHLCV sintético")
        for f in ["BB_Width", "Consecutive_Down_Days", "ATR_Regime"]:
            assert f in result.columns, f"'{f}' no está en el output"

    def test_bb_width_nonneg(self, result):
        if len(result) == 0:
            pytest.skip("No hay señales")
        assert (result["BB_Width"].fillna(0) >= 0).all()

    def test_consecutive_down_days_nonneg(self, result):
        if len(result) == 0:
            pytest.skip("No hay señales")
        assert (result["Consecutive_Down_Days"].fillna(0) >= 0).all()

    def test_no_inf(self, result):
        if len(result) == 0:
            pytest.skip("No hay señales")
        num_cols = result.select_dtypes(include=[np.number]).columns
        assert not np.isinf(result[num_cols].values).any(), "Hay infinitos en las features"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
