from flask import request, jsonify, session, current_app
from models.usuario import *
from werkzeug.security import generate_password_hash, check_password_hash
import datetime, secrets, random, string, re, jwt, os
from controllers.alerta_controller import _alerta_acceso_nocturno, _alerta_bloqueo_cuenta
from models.codigo_invitacion import marcar_codigo_usado
import pytz

SECRET_KEY_TOKEN = os.getenv("SECRET_KEY_TOKEN")


def get_usuarios_controller(mongo):
    id_empresa = session.get('idEmpresa')
    if not id_empresa:
        return jsonify([])
    usuarios = get_usuarios_by_empresa(mongo, id_empresa)
    return jsonify(usuarios)

# Nueva función para obtener todos los usuarios para HOME (sin filtrar por estado)
def get_all_users_controller(mongo):
    id_empresa = session.get('idEmpresa')
    if not id_empresa:
        return jsonify([])
    usuarios = get_all_users_by_empresa(mongo, id_empresa)
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
            "email": usuario.get("email", "").strip().lower(),
            "username": usuario.get("username", ""),
            "phone": usuario.get("phone", ""),
            "roles": usuario.get("roles", ""),
            "notificacionesAlertas": usuario.get("notificacionesAlertas") #Delete by default fields
        })
    elif request.method == 'PUT':
        data = request.get_json()
        update_fields = {
            "username": data.get("username", usuario.get("username", "")),
            "phone": data.get("phone", usuario.get("phone", "")),
            "notificacionesAlertas": data.get("notificacionesAlertas", usuario.get("notificacionesAlertas")) #Delete by default fields
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
        "email": request.form.get('email').strip().lower(),
        "idEmpresa": idEmpresa,
        "phone": request.form.get('phone'),
        "username": request.form.get('username'),
        "password": generate_password_hash(request.form.get('password'), method='pbkdf2:sha256'),
        "fechaAlta": now,
        "fechaUltimoAcceso": now,
        "estado": "Active",
        "roles": "superAdmin",
        "notificacionesAlertas": {
            "critica": True,
            "informativa": True,
            "preventiva": True,
            "seguridad": True # superAdmin recibe todas las alertas
        }
    }
    insert_usuario(mongo, usuario_data)
    return jsonify({"message": "Usuario registrado correctamente", "user_email": usuario_data.get("email")}), 201

