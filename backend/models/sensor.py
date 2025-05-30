def insert_sensor(mongo, sensor_data):
    """
    Inserta la data del sensor en la colección 'sensors'
    y devuelve el _id insertado.
    """
    sensors_coll = mongo.db.sensors  # se asume que la colección se llama sensors
    result = sensors_coll.insert_one(sensor_data)
    return str(result.inserted_id)