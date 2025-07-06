from flask import Blueprint
from controllers.alerta_controller import obtener_alertas, nueva_alerta, cerrar_alerta_api

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

    return alerta_bp
