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
    sensors_coll = mongo.db.sensors  # se asume que la colección se llama sensors
    result = sensors_coll.insert_one(sensor_data)
    return str(result.inserted_id)