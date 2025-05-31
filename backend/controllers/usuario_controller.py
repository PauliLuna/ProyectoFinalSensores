from flask import request, jsonify
from models.usuario import insert_usuario

def register_usuario(mongo):
    """
    Lee los datos del formulario (por POST) y los inserta en la base de datos.
    """
    usuario_data = {
        "idCode": request.form.get('idCode'),
        "email": request.form.get('email'),
        "phone": request.form.get('phone'),
        "username": request.form.get('username'),
        "password": request.form.get('password')
        # Aquí podrías agregar validaciones y/o encriptar la contraseña
    }
    # Llama a la función del modelo para insertar los datos
    user_id = insert_usuario(mongo, usuario_data)
    return jsonify({"message": "Usuario registrado correctamente", "user_email": usuario_data.get("email")}), 201