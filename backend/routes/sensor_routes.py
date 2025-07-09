from flask import Blueprint, current_app, jsonify, request
from controllers.sensor_controller import register_sensor, update_sensor, get_all_sensors, get_sensor, get_mediciones
from utils.auth import token_required

sensor_bp = Blueprint('sensor_bp', __name__)

@sensor_bp.route('/sensores', methods=['GET'])
@token_required
def get_all_sensors_route():
    mongo = current_app.mongo
    sensores = get_all_sensors(mongo)
    return jsonify(sensores)

@sensor_bp.route('/mediciones', methods=['GET'])
@token_required
def get_mediciones_route():
    mongo = current_app.mongo
    sensor_id = request.args.get('sensor_id')
    desde = request.args.get('desde')
    hasta = request.args.get('hasta')
    return get_mediciones(mongo, sensor_id, desde, hasta)

@sensor_bp.route('/sensor', methods=['POST'])
@token_required
def register_sensor_route():
    mongo = current_app.mongo
    return register_sensor(mongo)

@sensor_bp.route('/sensor/<sensor_id>', methods=['GET'])
@token_required
def get_sensor_route(sensor_id):
    mongo = current_app.mongo
    return get_sensor(mongo, sensor_id)

@sensor_bp.route('/sensor/<sensor_id>', methods=['PUT'])
@token_required
def update_sensor_route(sensor_id):
   mongo = current_app.mongo
   return update_sensor(mongo, sensor_id)