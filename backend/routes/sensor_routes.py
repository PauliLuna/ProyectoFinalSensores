from flask import Blueprint, current_app, jsonify, request
from controllers.sensor_controller import register_sensor, update_sensor, get_all_sensors, get_sensor
from bson import ObjectId
import datetime

sensor_bp = Blueprint('sensor_bp', __name__)

@sensor_bp.route('/sensores', methods=['GET'])
def get_all_sensors_route():
    mongo = current_app.mongo
    sensores = get_all_sensors(mongo)
    return jsonify(sensores)

@sensor_bp.route('/mediciones', methods=['GET'])
def get_mediciones_route():
    mongo = current_app.mongo
    sensor_id = request.args.get('sensor_id')
    desde = request.args.get('desde')
    hasta = request.args.get('hasta')

    if not sensor_id or not desde or not hasta:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        nro_sensor = int(sensor_id)
        fecha_desde = datetime.datetime.fromisoformat(desde)
        fecha_hasta = datetime.datetime.fromisoformat(hasta)
    except Exception as e:
        return jsonify({"error": "Parámetros inválidos"}), 400

    mediciones = list(mongo.db.mediciones.find({
        "idSensor": nro_sensor,
        "fechaHoraMed": {"$gte": fecha_desde, "$lte": fecha_hasta}
    }).sort("fechaHoraMed", 1))

    # Serializar fechas y devolver solo lo necesario
    result = []
    for m in mediciones:
        result.append({
            "fechaHoraMed": m["fechaHoraMed"].isoformat(),
            "valorTempInt": m.get("valorTempInt"),
            "valorTempExt": m.get("valorTempExt")
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
def get_sensor_route(sensor_id):
    mongo = current_app.mongo
    return get_sensor(mongo, sensor_id)

@sensor_bp.route('/sensor/<sensor_id>', methods=['PUT'])
def update_sensor_route(sensor_id):
   mongo = current_app.mongo
   return update_sensor(mongo, sensor_id)