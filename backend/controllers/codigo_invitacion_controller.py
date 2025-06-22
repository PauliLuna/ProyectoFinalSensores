from flask import request, jsonify
from models.codigo_invitacion import verificar_codigo_invitacion

def verificar_codigo_controller(mongo):
    data = request.json
    mailUsuario = data.get("mailUsuario")
    codigo = data.get("codigo")

    if not mailUsuario or not codigo:
        return jsonify({"valido": False, "motivo": "Faltan datos"}), 400

    resultado = verificar_codigo_invitacion(mongo, mailUsuario, codigo)

    return jsonify(resultado), 200
