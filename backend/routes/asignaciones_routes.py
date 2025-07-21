from flask import Blueprint, current_app
from controllers.asignaciones_controller import get_asignaciones_empresa
from utils.auth import token_required

asignaciones_bp = Blueprint('asignaciones_bp', __name__)

@asignaciones_bp.route('/asignaciones_empresa', methods=['GET'])
@token_required
def get_asignaciones_empresa_route():
    mongo = current_app.mongo
    return get_asignaciones_empresa(mongo)