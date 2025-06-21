from flask import Blueprint, current_app, jsonify, session, request
from controllers.usuario_controller import register_usuario, invite_user, login_usuario, complete_registration, get_ultimas_conexiones
from bson import ObjectId

usuario_bp = Blueprint('usuario_bp', __name__)



@usuario_bp.route('/usuarios', methods=['GET'])
def get_usuarios():
    id_empresa = session.get('idEmpresa')
    if not id_empresa:
        return jsonify([])
    
    # Filtra solo los usuarios con ese idEmpresa
    usuarios = list(current_app.mongo.db.usuarios.find(
        {"idEmpresa": id_empresa},  # filtro por idEmpresa
        {"email": 1}
    ))
    
    # Convertir _id a cadena para que JSON los interprete
    for usuario in usuarios:
        usuario["_id"] = str(usuario["_id"])
    return jsonify(usuarios)

@usuario_bp.route('/ultimas_conexiones', methods=['GET'])
def ultimas_conexiones_route():
    mongo = current_app.mongo
    return get_ultimas_conexiones(mongo)

@usuario_bp.route('/usuario_actual', methods=['GET', 'PUT'])
def usuario_actual_route():
    mongo = current_app.mongo
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "No autorizado"}), 401

    usuario = mongo.db.usuarios.find_one({"_id": ObjectId(user_id)})
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    if request.method == 'GET':
        return jsonify({
            "email": usuario.get("email", ""),
            "username": usuario.get("username", ""),
            "phone": usuario.get("phone", ""),
            "roles": usuario.get("roles", "")
        })
    elif request.method == 'PUT':
        data = request.get_json()
        update_fields = {
            "username": data.get("username", usuario.get("username", "")),
            "phone": data.get("phone", usuario.get("phone", ""))
        }
        if data.get("password"):
            from werkzeug.security import generate_password_hash
            update_fields["password"] = generate_password_hash(data["password"], method='pbkdf2:sha256')
        mongo.db.usuarios.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
        return jsonify({"message": "Perfil actualizado correctamente"})

@usuario_bp.route('/usuario', methods=['POST'])
def register_usuario_route():
    """
    Ruta para registrar un usuario.
    """
    mongo = current_app.mongo
    return register_usuario(mongo)

@usuario_bp.route('/invite_user', methods=['POST'])
def invite_user_route():
    mongo = current_app.mongo
    return invite_user(mongo)

@usuario_bp.route('/complete_registration', methods=['POST'])
def complete_registration_route():
    mongo = current_app.mongo
    return complete_registration(mongo)

@usuario_bp.route('/login', methods=['POST'])
def login_usuario_route():
    mongo = current_app.mongo
    return login_usuario(mongo)

