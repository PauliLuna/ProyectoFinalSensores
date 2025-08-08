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

def create_alerta_routes(mongo):
    alerta_bp = Blueprint('alertas', __name__)

    @alerta_bp.route('/alertas', methods=['GET'])
    def get_alertas():
        return obtener_alertas(mongo)

    @alerta_bp.route('/alertas', methods=['POST'])
    def post_alerta():
        return nueva_alerta(mongo)

    @alerta_bp.route('/alertas/<alerta_id>/cerrar', methods=['PUT'])
    def put_cerrar_alerta(alerta_id):
        return cerrar_alerta_api(mongo, alerta_id)
    
    @alerta_bp.route('/reanalizar_alertas', methods=['POST'])
    def reanalizar_alertas_api():
        user_id = session.get('user_id')
        usuario = get_usuario_by_id(mongo, user_id)
        id_empresa = usuario.get('idEmpresa')
        chequear_alertas_criticas(mongo, id_empresa)
        chequear_alertas_preventivas(mongo, id_empresa)
        chequear_alertas_informativas(mongo, id_empresa)
        return jsonify({"message": "Alertas reanalizadas"}), 200

    return alerta_bp
