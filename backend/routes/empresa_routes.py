from flask import Blueprint, current_app, jsonify
from controllers.empresa_controller import register_empresa

empresa_bp = Blueprint('empresa_bp', __name__)

@empresa_bp.route('/empresa', methods=['POST'])
def register_empresa_route():
    mongo = current_app.mongo
    return register_empresa(mongo)