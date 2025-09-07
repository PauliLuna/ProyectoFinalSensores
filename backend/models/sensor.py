from bson import ObjectId
import datetime

def get_next_sequence(mongo, name):
    """
    Obtiene el siguiente valor de secuencia para un nombre dado usando una colección 'counters'.
    Si no existe, la crea y comienza en 1.
    """
    counters = mongo.db.counters
    ret = counters.find_one_and_update(
        {'_id': name},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=True  # Devuelve el documento actualizado
    )
    return ret['seq']

def insert_sensor(mongo, sensor_data):
    """
    Inserta la data del sensor en la colección 'sensors'
    y devuelve el _id insertado.
    """
    sensor_data['nroSensorIncremental'] = get_next_sequence(mongo, 'sensorid')
    sensors_coll = mongo.db.sensors
    result = sensors_coll.insert_one(sensor_data)
    return str(result.inserted_id)

def get_sensor_with_assignments(mongo, sensor_id):
    sensor = mongo.db.sensors.find_one({"nroSensor": int(sensor_id)})
    if not sensor:
        return None
    # Serializar ObjectId en el sensor
    if '_id' in sensor:
        sensor['_id'] = str(sensor['_id'])
    # Recuperar las asignaciones de este sensor
    assignments = list(mongo.db.asignaciones.find({"idSensor": sensor["nroSensor"]}))
    # Obtener todos los idUsuario únicos
    user_ids = [a["idUsuario"] for a in assignments]
    # Busca los usuarios por _id
    usuarios = list(mongo.db.usuarios.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}))
    id_to_email = {str(u["_id"]): u["email"] for u in usuarios}

    # Serializar ObjectId en cada asignación
    for assignment in assignments:
        assignment["email"] = id_to_email.get(assignment["idUsuario"], assignment["idUsuario"])
        if '_id' in assignment:
            assignment['_id'] = str(assignment['_id'])
    sensor["assignments"] = assignments
    return sensor

def get_mediciones_model(mongo, nro_sensor, fecha_desde, fecha_hasta):
    """
    Devuelve una lista de mediciones para un sensor y rango de fechas.
    """
    mediciones = list(mongo.db.mediciones.find({
        "idSensor": nro_sensor,
        "fechaHoraMed": {"$gte": fecha_desde, "$lte": fecha_hasta}
    }).sort("fechaHoraMed", 1))
    return mediciones

def get_last_change_door(mediciones):
    if not mediciones:
        return None

    estado_actual = mediciones[-1]['puerta']
    for i in range(len(mediciones) - 2, -1, -1):
        if mediciones[i]['puerta'] != estado_actual:
            return mediciones[i + 1]['fechaHoraMed']
    return None


def obtain_current_state_duration(mediciones):
    """
    Devuelve la cantidad de tiempo (timedelta) que la puerta lleva en su estado actual.
    """
    fecha_cambio = get_last_change_door(mediciones)
    print(fecha_cambio)
    if fecha_cambio:
        return datetime.datetime.utcnow() - fecha_cambio
    return None

def get_ultima_medicion(mongo, nro_sensor):
    return mongo.db.mediciones.find_one(
        {"idSensor": nro_sensor},
        sort=[("fechaHoraMed", -1)]
    )

def count_aperturas(mongo, nro_sensor):
    mediciones = list(mongo.db.mediciones.find(
        {"idSensor": nro_sensor, "puerta": {"$in": [0, 1]}},
        sort=[("fechaHoraMed", 1)]
    ))

    if not mediciones:
        return 0

    aperturas = 0
    estado_anterior = mediciones[0]['puerta']
    
    for m in mediciones[1:]:
        estado_actual = m['puerta']
        if estado_actual != estado_anterior and estado_actual == 1:  # se abrió
            aperturas += 1
        estado_anterior = estado_actual

    return aperturas

def get_last_open_duration(mediciones):
    """
    Devuelve la duración de la última apertura completa (de 1 -> 0)
    """
    if not mediciones or len(mediciones) < 2:
        return None

    # Recorre desde la última medición hacia atrás buscando un cambio 1 -> 0
    for i in range(len(mediciones) - 2, -1, -1):
        if mediciones[i]['puerta'] == 1 and mediciones[i + 1]['puerta'] == 0:
            return mediciones[i + 1]['fechaHoraMed'] - mediciones[i]['fechaHoraMed']
    return None

def get_mediciones(mongo, nro_sensor, last_date=None):
    """
    Obtiene las mediciones de un sensor específico.
        nro_sensor: El número del sensor para el cual se obtienen las mediciones.
        last_date: (Opcional) Un objeto datetime para obtener mediciones
                   posteriores a esa fecha.
    """
    filtro = {"idSensor": nro_sensor}
    if last_date:
        filtro["fechaHoraMed"] = {"$gt": last_date}

    # ordenadas por fecha de forma ascendente.
    mediciones = list(mongo.db.mediciones.find(filtro).sort("fechaHoraMed", 1))

    return mediciones

def updateStatus(mongo, nroSensor, id_empresa, estado):
    mongo.db.sensors.update_one(
        {"nroSensor": nroSensor, "idEmpresa": id_empresa},
        {"$set": {"estado": estado}}
    )