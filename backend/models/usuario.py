def insert_usuario(mongo, usuario_data):
    """
    Inserta los datos de un usuario en la colección 'usuarios'
    y devuelve el _id insertado.
    """
    usuarios_coll = mongo.db.usuarios  # se asume que la colección se llama 'usuarios'
    result = usuarios_coll.insert_one(usuario_data)
    return str(result.inserted_id)