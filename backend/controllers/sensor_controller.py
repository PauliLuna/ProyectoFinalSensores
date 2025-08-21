from flask import request, jsonify, session
from models.sensor import insert_sensor, get_sensor_with_assignments, get_mediciones_model, get_last_change_door, obtain_current_state_duration, get_ultima_medicion, count_aperturas, get_last_open_duration
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from controllers.asignaciones_controller import register_assignment, update_assignment
import json
from datetime import datetime
import requests
import os
import pytz


def get_coordinates_from_address(address):
    geolocator = Nominatim(user_agent="sensia-app")
    try:
        location = geolocator.geocode(address, timeout=5)
        if location:
            return location.latitude, location.longitude
        else:
            return None, None
    except (GeocoderUnavailable, GeocoderTimedOut, Exception) as e:
        print(f"Error geocoding address '{address}': {e}")
        return None, None


def register_sensor(mongo):
    """
    Lee los datos del formulario (por POST),convierte la dirección en coordenadas y los inserta en la base de datos.
    """
     # Construimos la dirección completa
    full_address = f"{request.form.get('direccion')}, {request.form.get('ciudad')}, {request.form.get('provincia')}, {request.form.get('pais')}"

    lat, lon = get_coordinates_from_address(full_address)
    if lat is None or lon is None:
        return jsonify({"message": "La dirección ingresada no es válida o no se pudo encontrar en el mapa. Por favor, verifica que todos los campos de la dirección sean correctos."}), 400

    try:
        nro_sensor = int(request.form.get('nroSensor')) if request.form.get('nroSensor') else None
    except ValueError:
        nro_sensor = None

    try:
        valor_min = int(request.form.get('valorMin')) if request.form.get('valorMin') else None
    except ValueError:
        valor_min = None
    try:
        valor_max = int(request.form.get('valorMax')) if request.form.get('valorMax') else None
    except ValueError:
        valor_max = None

    # Obtener idEmpresa de la sesión
    idEmpresa = session.get('idEmpresa')
    if idEmpresa and not isinstance(idEmpresa, str):
        idEmpresa = str(idEmpresa)

    sensor_data = {
         "nroSensor": nro_sensor,
         "alias": request.form.get('alias'),
         "notas": request.form.get('notas'),
         "valorMin": valor_min,
         "valorMax": valor_max,
         "direccion": request.form.get('direccion'),
         "pais": request.form.get('pais'),
         "provincia": request.form.get('provincia'),
         "ciudad": request.form.get('ciudad'),
         "cp": request.form.get('cp'),
         "estado": request.form.get('estado'), 
         "latitud": lat,
         "longitud": lon,
         "idEmpresa": idEmpresa
    }
    # Puedes agregar validaciones aquí según lo necesario
    insert_sensor(mongo, sensor_data)

    # Procesar el campo oculto 'assignments', se espera un JSON con un array de emails.
    assignments_field = request.form.get('assignments')
    if assignments_field:
        try:
            assignments = json.loads(assignments_field)  # Espera un array de objetos { idUsuario, permiso, estadoAsignacion }
        except Exception as e:
            # Si no es JSON, fallback (no recomendado)
            assignments = []
        for assignment in assignments:
            user_id = assignment.get("idUsuario")
            permiso = assignment.get("permiso", "Read")
            estadoAsignacion = assignment.get("estadoAsignacion")
            # Registrar la asignación usando el id y el permiso
            register_assignment(mongo, sensor_data["nroSensor"], user_id, permiso=permiso, estadoAsignacion=estadoAsignacion)

    return jsonify({"message": "Sensor registrado correctamente", "sensor_id": sensor_data["nroSensor"]}), 201

