from flask import Blueprint, current_app
from controllers.codigo_invitacion_controller import verificar_codigo_controller

codigo_bp = Blueprint('codigo_bp', __name__)

# usuarios.js
@codigo_bp.route('/verificar-codigo', methods=['POST'])
def verificar_codigo_route():
    mongo = current_app.mongo
    return verificar_codigo_controller(mongo)
