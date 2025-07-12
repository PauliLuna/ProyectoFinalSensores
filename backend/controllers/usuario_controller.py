from flask import request, jsonify, session, current_app
from models.usuario import *
from werkzeug.security import generate_password_hash, check_password_hash
from models.codigo_invitacion import verificar_codigo_invitacion
from flask_mail import Message
import datetime, secrets, random, string, re, jwt, os

SECRET_KEY_TOKEN = os.getenv("SECRET_KEY_TOKEN")

def get_usuarios_controller(mongo):
    id_empresa = session.get('idEmpresa')
    if not id_empresa:
        return jsonify([])
    usuarios = get_usuarios_by_empresa(mongo, id_empresa)
    return jsonify(usuarios)

def usuario_actual_controller(mongo):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "No autorizado"}), 401
    usuario = get_usuario_by_id(mongo, user_id)
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
        if data.get("newPassword"):
            current_password = data.get("currentPassword", "")
            if not check_password_hash(usuario["password"], current_password):
                return jsonify({"error": "La contraseña actual es incorrecta."}), 400
            update_fields["password"] = generate_password_hash(data["newPassword"], method='pbkdf2:sha256')
        update_usuario(mongo, user_id, update_fields)
        return jsonify({"message": "Perfil actualizado correctamente"})

def register_usuario_controller(mongo):
    idEmpresa = request.form.get('idEmpresa')
    if idEmpresa and not isinstance(idEmpresa, str):
        idEmpresa = str(idEmpresa)
    now = datetime.datetime.now()
    usuario_data = {
        "codeInvitation": request.form.get('codeInvitation'),
        "email": request.form.get('email'),
        "idEmpresa": idEmpresa,
        "phone": request.form.get('phone'),
        "username": request.form.get('username'),
        "password": generate_password_hash(request.form.get('password'), method='pbkdf2:sha256'),
        "fechaAlta": now,
        "fechaUltimoAcceso": now,
        "estado": "Active",
        "roles": "superAdmin"
    }
    user_id = insert_usuario(mongo, usuario_data)
    return jsonify({"message": "Usuario registrado correctamente", "user_email": usuario_data.get("email")}), 201

def invite_user_controller(mongo):
    email = request.form.get('mail')
    idEmpresa = session.get('idEmpresa')
    if not idEmpresa:
        return jsonify({"error": "No autorizado"}), 401
    if usuario_existente(mongo, email, idEmpresa):
        return jsonify({"error": "El usuario ya fue invitado y/o registrado para esta empresa."}), 400
    codigo = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    now = datetime.datetime.now()
    fecha_expiracion = now + datetime.timedelta(hours=24)
    insert_codigo_invitacion(mongo, {
        "codigo": codigo,
        "mailUsuario": email,
        "fechaGenerado": now,
        "fechaExpiracion": fecha_expiracion,
        "tipoInvitacion": "Usuario",
        "idEmpresa": idEmpresa,
        "fechaUsado": None
    })
    insert_usuario_invitado(mongo, {
        "email": email,
        "idEmpresa": idEmpresa,
        "estado": "Invitado",
        "roles": "usuario"
    })
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

def complete_registration_controller(mongo):
    email = request.form.get('email')
    username = request.form.get('username')
    phone = request.form.get('phone')
    password = request.form.get('password')
    codigo = request.form.get('codigo')
    resultado = verificar_codigo_invitacion(mongo, email, codigo)
    if not resultado.get("valido"):
        return jsonify({"error": resultado.get("motivo", "Código inválido")}), 400
    usuario = get_usuario_by_email(mongo, email)
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404
    now = datetime.datetime.now()
    update_fields = {
        "username": username,
        "phone": phone,
        "password": generate_password_hash(password, method='pbkdf2:sha256'),
        "estado": "Active",
        "fechaAlta": now,
        "fechaUltimoAcceso": now
    }
    mongo.db.usuarios.update_one({"email": email}, {"$set": update_fields})
    return jsonify({
        "message": "Registro completado correctamente",
        "user_email": email
    }), 200

def login_usuario_controller(mongo):
    email = request.form.get('email')
    password = request.form.get('password')
    usuario = get_usuario_by_email(mongo, email)
    if usuario and check_password_hash(usuario['password'], password):
        session['user_id'] = str(usuario['_id'])
        session['idEmpresa'] = usuario.get('idEmpresa')
        mongo.db.usuarios.update_one(
            {"_id": usuario['_id']},
            {"$set": {"fechaUltimoAcceso": datetime.datetime.now()}}
        )
        payload = {
            "user_id": str(usuario['_id']),
            "idEmpresa": usuario.get('idEmpresa'),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1) # Sesion de una hora
        }
        token = jwt.encode(payload, SECRET_KEY_TOKEN, algorithm="HS256")
        return jsonify({"message": "Login exitoso", "token": token}), 200
    else:
        return jsonify({"error": "Credenciales inválidas"}), 401 

def get_ultimas_conexiones_controller(mongo):
    idEmpresa = session.get('idEmpresa')
    if not idEmpresa:
        return jsonify({"error": "No autorizado"}), 401
    usuarios = get_ultimas_conexiones(mongo, idEmpresa)
    return jsonify(usuarios)

def solicitar_reset_password_controller(mongo):
    data = request.get_json()
    email = data.get('email')
    usuario = get_usuario_by_email(mongo, email)
    if not usuario:
        return jsonify({"error": "No existe un usuario con ese email"}), 404
    now = datetime.datetime.now(datetime.timezone.utc)
    token_existente = get_password_reset_token(mongo, email, now)
    if token_existente:
        return jsonify({"message": "Ya se envió un correo de recuperación. Por favor, revisa tu casilla antes de solicitar uno nuevo."}), 200
    token = secrets.token_urlsafe(32)
    expires_at = now + datetime.timedelta(minutes=30)
    insert_password_reset(mongo, email, token, expires_at)
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
        html=html_template
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

def reset_password_controller(mongo):
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('newPassword')
    validate_only = data.get('validateOnly', False)
    token_doc = get_password_reset_by_token(mongo, token)
    if not token_doc:
        return jsonify({"error": "Token inválido o expirado"}), 400
    expires_at = token_doc['expiresAt']
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
    if expires_at < datetime.datetime.now(datetime.timezone.utc):
        return jsonify({"error": "Token expirado"}), 400
    if validate_only:
        return jsonify({"message": "Token válido"}), 200
    if not es_password_fuerte(new_password):
        return jsonify({"error": "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo."}), 400
    email = token_doc['email']
    hashed = generate_password_hash(new_password, method='pbkdf2:sha256')
    update_usuario_password(mongo, email, hashed)
    delete_password_reset(mongo, token)
    return jsonify({"message": "Contraseña restablecida correctamente"})