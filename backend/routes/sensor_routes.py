from flask import Blueprint, current_app, jsonify
from controllers.sensor_controller import register_sensor, update_sensor, get_all_sensors

sensor_bp = Blueprint('sensor_bp', __name__)

@sensor_bp.route('/sensores', methods=['GET'])
def get_all_sensors_route():
    mongo = current_app.mongo
    sensores = get_all_sensors(mongo)
    return jsonify(sensores)

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
    try:
        sensor = mongo.db.sensors.find_one({"nroSensor": int(sensor_id)})
        if not sensor:
            return jsonify({"error": "Sensor no encontrado"}), 404
        # También recuperar las asignaciones de este sensor
        assignments = list(mongo.db.asignaciones.find({"idSensor": sensor["nroSensor"]}))
        sensor["assignments"] = assignments
        return jsonify(sensor), 200
    except Exception as e:
        print(f"Error en get_sensor: {e}")
        return jsonify({"error": str(e)}), 500

@sensor_bp.route('/sensor/<sensor_id>', methods=['PUT'])
def update_sensor_route(sensor_id):
   mongo = current_app.mongo
   return update_sensor(mongo, sensor_id)