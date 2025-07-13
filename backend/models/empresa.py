def insert_empresa(mongo, empresa_data):
    """
    Inserta los datos de un empresa en la colección 'empresas'
    y devuelve el _id insertado.
    """
    empresas_coll = mongo.db.empresas
    result = empresas_coll.insert_one(empresa_data)
    return str(result.inserted_id)

def get_empresa(mongo, idEmpresa):
    """
    Recupera la empresa desde la base de datos usando su ID.
    """
    try:
        empresa = mongo.db.empresas.find_one({"_id": idEmpresa})
        return empresa
    except Exception:
        return None