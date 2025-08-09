from flask import Blueprint, session, current_app, jsonify
from controllers.usuario_controller import get_usuario_by_id
from controllers.alerta_controller import (
    obtener_alertas, 
    nueva_alerta, 
    cerrar_alerta_api,
    chequear_alertas_criticas,
    chequear_alertas_preventivas,
    chequear_alertas_informativas
)

from utils.auth import token_required


alerta_bp = Blueprint('alertas', __name__)

@alerta_bp.route('/alertas', methods=['GET'])
@token_required
def get_alertas():
    mongo = current_app.mongo
    return obtener_alertas(mongo)

@alerta_bp.route('/alertas', methods=['POST'])
@token_required
def post_alerta():
    mongo = current_app.mongo
    return nueva_alerta(mongo)

@alerta_bp.route('/alertas/<alerta_id>/cerrar', methods=['PUT'])
@token_required
def put_cerrar_alerta(alerta_id):
    mongo = current_app.mongo
    return cerrar_alerta_api(mongo, alerta_id)

@alerta_bp.route('/reanalizar_alertas', methods=['POST'])
@token_required
def reanalizar_alertas_api():
    mongo = current_app.mongo
    user_id = session.get('user_id')
    usuario = get_usuario_by_id(mongo, user_id)
    id_empresa = usuario.get('idEmpresa')
    chequear_alertas_criticas(mongo, id_empresa)
    chequear_alertas_preventivas(mongo, id_empresa)
    chequear_alertas_informativas(mongo, id_empresa)
    return jsonify({"message": "Alertas reanalizadas"}), 200


