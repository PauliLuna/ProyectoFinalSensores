from flask import Blueprint, current_app, jsonify, session, request, url_for
import secrets, datetime, re, random, string
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
    email = request.form.get('mail')
    idEmpresa = session.get('idEmpresa')
    if not idEmpresa:
        return jsonify({"error": "No autorizado"}), 401

    # 1. Generar código alfanumérico de 8 caracteres
    codigo = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    now = datetime.datetime.now()
    fecha_expiracion = now + datetime.timedelta(hours=24)

    # 2. Guardar en codigoInvitacion
    mongo.db.codigoInvitacion.insert_one({
        "codigo": codigo,
        "mailUsuario": email,
        "fechaGenerado": now,
        "fechaExpiracion": fecha_expiracion,
        "tipoInvitacion": "Usuario",
        "idEmpresa": idEmpresa,
        "fechaUsado": None
    })

    # 3. Crear usuario en estado "Invitado"
    mongo.db.usuarios.insert_one({
        "email": email,
        "idEmpresa": idEmpresa,
        "estado": "Invitado",
        "roles": "usuario"
    })

    # 4. Enviar mail con el código
    mail = current_app.mail
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #333; }}
        .container {{ padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9; max-width: 600px; margin: auto; }}
        h2 {{ color: #2a7ae2; }}
        .info {{ margin-bottom: 10px; }}
        .label {{ font-weight: bold; }}
        .message {{ margin-top: 15px; padding: 12px; background-color: #e8f0fe; border-left: 5px solid #2a7ae2; border-radius: 4px; }}
        a {{ color: #2a7ae2; text-decoration: none; }}
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Fuiste invitado a unirte a la plataforma SensIA</h2>

        <p>Tu empresa te ha invitado a registrarte como usuario en SensIA, la plataforma de monitoreo inteligente de cámaras de frío.</p>

        <div class="info">
        <span class="label">Correo invitado:</span> {email}
        </div>

        <div class="info">
        <span class="label">Código de invitación:</span> <span style="color: #2a7ae2; font-weight: bold;">{codigo}</span>
        </div>

        <div class="message">
        ⚠️ Este código de invitación es válido por <strong>24 horas</strong> desde su emisión.  
        Usalo lo antes posible para activar tu cuenta.
        </div>

        <p><strong>Para completar tu registro:</strong></p>
        <ol>
        <li>Accedé al formulario de alta de usuario: <a href="https://sensia.onrender.com/login_usuario.html">https://sensia.onrender.com/login_usuario.html</a></li>
        <li>Ingresá tu correo, el código de invitación y tu nueva contraseña.</li>
        <li>Listo, ya vas a poder acceder a la plataforma con tu cuenta.</li>
        </ol>

        <p>Ante cualquier duda, podés responder a este correo o escribirnos a  
        <a href="mailto:sensiaproyecto@gmail.com">sensiaproyecto@gmail.com</a>.</p>

        <p>Bienvenido/a a <strong>SensIA</strong> 👋  
        <br>🌐 <a href="https://sensia.onrender.com/">https://sensia.onrender.com/</a></p>
    </div>
    </body>
    </html>
    """
    msg = Message(
        subject="Invitación a SensIA",
        sender=current_app.config['MAIL_USERNAME'],
        recipients=[email],
        html=html_template
    )
    try:
        mail.send(msg)
    except Exception as e:
        return jsonify({"error": f"Error al enviar el correo: {str(e)}"}), 500

    return jsonify({"message": f"Se mandó un correo de invitación a {email}"}), 200

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
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #333; }}
        .container {{ padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #fafafa; max-width: 600px; margin: auto; }}
        h2 {{ color: #2a7ae2; }}
        .info {{ margin: 15px 0; }}
        .button {{
        display: inline-block;
        background-color: #2a7ae2;
        color: white;
        padding: 10px 16px;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
        }}
        .message {{ margin-top: 15px; padding: 10px; background-color: #fff3cd; border-left: 5px solid #ffc107; border-radius: 4px; }}
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Recuperación de contraseña en SensIA</h2>

        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>SensIA</strong>.</p>

        <p>Hacé clic en el siguiente botón para crear una nueva contraseña:</p>

        <div class="info">
        <a href="{reset_url}"
        style="display:inline-block; background-color:#2a7ae2; color:white; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:bold; font-family:Arial, sans-serif; font-size:15px;">
        Restablecer contraseña
        </a>
        </div>

        <p class="message">⚠️ Este enlace es válido por <strong>30 minutos</strong>.  
        Si no solicitaste el cambio, podés ignorar este mensaje.</p>

        <p>¿Tenés problemas con el botón? Copiá y pegá esta URL en tu navegador:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>

        <p>Gracias por usar <strong>SensIA</strong>.</p>

        <p>🌐 <a href="https://sensia.onrender.com">https://sensia.onrender.com</a><br>
        📩 <a href="mailto:sensiaproyecto@gmail.com">sensiaproyecto@gmail.com</a></p>
    </div>
    </body>
    </html>
    """
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
    validate_only = data.get('validateOnly', False)

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
    
    if validate_only:
        return jsonify({"message": "Token válido"}), 200
    
      # Sólo validar si la contraseña es fuerte si se está intentando cambiarla
    if not es_password_fuerte(new_password):
        return jsonify({"error": "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo."}), 400

    email = token_doc['email']
    hashed = generate_password_hash(new_password, method='pbkdf2:sha256')
    mongo.db.usuarios.update_one({"email": email}, {"$set": {"password": hashed}})
    mongo.db.passwordReset.delete_one({"token": token})

    return jsonify({"message": "Contraseña restablecida correctamente"})