def update_sensor(mongo, sensor_id):
    """
    Actualiza los datos de un sensor existente y sus asignaciones.
    Se asume que sensor_id se obtiene del formulario.
    """
    # Construimos la dirección completa
    full_address = f"{request.form.get('direccion')}, {request.form.get('ciudad')}, {request.form.get('provincia')}, {request.form.get('pais')}"
    lat, lon = get_coordinates_from_address(full_address)
    if lat is None or lon is None:
        return jsonify({"message": "La dirección ingresada no es válida o no se pudo encontrar en el mapa. Por favor, verifica que todos los campos de la dirección sean correctos."}), 400

    try:
        sensor_id = int(sensor_id)  # Solo si en la base es int
    except ValueError:
        pass  # Si no se puede convertir, queda como string

    try:
        valor_min = int(request.form.get('valorMin')) if request.form.get('valorMin') else None
    except ValueError:
        valor_min = None
    try:
        valor_max = int(request.form.get('valorMax')) if request.form.get('valorMax') else None
    except ValueError:
        valor_max = None

    sensor_data = {
         "alias": request.form.get('alias'),
         "notas": request.form.get('notas'),
         "valorMin": valor_min,
         "valorMax": valor_max,
         "direccion": request.form.get('direccion'),
         "pais": request.form.get('pais'),
         "provincia": request.form.get('provincia'),
         "ciudad": request.form.get('ciudad'),
         "cp": request.form.get('cp'),
         "estado": request.form.get('estado'), 
         "latitud": lat,
         "longitud": lon
    }
    # Actualizamos el sensor existente:
    result = mongo.db.sensors.update_one(
        {"nroSensor": sensor_id},
        {"$set": sensor_data}
    )
    
    # Procesar asignaciones (similar a lo que hiciste en register_sensor)
    assignments_field = request.form.get('assignments')
    if assignments_field:
        try:
            assignments = json.loads(assignments_field)  # Espera array de objetos { idUsuario, permiso }
        except Exception as e:
            assignments = []
        for assignment in assignments:
            user_id = assignment.get("idUsuario")
            permiso = assignment.get("permiso", "Read")
            estadoAsignacion = assignment.get("estadoAsignacion")
            # Aquí tendrías que decidir si actualizar la asignación existente o crear una nueva.
            # Por ejemplo, puedes buscar una asignación para ese sensor y usuario y, si existe, actualizarla,
            # de lo contrario, crearla.
            existing = mongo.db.asignaciones.find_one({"idSensor": sensor_id, "idUsuario": user_id})
            if existing:
                update_assignment(mongo, existing["_id"], permiso=permiso, estadoAsignacion=estadoAsignacion)
            else:
                register_assignment(mongo, sensor_id, user_id, permiso=permiso, estadoAsignacion=estadoAsignacion)

    return jsonify({"message": "Sensor actualizado correctamente", "sensor_id": sensor_id}), 200

def get_all_sensors(mongo):
    # Obtener idEmpresa de la sesión
    id_empresa = session.get('idEmpresa')
    if not id_empresa:
        return []
    
    sensores = list(mongo.db.sensors.find({"idEmpresa": id_empresa}))
    result = []
    for sensor in sensores:
        nro_sensor = sensor.get('nroSensor')
        # Usar el incremental para el join si corresponde
        last_med = mongo.db.mediciones.find_one(
            {"idSensor": nro_sensor},
            sort=[("fechaHoraMed", -1)]
        )
        alias = sensor.get('alias', '')
        notas = sensor.get('notas')
        estado = "ONLINE" if sensor.get('estado') == "active" else "OFFLINE"
        temp_interna = last_med.get('valorTempInt') if last_med else None
        temp_externa = last_med.get('valorTempExt') if last_med else None
        valor_min = sensor.get('valorMin')
        valor_max = sensor.get('valorMax')
        latitud = sensor.get('latitud')
        longitud = sensor.get('longitud')
        en_rango = (
            temp_interna is not None and valor_min is not None and valor_max is not None
            and valor_min <= temp_interna <= valor_max
        )
        result.append({
            "nroSensor": nro_sensor,
            "alias": alias,
            "notas": notas,
            "estado": estado,
            "temperaturaInterna": temp_interna,
            "temperaturaExterna": temp_externa,
            "enRango": en_rango,
            "latitud": latitud,
            "longitud": longitud,
            "valorMin": valor_min,
            "valorMax": valor_max,
            "direccion": sensor.get('direccion')
        })
    return result

