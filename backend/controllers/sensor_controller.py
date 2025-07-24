from flask import request, jsonify, session
from models.sensor import insert_sensor, get_sensor_with_assignments, get_mediciones_model, get_last_change_door, obtain_current_state_duration, get_ultima_medicion, count_aperturas
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
from controllers.asignaciones_controller import register_assignment, update_assignment
import json
from datetime import datetime


def get_coordinates_from_address(address):
    # Convierte una dirección en coordenadas (latitud, longitud) usando Nominatim.
    geolocator = Nominatim(user_agent="sensor_app")
    try:
        location = geolocator.geocode(address)
        if location:
            return location.latitude, location.longitude
        else:
            return None, None
    except GeocoderTimedOut:
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

    return {
        "fechaHoraMed": medicion["fechaHoraMed"].isoformat(),
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