from bson import ObjectId

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