# ALL EMPRESAS
def get_all_sensors_empresa(mongo, id_empresa):
    # Traer todos los sensores de la empresa
    sensores = list(mongo.db.sensors.find({"idEmpresa": id_empresa}))
    result = []
    for sensor in sensores:
        nro_sensor = sensor.get('nroSensor')
        last_med = mongo.db.mediciones.find_one(
            {"idSensor": nro_sensor},
            sort=[("fechaHoraMed", -1)]
        )
        alias = sensor.get('alias', '')
        notas = sensor.get('notas')
        estado = "ONLINE" if sensor.get('estado') == "active" else "OFFLINE"
        temp_interna = last_med.get('valorTempInt') if last_med else None
        temp_externa = last_med.get('valorTempExt') if last_med else None
        valor_min = sensor.get('valorMin')
        valor_max = sensor.get('valorMax')
        latitud = sensor.get('latitud')
        longitud = sensor.get('longitud')
        en_rango = (
            temp_interna is not None and valor_min is not None and valor_max is not None
            and valor_min <= temp_interna <= valor_max
        )
        result.append({
            "nroSensor": nro_sensor,
            "alias": alias,
            "notas": notas,
            "estado": estado,
            "temperaturaInterna": temp_interna,
            "temperaturaExterna": temp_externa,
            "enRango": en_rango,
            "latitud": latitud,
            "longitud": longitud,
            "valorMin": valor_min,
            "valorMax": valor_max,
            "direccion": sensor.get('direccion'),
            "idEmpresa": sensor.get('idEmpresa')
        })
    return result

def get_sensor(mongo, sensor_id):
    try:
        sensor = get_sensor_with_assignments(mongo, sensor_id)
        if not sensor:
            return jsonify({"error": "Sensor no encontrado"}), 404
        return jsonify(sensor), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def obtener_mediciones(mongo, sensor_id, desde, hasta):
    if not sensor_id or not desde or not hasta:
        raise ValueError("Faltan parámetros")

    try:
        nro_sensor = int(sensor_id)
        fecha_desde = datetime.fromisoformat(desde)
        fecha_hasta = datetime.fromisoformat(hasta)
    except Exception as e:
        raise ValueError(f"Parámetros inválidos: {e}")

    return get_mediciones_model(mongo, nro_sensor, fecha_desde, fecha_hasta)

def get_mediciones(mongo, sensor_id, desde, hasta):
    try:
        mediciones = obtener_mediciones(mongo, sensor_id, desde, hasta)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400

    result = []
    for m in mediciones:
        result.append({
            "fechaHoraMed": m["fechaHoraMed"].isoformat(),
            "valorTempInt": m.get("valorTempInt"),
            "valorTempExt": m.get("valorTempExt"),
            "puerta": m.get("puerta")
        })
    return jsonify(result)


def procesar_sensor(mongo, sensor_id):
    fecha_hasta = datetime.utcnow()
    
    primera_medicion = mongo.db.mediciones.find_one(
        {"idSensor": sensor_id},
        sort=[("fechaHoraMed", 1)]
    )

    fecha_desde = primera_medicion["fechaHoraMed"]

    try:
        mediciones = obtener_mediciones(mongo, sensor_id, fecha_desde.isoformat(), fecha_hasta.isoformat())
    except Exception as e:
        print(f"Error al obtener mediciones para sensor {sensor_id}: {e}")
        return {}

    fecha_cambio = get_last_change_door(mediciones)
    duracion = obtain_current_state_duration(mediciones)

    return {
        "ultimoCambioPuerta": fecha_cambio.isoformat() if fecha_cambio else None,
        "duracionEstadoActual": str(duracion) if duracion else None
    }

