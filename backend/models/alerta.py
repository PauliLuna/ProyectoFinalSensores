from bson import ObjectId
from datetime import datetime

def get_alertas_by_empresa(mongo, id_empresa, tipo=None):
    """
    Devuelve todas las alertas activas de una empresa
    """
    filtro = {"idEmpresa": id_empresa}
    if tipo:
        filtro["tipoAlerta"] = tipo
    return list(mongo.db.alertas.find(filtro))

def get_alertas_filtradas(mongo, id_usuario, tipo=None):
    filtro = {"idUsuario": id_usuario}
    if tipo:
        filtro["tipoAlerta"] = tipo
    return list(mongo.db.alertas.find(filtro))

def insert_alerta(mongo, alerta_data):
    alerta_data["fechaCreacion"] = datetime.now()
    alerta_data["estadoAlerta"] = "Activa"
    return mongo.db.alertas.insert_one(alerta_data).inserted_id

def cerrar_alerta(mongo, alerta_id):
    return mongo.db.alertas.update_one(
        {"_id": ObjectId(alerta_id)},
        {"$set": {"estadoAlerta": "Cerrada", "fechaCierre": datetime.now()}}
    )
