def insert_assignment(mongo, assignment_data):
    """
    Inserta los datos de una asignación en la colección 'asignaciones'
    y devuelve el _id insertado.
    """
    asignaciones_coll = mongo.db.asignaciones  # se asume que la colección se llama 'assignments'
    result = asignaciones_coll.insert_one(assignment_data)
    return str(result.inserted_id)