def obtener_ultima_medicion(mongo, sensor_id):
    try:
        nro_sensor = int(sensor_id)
    except ValueError:
        raise ValueError("ID del sensor inválido")

    medicion = get_ultima_medicion(mongo, nro_sensor)
    if not medicion:
        return None
    
    # Obtenemos la fechaHora en formato UTC desde la DB.
    fecha_utc = medicion["fechaHoraMed"]

    # Definimos la zona horaria UTC y la zona de Argentina.
    zona_utc = pytz.timezone('UTC')
    zona_argentina = pytz.timezone('America/Argentina/Buenos_Aires')

    # Convertimos la fecha de UTC a la zona horaria de Argentina.
    # Primero, se le "asigna" la zona horaria UTC a la fecha.
    fecha_utc_con_zona = zona_utc.localize(fecha_utc)

    # Luego, se convierte a la zona horaria de Argentina.
    fecha_argentina = fecha_utc_con_zona.astimezone(zona_argentina)

    return {
        "fechaHoraMed": fecha_argentina.isoformat(), # Convertir a -3hs
        "valorTempInt": medicion.get("valorTempInt"),
        "valorTempExt": medicion.get("valorTempExt"),
        "puerta": medicion.get("puerta")
    }

def obtener_cantidad_aperturas(mongo, sensor_id):
    try:
        nro_sensor = int(sensor_id)
    except ValueError:
        raise ValueError("ID del sensor inválido")

    return count_aperturas(mongo, nro_sensor)

def get_duracion_ultima_apertura(mongo, sensor_id):
    # Traer TODAS las mediciones del sensor
    mediciones = get_mediciones_model(mongo, sensor_id, datetime.min, datetime.utcnow())
    duracion = get_last_open_duration(mediciones)

    return {
        "duracionUltimaApertura": str(duracion) if duracion else None
    }

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

def analizar_mediciones(sensor_id, mediciones, notas):
    # Construcción del prompt
    user_prompt = (
        "Analiza las siguientes mediciones de temperatura interna, temperatura externa "
        "y el estado de puerta (0=cerrada, 1=abierta) de una cámara frigorífica, considerando además:\n"
        "• Los ciclos de descongelamiento son eventos programados que detienen momentáneamente la refrigeración y "
        "provocan aumentos temporales de temperatura interna, que luego desciende nuevamente al rango normal.\n"
        "• Frecuencia típica de ciclos:\n"
        "   - Cámaras de congelados (-18°C a -25°C): 3–4 ciclos/día, 20–40 min cada 6–8 h (00, 06, 12, 18 h).\n"
        "   - Cámaras de helados (-20°C a -25°C): 3–4 ciclos/día, 20–30 min.\n"
        "   - Carnes frescas (-1°C a 2°C): 2–3 ciclos/día, 15–25 min.\n"
        "   - Frutas y verduras (1°C a 8°C): 1–2 ciclos/día, 10–20 min.\n"
        "No considerar estos aumentos temporales como anomalías si coinciden con la duración y frecuencia típica.\n"
        "Considerar que si se abre muchas veces la puerta como una anomalía .\n\n"
        f"Contexto adicional del sensor: {notas}.\n\n"
        "Genera un resumen breve en un formato claro y visual con íconos representativos:\n"
        "1) **Estado actual:** usa 🟢 para funcionamiento normal, 🟠 para alerta leve, 🔴 para problemas críticos.\n"
        "2) **Tendencias relevantes:** usa 📈 para aumento de temperatura, 📉 para descenso, ➖ para estabilidad.\n"
        "3) **Riesgos inmediatos:** usa ⚠️ si hay algún riesgo, ✅ si no hay riesgos.\n"
        "4) **Recomendación rápida:** usa 🛠️ si hay acciones recomendadas, 📋 si no son necesarias.\n\n"
        "Formato de salida EXACTO (no agregar texto fuera de este bloque):\n"
        "**Estado actual:** <texto con ícono>\n"
        "**Tendencias relevantes:** <texto con ícono>\n"
        "**Riesgos inmediatos:** <texto con ícono>\n"
        "**Recomendación rápida:** <texto con ícono>\n\n"
        f"Datos del sensor {sensor_id}:\n"
        f"{json.dumps(mediciones, indent=2)}"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_prompt}
                ]
            }
        ]
    }

    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }

    response = requests.post(GEMINI_API_URL, headers=headers, json=payload, timeout=60)

    if response.status_code != 200:
        raise Exception(f"Error en Gemini API: {response.text}")

    data = response.json()
    # Extraer el texto generado
    return data["candidates"][0]["content"]["parts"][0]["text"]