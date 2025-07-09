from flask import Blueprint, current_app, jsonify, session
from controllers.empresa_controller import register_empresa
from bson import ObjectId, errors
from utils.auth import token_required

empresa_bp = Blueprint('empresa_bp', __name__)

@empresa_bp.route('/empresa', methods=['POST'])
@token_required
def register_empresa_route():
    mongo = current_app.mongo
    return register_empresa(mongo)

@empresa_bp.route('/empresa_nombre', methods=['GET'])
@token_required
def get_empresa_nombre():
    idEmpresa = session.get('idEmpresa')
    if not idEmpresa:
        return jsonify({"error": "No autorizado"}), 401
    try:
        empresa = current_app.mongo.db.empresas.find_one({"_id": ObjectId(idEmpresa)})
    except (errors.InvalidId, TypeError):
        return jsonify({"error": "ID de empresa inválido"}), 400
    if not empresa:
        return jsonify({"error": "Empresa no encontrada"}), 404
    return jsonify({"companyName": empresa.get("companyName", "")})