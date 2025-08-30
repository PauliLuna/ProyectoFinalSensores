from flask import request, jsonify, session
from models.empresa import insert_empresa, get_empresa
from models.codigo_invitacion import updateCondigoInvitacionEmpresa
from bson import ObjectId

def register_empresa_controller(mongo):
    """
    Registra un nuevo empresa en la base de datos.
    Se guardan los datos de la empresa.{{}}
    """
    empresa_data = {
        "codeInvitation": request.form.get('codeInvitation'),
        "companyName": request.form.get('companyName'),
        "cuil": request.form.get('cuil'),
        "address": request.form.get('address'),
        "pais": request.form.get('pais'),
        "provincia": request.form.get('provincia'),
        "ciudad": request.form.get('ciudad'),
        "cp": request.form.get('cp')
    }

    empresa_id = insert_empresa(mongo, empresa_data)
    updateCondigoInvitacionEmpresa(mongo, empresa_id, empresa_data["codeInvitation"])
    return jsonify({"message": "empresa registrado correctamente", "empresa_id": empresa_id}), 201


def get_empresa_nombre_controller(mongo):
    """
    Obtiene el nombre de la empresa utilizando el modelo.
    """
    idEmpresa = session.get('idEmpresa')
    if not idEmpresa:
        return jsonify({"error": "No autorizado"}), 401
    empresa = get_empresa(mongo, ObjectId(idEmpresa))
    if empresa is None:
        return jsonify({"error": "Error al buscar la empresa"}), 500
    if not empresa:
        return jsonify({"error": "Empresa no encontrada"}), 404
    return jsonify({"companyName": empresa.get("companyName", "")}), 200