from flask import Blueprint, request, session, current_app, jsonify
from controllers.usuario_controller import get_usuario_by_id
from controllers.alerta_controller import (
    obtener_alertas, 
    nueva_alerta, 
    chequear_alertas_criticas,
    chequear_alertas_preventivas,
    chequear_alertas_informativas,
    obtener_alertas_por_sensor
)

from utils.auth import token_required


alerta_bp = Blueprint('alertas', __name__)

@alerta_bp.route('/alertas', methods=['GET'])
@token_required
def get_alertas():
    mongo = current_app.mongo
    sensor_id = request.args.get('sensor_id')
    if sensor_id:
        return obtener_alertas_por_sensor(mongo, sensor_id)
    else:
        return obtener_alertas(mongo)

@alerta_bp.route('/alertas', methods=['POST'])
@token_required
def post_alerta():
    mongo = current_app.mongo
    return nueva_alerta(mongo)


@alerta_bp.route('/reanalizar_alertas', methods=['POST'])
@token_required
def reanalizar_alertas_api():
    mongo = current_app.mongo
    user_id = session.get('user_id')
    usuario = get_usuario_by_id(mongo, user_id)
    id_empresa = usuario.get('idEmpresa')
    nuevas_criticas = chequear_alertas_criticas(mongo, id_empresa)
    nuevas_preventivas = chequear_alertas_preventivas(mongo, id_empresa)
    nuevas_informativas = chequear_alertas_informativas(mongo, id_empresa)
    total_nuevas = (nuevas_criticas or 0) + (nuevas_preventivas or 0) + (nuevas_informativas or 0)
    if total_nuevas == 0:
        return jsonify({"message": "Alertas reanalizadas correctamente. No se detectaron nuevas alertas."}), 200
    else:
        return jsonify({"message": f"Alertas reanalizadas correctamente. Se detectaron {total_nuevas} nuevas alertas."}), 200


