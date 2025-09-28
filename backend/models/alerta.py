from pymongo import DESCENDING

def get_alertas_filtradas(mongo, id_empresa, tipo=None):
    filtro = {"idEmpresa": id_empresa}
    if tipo:
        filtro["tipoAlerta"] = tipo
    return list(mongo.db.alertas.find(filtro).sort("fechaHoraAlerta", -1))

def insert_alerta(mongo, alerta_data):
    return mongo.db.alertas.insert_one(alerta_data).inserted_id


def get_alerta_caida_energia_abierta(mongo, id_empresa, direccion):
    """
    Devuelve la última alerta de caída de energía que esté Pendiente
    """
    filtro = {
        "idEmpresa": id_empresa,
        "tipoAlerta": "Caída de energía eléctrica",
        "direccion": direccion,
        "estadoAlerta": "abierta"
    }
    return mongo.db.alertas.find_one(filtro, sort=[("fechaHoraAlerta", -1)])

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

def q_alerta_abierta_temp(mongo, nro_sensor, id_empresa):
    filtro = {
        "idSensor": str(nro_sensor),
        "tipoAlerta": "Temperatura fuera de rango",
        "idEmpresa": str(id_empresa),
        "estadoAlerta": "abierta",
        "$or": [
            {"duracionMinutos": None},
            {"duracionMinutos": {"$exists": False}}
        ]
    }
    return mongo.db.alertas.find_one(filtro, sort=[('fechaHoraAlerta', DESCENDING)])

def updateDuracion(mongo, alerta_id, duracion):
    mongo.db.alertas.update_one(
        {"_id": alerta_id},
        {"$set": {
            "duracionMinutos": duracion,
            "estadoAlerta": "cerrada"
        }}
    )

def q_alerta_abierta_offline(mongo, nro_sensor, id_empresa):
    filtro = {
        "idSensor": str(nro_sensor),
        "tipoAlerta": "Sensor offline",
        "idEmpresa": str(id_empresa),
        "estadoAlerta": "abierta",
        "$or": [
            {"duracionMinutos": None},
            {"duracionMinutos": {"$exists": False}}
        ]
    }
    return mongo.db.alertas.find_one(filtro, sort=[('fechaHoraAlerta', DESCENDING)])

def get_checkpoint(mongo, id_empresa, nro_sensor, tipo_alerta):
    return mongo.db.alerta_checkpoint.find_one({
        "idEmpresa": id_empresa,
        "idSensor": nro_sensor,
        "tipo": tipo_alerta
    })

def update_checkpoint(mongo, id_empresa, nro_sensor, tipo_alerta, fecha_ultima_analizada):
    mongo.db.alerta_checkpoint.update_one(
        {"idEmpresa": id_empresa, "idSensor": nro_sensor, "tipo": tipo_alerta},
        {"$set": {"fechaUltimaAnalizada": fecha_ultima_analizada}},
        upsert=True
    )

def update_checkpoint_informativas(mongo, id_empresa, nro_sensor, fecha_ultima_analizada, en_ciclo, fecha_inicio_ciclo, temp_max_ciclo):
    mongo.db.alerta_checkpoint.update_one(
            {"idEmpresa": id_empresa, "idSensor": nro_sensor, "tipo": "informativas"},
            {"$set": {
                "fechaUltimaAnalizada": fecha_ultima_analizada,
                "enCiclo": en_ciclo,
                "fechaInicioCiclo": fecha_inicio_ciclo,
                "tempMaxCiclo": temp_max_ciclo
            }},
            upsert=True
        )

def get_alertas_sensor(mongo, id_empresa, sensor_id):
    return list(mongo.db.alertas.find({
        "idEmpresa": id_empresa,
        "idSensor": {"$in": [sensor_id]}
    }).sort("fechaHoraAlerta", -1))

def update_description_offline(mongo, alerta_id, descripcion):
    mongo.db.alertas.update_one(
        {"_id": alerta_id},
        {"$set": {
            "descripcion": descripcion
        }}
    )