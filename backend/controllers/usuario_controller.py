from flask import request, jsonify, session
from models.usuario import insert_usuario, get_usuario_by_email
from werkzeug.security import generate_password_hash, check_password_hash
import datetime
from models.codigo_invitacion import verificar_codigo_invitacion


def register_usuario(mongo):
    """
    Lee los datos del formulario (por POST) y los inserta en la base de datos.
    Se incluyen los campos extras:
      - fechaAlta (dd/mm/aaaa)
      - fechaUltimoAcceso (dd/mm/aaaa hh:mm:ss)
      - estado ("Active")
      - roles (["superAdmin"])
    """
    idEmpresa = request.form.get('idEmpresa')  # <-- Tomá el idEmpresa del form
    if idEmpresa and not isinstance(idEmpresa, str):
        idEmpresa = str(idEmpresa)

    now = datetime.datetime.now()
    fechaAlta = now 
    fechaUltimoAcceso = now
    usuario_data = {

        "codeInvitation": request.form.get('codeInvitation'),
        "email": request.form.get('email'),
        "idEmpresa": idEmpresa,  # string, no ObjectId
        "phone": request.form.get('phone'),
        "username": request.form.get('username'),
        "password": generate_password_hash(request.form.get('password'), method='pbkdf2:sha256'),  # ← encriptado
        #"password": request.form.get('password'),  # ← NO encriptado
        "fechaAlta": fechaAlta,
        "fechaUltimoAcceso": fechaUltimoAcceso,
        "estado": "Active",
        "roles": "superAdmin"
    }
    # Llama a la función del modelo para insertar los datos
    print("Datos de usuario a insertar:", usuario_data)  # Agregado para debugging
    user_id = insert_usuario(mongo, usuario_data)
    return jsonify({"message": "Usuario registrado correctamente", "user_email": usuario_data.get("email")}), 201

def invite_user(mongo):
    """
    Invita a un usuario: crea un usuario con email y lo asocia a la empresa logueada.
    """
    email = request.form.get('mail')
    idEmpresa = session.get('idEmpresa')  # O como lo tengas en la sesión
    if idEmpresa and not isinstance(idEmpresa, str):
        idEmpresa = str(idEmpresa)

    now = datetime.datetime.now()
    fechaAlta = now 
    fechaUltimoAcceso = now 
    usuario_data = {
        "email": email,
        "idEmpresa": idEmpresa,  # string, no ObjectId
        "estado": "Invited",
        "roles": "user"
    }
    user_id = insert_usuario(mongo, usuario_data)
    return jsonify({"message": "Usuario invitado correctamente", "user_id": user_id}), 201

def complete_registration(mongo):
    email = request.form.get('email')
    username = request.form.get('username')
    phone = request.form.get('phone')
    password = request.form.get('password')
    codigo = request.form.get('codigo')

    # 1. Verificar código de invitación
    resultado = verificar_codigo_invitacion(mongo, email, codigo)
    if not resultado.get("valido"):
        return jsonify({"error": resultado.get("motivo", "Código inválido")}), 400

    # 2. Buscar el usuario invitado por email
    usuario = get_usuario_by_email(mongo, email)
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404
    
    # 3. Actualizar los datos del usuario
    now = datetime.datetime.now()
    update_fields = {
        "username": username,
        "phone": phone,
        "password": generate_password_hash(password, method='pbkdf2:sha256'),
        "estado": "Active",
        "fechaAlta": now,
        "fechaUltimoAcceso": now
    }

    mongo.db.usuarios.update_one(
        {"email": email},
        {"$set": update_fields}
    )

    return jsonify({
    "message": "Registro completado correctamente",
    "user_email": email
    }), 200

def login_usuario(mongo):
    email = request.form.get('email')
    password = request.form.get('password')
    usuario = get_usuario_by_email(mongo, email)
    if usuario and check_password_hash(usuario['password'], password):
    #if usuario and usuario['password'] == password:  # ← NO encriptado, solo para pruebas
        session['user_id'] = str(usuario['_id'])
        session['idEmpresa'] = usuario.get('idEmpresa')  # Guarda el idEmpresa en la sesión
         # Actualizar fechaUltimoAcceso
        mongo.db.usuarios.update_one(
            {"_id": usuario['_id']},
            {"$set": {"fechaUltimoAcceso": datetime.datetime.now()}}
        )
        return jsonify({"message": "Login exitoso"}), 200
    else:
        return jsonify({"error": "Credenciales inválidas"}), 401
    

def get_ultimas_conexiones(mongo):
    idEmpresa = session.get('idEmpresa')
    if not idEmpresa:
        return jsonify({"error": "No autorizado"}), 401

    usuarios = list(
        mongo.db.usuarios.find(
            {"idEmpresa": idEmpresa},
            {"username": 1, "email": 1, "fechaUltimoAcceso": 1, "estado": 1}
        ).sort("fechaUltimoAcceso", -1).limit(10)
    )

    # Convertir _id y fecha a string para el frontend:
    for u in usuarios:
        u["_id"] = str(u["_id"])
        fecha = u.get("fechaUltimoAcceso")
        if fecha:
            u["fechaUltimoAcceso"] = fecha.strftime("%d/%m/%Y %H:%M")
    return jsonify(usuarios)