def invite_user_controller(mongo):
    email = request.form.get('mail').strip().lower()
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
        .image-footer {{ text-align: center; margin-top: 20px; }} /* Estilo para centrar la imagen */
        .image-footer img {{ width: 200px; height: 200px; display: block; margin: 0 auto; }} /* Asegura que la imagen sea responsiva y centrada */
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

        <!-- Imagen agregada aquí -->
        <div class="image-footer">
            <img src="https://sensia.onrender.com/assets/termi-transparente.png" alt="Bienvenido a SensIA">
        </div>
    </div>
    </body>
    </html>
    """
    # Obtener el cliente de la API de Mailjet de la configuración de la app
    mailjet = current_app.config['MAILJET_CLIENT']
    
    # Obtener el email del remitente de la configuración de la app
    sender_email = current_app.config['MAIL_FROM_EMAIL']

    # Crear la carga útil (payload) para la API
    data = {
        'Messages': [
            {
                "From": {
                    "Email": sender_email,
                    "Name": "SensIA"
                },
                "To": [
                    {
                        "Email": email,
                        "Name": "Destinatario"
                    }
                ],
                "Subject": "Invitación a SensIA",
                "HTMLPart": html_template
            }
        ]
    }

    try:
        # Enviar el correo usando la API de Mailjet
        result = mailjet.send.create(data=data)
        
        # Verificar si la respuesta fue exitosa
        if result.status_code == 200:
            return jsonify({"message": f"Se envió un correo de invitación a {email}"}), 200
        else:
            return jsonify({"error": f"Error al enviar el correo: {result.json()}"}), 500
    except Exception as e:
        # Captura cualquier excepción de red o de la librería
        return jsonify({"error": f"Error de conexión: {str(e)}"}), 500


#Login_usuario
def complete_registration_controller(mongo):
    email = request.form.get('email').strip().lower()
    usuario = get_usuario_by_email(mongo, email)
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404
    username = request.form.get('username')
    phone = request.form.get('phone')
    password = request.form.get('password')
    codigo = request.form.get('codigo')  # <-- Asegurate de recibir el código
    now = datetime.datetime.now()

     # ✅ Validar tipo de invitación antes de continuar
    if codigo:
        ultimo_codigo = mongo.db.codigoInvitacion.find_one(
            {"mailUsuario": email, "codigo": codigo}
        )

        if not ultimo_codigo or ultimo_codigo.get("tipoInvitacion") != "Usuario":
            return jsonify({"error": "Código inválido para registro de usuario"}), 400
        
    update_fields = {
        "username": username,
        "phone": phone,
        "password": generate_password_hash(password, method='pbkdf2:sha256'),
        "estado": "Active",
        "fechaAlta": now,
        "fechaUltimoAcceso": now,
        "notificacionesAlertas": {
            "critica": True,
            "informativa": True,
            "preventiva": True,
            "seguridad": False # Usuario común no recibe alertas de seguridad por defecto
        }
    }
    update_usuario_email(mongo, email, update_fields) # Porque ya está invitado, se busca por email
    
    # SOLO AHORA marcar el código de invitación como usado
    if codigo:
        marcar_codigo_usado(mongo, email, codigo)
    
    return jsonify({
        "message": "Registro completado correctamente",
        "user_email": email
    }), 200

def login_usuario_controller(mongo):
    email = request.form.get('email').strip().lower()
    password = request.form.get('password')
    usuario = get_usuario_by_email(mongo, email)

    # --- Verificación de estado del usuario ---
    estado = usuario.get("estado", "").lower()
    if estado == "inactive":
        return jsonify({"error": "Usuario bloqueado. Contacte al administrador."}), 403
    elif estado == "invitado":
        return jsonify({"error": "Usuario invitado. Debe realizar la activación de su cuenta."}), 403
    elif estado != "active":
        return jsonify({"error": f"Estado de usuario inválido: {estado}"}), 403

    now = datetime.datetime.utcnow()

    # --- ALERTA DE INICIO DE SESIÓN NOCTURNO ---
    # Si la hora UTC-3 (Argentina) está entre 22 y 6, genera alerta y manda mail
    hora_local_dt = now - datetime.timedelta(hours=3) # Obtiene el objeto datetime local
    
    # Extrae solo la hora para la condición de nocturnidad
    hora_solo = hora_local_dt.hour
    if 0 <= hora_solo < 6 or hora_solo >= 22:
        
        # ALERTA DE ACCESO NOCTURNO
        _alerta_acceso_nocturno(mongo, email,hora_local_dt, usuario)

    if usuario:
        # Verifica si está bloqueado
        lock_until = usuario.get('lockUntil')
        if lock_until and lock_until > now:
            return jsonify({"error": "Usuario bloqueado por intentos fallidos. Intenta nuevamente 30 minutos más tarde."}), 403

        # Si lockUntil ya pasó, resetea loginAttempts y lockUntil
        if lock_until and lock_until <= now:
            mongo.db.usuarios.update_one(
                {"_id": usuario["_id"]},
                {"$set": {"loginAttempts": 0, "lockUntil": None}}
            )
            usuario['loginAttempts'] = 0
            usuario['lockUntil'] = None

        # Verifica la contraseña
        if check_password_hash(usuario['password'], password):
            # Login exitoso: resetea intentos y lock
            session['user_id'] = str(usuario['_id'])
            session['idEmpresa'] = usuario.get('idEmpresa')
            mongo.db.usuarios.update_one(
                {"_id": usuario['_id']},
                {"$set": {"fechaUltimoAcceso": datetime.datetime.now(),"loginAttempts": 0, "lockUntil": None}}
            )

            payload = {
                "user_id": str(usuario['_id']),
                "idEmpresa": usuario.get('idEmpresa'),
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1), # Sesion de una hora
                "entity_type": usuario['roles'] # *** CLAVE DE DIFERENCIACIÓN ***
            }
            token = jwt.encode(payload, SECRET_KEY_TOKEN, algorithm="HS256")
            return jsonify({"message": "Login exitoso", "token": token}), 200
        else:
            # Suma intento fallido
            attempts = usuario.get('loginAttempts', 0) + 1
            update = {"loginAttempts": attempts}
            if attempts >= 3:
                update["lockUntil"] = now + datetime.timedelta(minutes=30)
                
                # ALERTA DE BLOQUEO DE USUARIO
                _alerta_bloqueo_cuenta(mongo, email, usuario)
                
            mongo.db.usuarios.update_one(
                {"_id": usuario["_id"]},
                {"$set": update}
            )
    
            if attempts >= 3:
                return jsonify({"error": "Usuario bloqueado por intentos fallidos. Intenta nuevamente en 30 minutos."}), 403
            else:
                return jsonify({"error": "Credenciales inválidas"}), 401
    else:
        return jsonify({"error": "Credenciales inválidas"}), 401

def get_ultimas_conexiones_controller(mongo):
    idEmpresa = session.get('idEmpresa')
    if not idEmpresa:
        return jsonify({"error": "No autorizado"}), 401
    usuarios = get_ultimas_conexiones(mongo, idEmpresa)
    
    # Definimos la zona horaria UTC y la zona de Argentina.
    zona_utc = pytz.timezone('UTC')
    zona_argentina = pytz.timezone('America/Argentina/Buenos_Aires')
    for u in usuarios:
        u["_id"] = str(u["_id"])
        fecha_utc = u.get("fechaUltimoAcceso")
        if fecha_utc:
            fecha_utc_con_zona = zona_utc.localize(fecha_utc)
            fecha_argentina = fecha_utc_con_zona.astimezone(zona_argentina)
            u["fechaUltimoAcceso"] = fecha_argentina.strftime("%d/%m/%Y %H:%M")
    return jsonify(usuarios)

def solicitar_reset_password_controller(mongo):
    data = request.get_json()
    email = data.get('email').strip().lower()
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
    subject = "Recuperación de contraseña en SensIA"
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
    # Obtener el cliente de la API de Mailjet de la configuración de la app
    mailjet = current_app.config['MAILJET_CLIENT']
    
    # Obtener el email del remitente de la configuración de la app
    sender_email = current_app.config['MAIL_FROM_EMAIL']

    # Crear la carga útil (payload) para la API
    data = {
        'Messages': [
            {
                "From": {
                    "Email": sender_email,
                    "Name": "SensIA"
                },
                "To": [
                    {
                        "Email": email,
                        "Name": "Destinatario"
                    }
                ],
                "Subject": subject,
                "HTMLPart": html_template
            }
        ]
    }

    try:
        # Enviar el correo usando la API de Mailjet
        result = mailjet.send.create(data=data)
        
        # Verificar si la respuesta fue exitosa
        if result.status_code == 200:
            print(email)
            return jsonify({"message": f"Se envió un correo de alerta a {email}"}), 200
        else:
            return jsonify({"error": f"Error al enviar el correo: {result.json()}"}), 500
    except Exception as e:
        # Captura cualquier excepción de red o de la librería
        return jsonify({"error": f"Error de conexión: {str(e)}"}), 500

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
    email = token_doc['email']
    hashed = generate_password_hash(new_password, method='pbkdf2:sha256')
    update_usuario_password(mongo, email, hashed)
    delete_password_reset(mongo, token)
    return jsonify({"message": "Contraseña restablecida correctamente"})

#Invite_user
def update_usuario_estado_controller(mongo, user_id):
    data = request.get_json()
    nuevo_estado = data.get('estado')
    if nuevo_estado not in ['Active', 'Inactive']:
        return jsonify({"error": "Estado inválido"}), 400
    update_usuario(mongo, user_id, {"estado": nuevo_estado})
    return jsonify({"message": f"Estado actualizado a {nuevo_estado}"}), 200

def delete_usuario_controller(mongo, user_id):
    from bson import ObjectId
    result = mongo.db.usuarios.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count:
        return jsonify({"message": "Usuario eliminado correctamente"}), 200
    else:
        return jsonify({"error": "No se pudo eliminar el usuario"}), 400