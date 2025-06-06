from flask import Blueprint, current_app, jsonify
from controllers.usuario_controller import register_usuario

usuario_bp = Blueprint('usuario_bp', __name__)

@usuario_bp.route('/usuario', methods=['POST'])
def register_usuario_route():
    """
    Ruta para registrar un usuario.
    """
    mongo = current_app.mongo
    return register_usuario(mongo)

@usuario_bp.route('/usuarios', methods=['GET'])
def get_usuarios():
    # Se obtienen todos los usuarios, pero se filtran solo el _id y el email
    usuarios = list(current_app.mongo.db.usuarios.find({}, {"email": 1}))
    # Convertir _id a cadena para que JSON los interprete
    for usuario in usuarios:
        usuario["_id"] = str(usuario["_id"])
    return jsonify(usuarios)