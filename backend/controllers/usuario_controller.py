from flask import request, jsonify, session
from models.usuario import insert_usuario, get_usuario_by_email
from werkzeug.security import generate_password_hash, check_password_hash
import datetime


def register_usuario(mongo):
    """
    Lee los datos del formulario (por POST) y los inserta en la base de datos.
    Se incluyen los campos extras:
      - fechaAlta (dd/mm/aaaa)
      - fechaUltimoAcceso (dd/mm/aaaa hh:mm:ss)
      - estado ("Active")
      - roles (["superAdmin"])
    """

    now = datetime.datetime.now()
    fechaAlta = now.strftime("%d/%m/%Y")
    fechaUltimoAcceso = now.strftime("%d/%m/%Y %H:%M:%S")
    usuario_data = {

        "idCode": request.form.get('idCode'),
        "email": request.form.get('email'),
        "phone": request.form.get('phone'),
        "username": request.form.get('username'),
        #"password": generate_password_hash(request.form.get('password')),  # ← encriptado
        "password": request.form.get('password'),  # ← NO encriptado
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

    now = datetime.datetime.now()
    fechaAlta = now.strftime("%d/%m/%Y")
    fechaUltimoAcceso = now.strftime("%d/%m/%Y %H:%M:%S")

    usuario_data = {
        "email": email,
        "idEmpresa": idEmpresa,  # string, no ObjectId
        "fechaAlta": fechaAlta,
        "fechaUltimoAcceso": fechaUltimoAcceso,
        "estado": "Invited",
        "roles": "user"
    }
    user_id = insert_usuario(mongo, usuario_data)
    return jsonify({"message": "Usuario invitado correctamente", "user_id": user_id}), 201

def login_usuario(mongo):
    email = request.form.get('email')
    password = request.form.get('password')
    usuario = get_usuario_by_email(mongo, email)
    #if usuario and check_password_hash(usuario['password'], password):
    if usuario and usuario['password'] == password:  # ← NO encriptado, solo para pruebas
        session['user_id'] = str(usuario['_id'])
        session['idEmpresa'] = usuario.get('idEmpresa')  # Guarda el idEmpresa en la sesión
        # Podés guardar otros datos si querés
        return jsonify({"message": "Login exitoso"}), 200
    else:
        return jsonify({"error": "Credenciales inválidas"}), 401