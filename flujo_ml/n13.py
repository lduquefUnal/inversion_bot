#!/usr/bin/env python3
"""
n13.py — Shims de compatibilidad para scripts que importaban desde 13_iterar_noche.
Reexporta las funciones unificadas desde bt_honesto.py (fuente única de verdad).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (
    rsi, atr, asignar_categoria, CAT_PARAMS,
    compute_features, build_dataset, enrich_feat,
    simulate_signals, metrics, calibration,
    load_fundamentals, parse_fcf, parse_float,
    FULL_FEATURES, FEATURES, RISK_FEATURES, FUND_FEATURES,
    CACHE, MODELOS,
)

# Compatibilidad: 13_iterar_noche usaba estos nombres
FULL_FEATURES = FULL_FEATURES
