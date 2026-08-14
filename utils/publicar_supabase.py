#!/usr/bin/env python3
"""
Publica predicciones_v2.json a Supabase (public.predicciones) vía REST API sin dependencias externas.
"""
import os
import json
import math
import datetime
import urllib.request
import urllib.error

def cargar_env_local(filepath=".env"):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip("'\""))

cargar_env_local()

def sanitize_data(obj):
    if isinstance(obj, dict):
        return {k: sanitize_data(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_data(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj

def publicar_predicciones(supabase_url, service_role_key):
    json_path = os.path.join("flujo_datos", "predicciones_v2.json")
    if not os.path.exists(json_path):
        print(f"❌ Error: Archivo {json_path} no encontrado.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    clean_data = sanitize_data(data)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    row = {
        "fecha": now_iso,
        "payload": clean_data
    }

    endpoint = f"{supabase_url}/rest/v1/predicciones"
    payload_bytes = json.dumps(row, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(endpoint, data=payload_bytes, method="POST")
    req.add_header("apikey", service_role_key)
    req.add_header("Authorization", f"Bearer {service_role_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates")

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.getcode()
            print(f"✅ Predicciones publicadas exitosamente en Supabase (HTTP status {status}, fecha={now_iso})")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"❌ Error HTTP publicando predicciones en Supabase [{e.code}]: {body}")
    except Exception as e:
        print(f"❌ Error inesperado publicando predicciones en Supabase: {e}")


def publicar_mlops_historial(supabase_url, service_role_key):
    registry_path = os.path.join("flujo_datos", "registry_history.json")
    if not os.path.exists(registry_path):
        return

    with open(registry_path, "r", encoding="utf-8") as f:
        registry = json.load(f)

    if not registry:
        return

    latest_record = registry[-1]
    version_id = latest_record.get("version_id", f"v3.7-{datetime.datetime.now().strftime('%Y-%m-%d')}")

    row = {
        "version_id": version_id,
        "fecha": latest_record.get("fecha", datetime.datetime.now(datetime.timezone.utc).isoformat()),
        "payload": sanitize_data(latest_record)
    }

    endpoint = f"{supabase_url}/rest/v1/mlops_historial"
    payload_bytes = json.dumps(row, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(endpoint, data=payload_bytes, method="POST")
    req.add_header("apikey", service_role_key)
    req.add_header("Authorization", f"Bearer {service_role_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates")

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.getcode()
            print(f"✅ MLOps historial publicado exitosamente en Supabase (HTTP status {status}, version_id={version_id})")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"⚠️ Nota: No se pudo publicar en mlops_historial [{e.code}] (¿Falta aplicar migración 0005?): {body}")
    except Exception as e:
        print(f"⚠️ Nota publicando mlops_historial: {e}")


def main():
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        print("⚠️ Warn: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados. Omitiendo publicación a Supabase.")
        return

    publicar_predicciones(supabase_url, service_role_key)
    publicar_mlops_historial(supabase_url, service_role_key)


if __name__ == "__main__":
    main()
