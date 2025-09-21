import random
import re
from datetime import datetime, timedelta
from models.mediciones import insert_many_mediciones
from models.sensor import get_sensores_para_mediciones

# Probabilidades de patrones especiales (puedes ajustar estos valores)
P_FALLO_GLOBAL = 0.10
P_PUERTA_ABIERTA = 0.07
P_OFFLINE = 0.05  # Probabilidad de simular un hueco offline
P_CICLO_DESCONGELAMIENTO = 0.08  # Probabilidad de simular inicio de ciclo de descongelamiento
P_CICLO_ASINCRONICO = 0.03  # Probabilidad de simular ciclo asincrónico
P_VUELTA_ONLINE = 0.30  # Probabilidad de que un sensor offline vuelva online

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

def _deducir_tipo(sensor_doc):
    """
    Deducción robusta del tipo de cámara/sensor.
    Prioriza el campo 'notas', luego el alias.
    """
    notas = _normalize(sensor_doc.get("notas", ""))
    alias = _normalize(sensor_doc.get("alias", ""))
    # Buscar palabras clave en notas
    if "congelad" in notas:
        return "congelado"
    if "helad" in notas:
        return "helados"
    if "frut" in notas:
        return "frutas"
    if "verdur" in notas:
        return "verduras"
    if "carne" in notas:
        return "carnes frescas"
    # Si no se encontró en notas, buscar en alias
    if "congelad" in alias:
        return "congelado"
    if "helad" in alias:
        return "helados"
    if "frut" in alias:
        return "frutas"
    if "verdur" in alias:
        return "verduras"
    if "carne" in alias:
        return "carnes frescas"
    # Fallback: lo que haya en alias (última palabra)
    parts = alias.split("-")
    if len(parts) >= 2:
        tipo = parts[-1].strip()
        return tipo
    return ""

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

def _simular_medicion(sensor_doc, fecha_base=None, offline_gap_min=15):
    """
    Simula una medición para un sensor, pudiendo forzar patrones para disparar alertas.
    - fecha_base: si se pasa, se usa como fecha de la medición (útil para simular gaps).
    - offline_gap_min: minutos de hueco para simular offline.
    """
    tipo = _deducir_tipo(sensor_doc)
    vmin = sensor_doc.get("valorMin")
    vmax = sensor_doc.get("valorMax")
    if vmin is None or vmax is None:
        rng_int = DEFAULT_INT_BY_TIPO.get(tipo, (0.0, 1.0))
    else:
        rng_int = (float(vmin), float(vmax))
    
    # Rango externo: por tipo (fallback genérico 20-28)
    rng_ext = DEFAULT_EXT_BY_TIPO.get(tipo, (20.0, 28.0))

    # 1. Simular offline (hueco de tiempo)
    if random.random() < P_OFFLINE:
        # Simula un hueco de tiempo (no retorna medición, pero retorna la fecha futura)
        fecha_offline = (fecha_base or datetime.utcnow()) + timedelta(minutes=offline_gap_min)
        return None, fecha_offline

    # 2. Simular ciclo de descongelamiento (temperatura interna alta)
    if random.random() < P_CICLO_DESCONGELAMIENTO:
        temp_int = rng_int[1] + random.uniform(2, 6)  # Muy por encima del rango
        temp_ext = _rng_dentro(*rng_ext)
        puerta = 0
        return {
            "idSensor": sensor_doc.get("nroSensor") or sensor_doc.get("_id"),
            "fechaHoraMed": fecha_base or datetime.utcnow(),
            "valorTempInt": round(temp_int, 1),
            "valorTempExt": round(temp_ext, 1),
            "puerta": puerta,
        }, None

    # 3. Simular ciclo asincrónico (ciclo de descongelamiento anormal)
    if random.random() < P_CICLO_ASINCRONICO:
        temp_int = rng_int[1] + random.uniform(8, 12)  # Mucho más alto de lo normal
        temp_ext = _rng_dentro(*rng_ext)
        puerta = 0
        return {
            "idSensor": sensor_doc.get("nroSensor") or sensor_doc.get("_id"),
            "fechaHoraMed": fecha_base or datetime.utcnow(),
            "valorTempInt": round(temp_int, 1),
            "valorTempExt": round(temp_ext, 1),
            "puerta": puerta,
        }, None

    # 4. Simular fuera de rango, Probabilidad de fallo global (10% por defecto)
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
        "fechaHoraMed": fecha_base or datetime.utcnow(),
        "valorTempInt": round(float(temp_int), 1),
        "valorTempExt": round(float(temp_ext), 1),
        "puerta": puerta,
    }, None

def generar_mediciones(mongo, id_empresa=None, incluir_inactivos=False):
    #   Lee sensores de la colección `sensores` y genera UNA medición por sensor.
    q = {}
    if id_empresa:
        q["idEmpresa"] = id_empresa
    # Traer TODOS los sensores para poder simular vuelta online
    sensores = get_sensores_para_mediciones(mongo, q)
    if not sensores:
        return 0

    docs = []
    now = datetime.utcnow()
    for sensor in sensores:
        fecha = now

        # --- Refactor: Simular vuelta online ---
        if sensor.get("estado") == "inactive":
            # Buscar alerta crítica abierta de offline
            from models.alerta import q_alerta_abierta_offline
            alerta_abierta = q_alerta_abierta_offline(mongo, sensor["nroSensor"], sensor["idEmpresa"])
            if alerta_abierta and random.random() < P_VUELTA_ONLINE:
                # Simular medición para volver online
                med, _ = _simular_medicion(sensor, fecha)
                if med:
                    docs.append(med)
                    # Actualizar estado del sensor a active
                    from models.sensor import updateStatus
                    updateStatus(mongo, sensor["nroSensor"], sensor["idEmpresa"], "active")
            continue  # No simular medición normal para sensores inactivos

        # --- Simulación normal ---
        med, fecha_offline = _simular_medicion(sensor, fecha)
        if med:
            docs.append(med)
        # Si fecha_offline, simplemente no generás medición (el gap se da naturalmente)


    if not docs:
        return 0
    insert_many_mediciones(mongo, docs)
    return len(docs)