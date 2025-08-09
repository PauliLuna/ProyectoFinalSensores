from bson import ObjectId
from datetime import datetime
from flask_mail import Message, current_app

def get_alertas_by_empresa(mongo, id_empresa, tipo=None):
    """
    Devuelve todas las alertas activas de una empresa
    """
    filtro = {"idEmpresa": id_empresa}
    if tipo:
        filtro["tipoAlerta"] = tipo
    return list(mongo.db.alertas.find(filtro))

def get_alertas_filtradas(mongo, id_empresa, tipo=None):
    filtro = {"idEmpresa": id_empresa}
    if tipo:
        filtro["tipoAlerta"] = tipo
    return list(mongo.db.alertas.find(filtro))

def insert_alerta(mongo, alerta_data):
    return mongo.db.alertas.insert_one(alerta_data).inserted_id


