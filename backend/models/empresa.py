def insert_empresa(mongo, empresa_data):
    """
    Inserta los datos de un empresa en la colección 'empresas'
    y devuelve el _id insertado.
    """
    empresas_coll = mongo.db.empresas
    result = empresas_coll.insert_one(empresa_data)
    return str(result.inserted_id)