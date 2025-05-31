from flask import Blueprint, current_app
from controllers.usuario_controller import register_usuario

usuario_bp = Blueprint('usuario_bp', __name__)

@usuario_bp.route('/usuario', methods=['POST'])
def register_usuario_route():
    """
    Ruta para registrar un usuario.
    """
    mongo = current_app.mongo
    return register_usuario(mongo)