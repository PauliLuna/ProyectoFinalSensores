from flask import jsonify, request, session
from models.alerta import get_alertas_by_empresa, get_alertas_filtradas, insert_alerta, cerrar_alerta
from bson import ObjectId


def obtener_alertas(mongo):
    id_empresa = session.get("idEmpresa")  # Asegúrate que el login guarda esto en la sesión
    if not id_empresa:
        return jsonify({"error": "Empresa no encontrada"}), 401

    tipo = request.args.get("tipoAlerta")
    alertas = get_alertas_filtradas(mongo, id_empresa, tipo)
    for alerta in alertas:
        alerta["_id"] = str(alerta["_id"])
    return jsonify(alertas), 200

def nueva_alerta(mongo):
    data = request.get_json()
    data["idEmpresa"] = session.get("idEmpresa")
    data["estadoAlerta"] = "Activa"
    alerta_id = insert_alerta(mongo, data)
    return jsonify({"message": "Alerta creada", "id": str(alerta_id)}), 201

def cerrar_alerta_api(mongo, alerta_id):
    result = cerrar_alerta(mongo, alerta_id)
    if result.modified_count == 0:
        return jsonify({"message": "No se encontró la alerta"}), 404
    return jsonify({"message": "Alerta cerrada"}), 200
