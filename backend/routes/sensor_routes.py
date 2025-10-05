from flask import Blueprint, current_app, jsonify, request
from controllers.sensor_controller import register_sensor, update_sensor, get_all_sensors, get_all_sensors_user, get_sensor, get_mediciones, procesar_sensor, obtener_ultima_medicion, obtener_cantidad_aperturas, get_duracion_ultima_apertura, analizar_mediciones
from utils.auth import token_required

sensor_bp = Blueprint('sensor_bp', __name__)

@sensor_bp.route('/sensores', methods=['GET'])
@token_required
def get_all_sensors_route():
    mongo = current_app.mongo
    sensores = get_all_sensors(mongo)
    return jsonify(sensores)

@sensor_bp.route('/sensoresUser', methods=['GET'])
@token_required
def get_all_sensors_user_route():
    mongo = current_app.mongo
    sensores = get_all_sensors_user(mongo)
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

@sensor_bp.route('/sensor/<int:sensor_id>/puerta', methods=['GET'])
@token_required
def get_estado_puerta(sensor_id):
    mongo = current_app.mongo
    data = procesar_sensor(mongo, sensor_id)
    return jsonify(data)

@sensor_bp.route('/sensor/<int:sensor_id>/ultima', methods=['GET'])
@token_required
def get_ultima_medicion_route(sensor_id):
    mongo = current_app.mongo
    try:
        data = obtener_ultima_medicion(mongo, sensor_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if data:
        return jsonify(data)
    else:
        return jsonify({"error": "No se encontraron mediciones"}), 404
    
@sensor_bp.route('/sensor/<int:sensor_id>/aperturas', methods=['GET'])
@token_required
def get_aperturas_route(sensor_id):
    mongo = current_app.mongo
    try:
        cantidad = obtener_cantidad_aperturas(mongo, sensor_id)
        return jsonify({"cantidadAperturas": cantidad})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    
@sensor_bp.route('/sensor/<int:sensor_id>/puerta/duracion', methods=['GET'])
@token_required
def get_duracion_apertura_route(sensor_id):
    mongo = current_app.mongo
    data = get_duracion_ultima_apertura(mongo, sensor_id)
    return jsonify(data)

@sensor_bp.route('/sensor/<int:sensor_id>/analisis', methods=['POST'])
@token_required
def analizar_sensor(sensor_id):
    data = request.get_json()
    mediciones = data.get("mediciones", [])
    notas = data.get("notas", "")

    if mediciones == []:
        return jsonify({'error': 'No se enviaron mediciones'}), 400

    try:
        resultado = analizar_mediciones(sensor_id, mediciones, notas)
        return jsonify(resultado)
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500