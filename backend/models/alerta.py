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


def get_alertas_caida_de_energia(mongo, id_empresa, direccion):
    """
    Devuelve todas las alertas del tipo caida de energia de una empresa
    """
    filtro = {
        "idEmpresa": id_empresa,
        "tipoAlerta": "Caída de energía eléctrica",
        "direccion": direccion
    }
    return list(mongo.db.alertas.find_one(filtro))

def get_alertas_puerta_abierta(mongo, nro_sensor, id_empresa, hoy_inicio):
    """
    Devuelve todas las alertas del tipo puerta abierta de una empresa
    """
    filtro = {
        "idSensor": str(nro_sensor),
        "idEmpresa": id_empresa,
        "tipoAlerta": "Puerta abierta prolongada",
        "fechaHoraAlerta": {"$gte": hoy_inicio}
    }
    return mongo.db.alertas.count_documents(filtro)

