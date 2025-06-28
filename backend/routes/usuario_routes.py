from flask import Blueprint, current_app, jsonify, session, request, url_for
import secrets, datetime, re
from controllers.usuario_controller import register_usuario, invite_user, login_usuario, complete_registration, get_ultimas_conexiones
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from flask_mail import Message

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
        # Cambiar contraseña solo si se proveen los campos
        if data.get("newPassword"):
            current_password = data.get("currentPassword", "")
            if not check_password_hash(usuario["password"], current_password):
                return jsonify({"error": "La contraseña actual es incorrecta."}), 400
            update_fields["password"] = generate_password_hash(data["newPassword"], method='pbkdf2:sha256')
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

@usuario_bp.route('/solicitar_reset_password', methods=['POST'])
def solicitar_reset_password():
    mongo = current_app.mongo
    data = request.get_json()
    email = data.get('email')
    usuario = mongo.db.usuarios.find_one({"email": email})
    if not usuario:
        return jsonify({"error": "No existe un usuario con ese email"}), 404

    now = datetime.datetime.now(datetime.timezone.utc)
    # Buscar si ya hay un token válido para este email
    token_existente = mongo.db.passwordReset.find_one({
        "email": email,
        "expiresAt": {"$gt": now}
    })
    if token_existente:
        return jsonify({"message": "Ya se envió un correo de recuperación. Por favor, revisa tu casilla antes de solicitar uno nuevo."}), 200

    token = secrets.token_urlsafe(32)
    expires_at = now + datetime.timedelta(minutes=30)
    mongo.db.passwordReset.insert_one({
        "email": email,
        "token": token,
        "expiresAt": expires_at
    })

    # Enviar email
    reset_url = f"https://sensia.onrender.com/password_reset.html?token={token}"
    mail = current_app.mail
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #222; }}
        .container {{ padding: 20px; border: 1px solid #eee; border-radius: 8px; background: #fafafa; }}
        h2 {{ color: #2a7ae2; }}
        .info {{ margin-bottom: 10px; }}
        .label {{ font-weight: bold; }}
        .message {{ margin-top: 15px; padding: 10px; background: #f1f7ff; border-radius: 5px; }}
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Recuperación de contraseña SensIA</h2>
        <div class="info"><span class="label">Para restablecer tu contraseña, haz clic en el siguiente enlace: \n{reset_url}\n Este enlace expirará en 30 minutos.</span></div>
    </div>
    </body>
    </html>
    """.format(reset_url=reset_url)

    msg = Message(
        subject=f"Recuperación de contraseña SensIA",
        sender=current_app.config['MAIL_USERNAME'],
        recipients=[email],
        html=html_template  # Usar HTML aquí
    )
    mail.send(msg)


    return jsonify({"message": "Se ha enviado un correo con instrucciones para restablecer tu contraseña."})


def es_password_fuerte(password):
    return (
        len(password) >= 8 and
        re.search(r'[A-Z]', password) and
        re.search(r'[a-z]', password) and
        re.search(r'[^A-Za-z0-9]', password)
    )

@usuario_bp.route('/reset_password', methods=['POST'])
def reset_password():
    mongo = current_app.mongo
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('newPassword')

      # Validación de contraseña fuerte
    if not es_password_fuerte(new_password):
        return jsonify({"error": "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo."}), 400

    token_doc = mongo.db.passwordReset.find_one({"token": token})
    if not token_doc:
        return jsonify({"error": "Token inválido o expirado"}), 400
    # Usar timezone-aware datetime para la comparación
    expires_at = token_doc['expiresAt']
    if expires_at.tzinfo is None:
        # Si no tiene zona horaria, asígnale UTC
        expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)

    if expires_at < datetime.datetime.now(datetime.timezone.utc):
        return jsonify({"error": "Token expirado"}), 400

    email = token_doc['email']
    hashed = generate_password_hash(new_password, method='pbkdf2:sha256')
    mongo.db.usuarios.update_one({"email": email}, {"$set": {"password": hashed}})
    mongo.db.passwordReset.delete_one({"token": token})

    return jsonify({"message": "Contraseña restablecida correctamente"})

