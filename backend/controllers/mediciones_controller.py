import random
import re
from datetime import datetime
from models.mediciones import insert_many_mediciones
from models.sensor import get_sensores_para_mediciones

# Rango externo por "tipo" deducido desde alias (fallback si no hay otra fuente)
P_FALLO_GLOBAL = 0.10
P_PUERTA_ABIERTA = 0.07

DEFAULT_EXT_BY_TIPO = {
    "congelado": (27, 32),
    "helados": (20, 28),
    "fruta": (20, 28),
    "frutas": (20, 28),
    "carnes frescas": (20, 28),
    "carne": (20, 28),
    "verduras": (18, 26),
}
# Rango interno por tipo (fallback solo si faltan valorMin/valorMax)
DEFAULT_INT_BY_TIPO = {
    "congelado": (-25, -18),
    "helados": (-25, -20),
    "fruta": (1, 8),
    "frutas": (1, 8),
    "carnes frescas": (-1, 2),
    "carne": (-1, 2),
    "verduras": (2, 10),
}

def _normalize(s: str) -> str:
    s = (s or "").lower().strip()
    repl = (("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"))
    for a,b in repl: s = s.replace(a,b)
    return s

def _tipo_from_alias(alias: str):
    #Espera alias como 'Blvd. Oroño - Congelados' → 'congelados'
    if not alias: return None
    parts = alias.split("-")
    if len(parts) < 2: return None
    tipo = _normalize(parts[-1]).strip()
    tipo = re.sub(r"\s+", " ", tipo)
    return tipo

def _rng_dentro(a, b):
    a, b = float(a), float(b)
    if a > b: a, b = b, a
    return random.random() * (b - a) + a

def _rng_fuera(a, b, extra_low=5.0, extra_high=4.0):
    a, b = float(a), float(b)
    if a > b: a, b = b, a
    if random.random() < 0.5:
        return a - random.random() * extra_low
    else:
        return b + random.random() * extra_high

def _simular_medicion(sensor_doc):
    tipo = _tipo_from_alias(sensor_doc.get("alias")) or ""
    vmin = sensor_doc.get("valorMin")
    vmax = sensor_doc.get("valorMax")
    if vmin is None or vmax is None:
        rng_int = DEFAULT_INT_BY_TIPO.get(tipo, (0.0, 1.0))
    else:
        rng_int = (float(vmin), float(vmax))
    
    # Rango externo: por tipo (fallback genérico 20-28)
    rng_ext = DEFAULT_EXT_BY_TIPO.get(tipo, (20.0, 28.0))
    # Probabilidad de fallo global (10% por defecto)
    fallo = (random.random() < P_FALLO_GLOBAL)
    if fallo:
        temp_int = _rng_fuera(*rng_int)
        temp_ext = _rng_fuera(*rng_ext)
    else:
        temp_int = _rng_dentro(*rng_int)
        temp_ext = _rng_dentro(*rng_ext)
    # Probabilidad de puerta abierta (7% por defecto)
    puerta = 1 if random.random() < P_PUERTA_ABIERTA else 0

    return {
        "idSensor": sensor_doc.get("nroSensor") or sensor_doc.get("_id"),
        "fechaHoraMed": datetime.utcnow(),
        "valorTempInt": round(float(temp_int), 1),
        "valorTempExt": round(float(temp_ext), 1),
        "puerta": puerta,
    }

def generar_mediciones(mongo, id_empresa=None, incluir_inactivos=False):
    #   Lee sensores de la colección `sensores` y genera UNA medición por sensor.
    q = {}
    if id_empresa:
        q["idEmpresa"] = id_empresa
    if not incluir_inactivos:
        q["estado"] = {"$ne": "inactive"}
    sensores = get_sensores_para_mediciones(mongo, q)
    if not sensores:
        return 0
    docs = [_simular_medicion(s) for s in sensores]
    if not docs:
        return 0
    insert_many_mediciones(mongo, docs)
    return len(docs)