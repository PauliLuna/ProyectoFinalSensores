from typing import List, Dict

def insert_many_mediciones(mongo, docs: List[Dict]) -> None:
    # Recomendado: crear índice en mediciones: [("idSensor", 1), ("fechaHoraMed", -1)]
    mongo.db.mediciones.create_index([("idSensor", 1), ("fechaHoraMed", -1)]) # Crea el índice si no existe (solo la primera vez)
    mongo.db.mediciones.insert_many(docs)