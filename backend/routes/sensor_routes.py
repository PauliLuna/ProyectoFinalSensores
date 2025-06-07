from bson import ObjectId
from flask import Blueprint, current_app, jsonify
from controllers.sensor_controller import register_sensor, update_sensor

sensor_bp = Blueprint('sensor_bp', __name__)

@sensor_bp.route('/sensores', methods=['GET'])
def get_all_sensors():
    mongo = current_app.mongo
    sensores = list(mongo.db.sensors.find())
    result = []
    for sensor in sensores:
        nro_sensor = sensor.get('nroSensor') # DPS VER QUE SEA EL INCREMENTAL
        # Obtener la última medición por nroSensor
        last_med = mongo.db.mediciones.find_one(
            {"idSensor": nro_sensor},
            sort=[("fechaHoraMed", -1)]
        )
        # Preparar datos para el frontend
        alias = sensor.get('alias', '')
        estado = "ONLINE" if sensor.get('estado') == "active" else "OFFLINE"
        temp_interna = last_med.get('valorTempInt') if last_med else None
        temp_externa = last_med.get('valorTempExt') if last_med else None
        valor_min = sensor.get('valorMin')
        valor_max = sensor.get('valorMax')
        en_rango = (
            temp_interna is not None and valor_min is not None and valor_max is not None
            and valor_min <= temp_interna <= valor_max
        )
        result.append({
            "id": str(sensor["nroSensorIncremental"]),
            "alias": alias,
            "estado": estado,
            "temperaturaInterna": temp_interna,
            "temperaturaExterna": temp_externa,
            "enRango": en_rango
        })
    return jsonify(result)

@sensor_bp.route('/sensor', methods=['POST'])
def register_sensor_route():
    """
    Ruta para registrar un sensor; utiliza el controlador.
    """
    # Obtenemos la instancia de PyMongo almacenada en current_app.config
    mongo = current_app.mongo
    return register_sensor(mongo)

@sensor_bp.route('/sensor/<sensor_id>', methods=['GET'])
def get_sensor(sensor_id):
    mongo = current_app.mongo
    sensor = mongo.db.sensors.find_one({"_id": ObjectId(sensor_id)})
    if not sensor:
        return jsonify({"error": "Sensor no encontrado"}), 404
    # Convertir _id a string y demás ajustes
    sensor["_id"] = str(sensor["_id"])
    # También recuperar las asignaciones de este sensor
    assignments = list(mongo.db.asignaciones.find({"idSensor": sensor["_id"]}))
    for a in assignments:
        a["_id"] = str(a["_id"])
    sensor["assignments"] = assignments
    return jsonify(sensor), 200

@sensor_bp.route('/sensor/<sensor_id>', methods=['PUT'])
def update_sensor_route(sensor_id):
   mongo = current_app.mongo
   return update_sensor(mongo, sensor_id)