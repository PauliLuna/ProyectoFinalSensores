from flask import Blueprint, current_app
from controllers.empresa_controller import register_empresa_controller, get_empresa_nombre_controller
from utils.auth import token_required

empresa_bp = Blueprint('empresa_bp', __name__)

@empresa_bp.route('/empresa', methods=['POST'])
@token_required
def register_empresa_route():
    mongo = current_app.mongo
    return register_empresa_controller(mongo)

@empresa_bp.route('/empresa_nombre', methods=['GET'])
@token_required
def get_empresa_nombre():
    mongo = current_app.mongo
    return get_empresa_nombre_controller(mongo)