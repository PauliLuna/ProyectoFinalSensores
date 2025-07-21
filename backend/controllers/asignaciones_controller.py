import datetime
from models.asignaciones import insert_assignment
from bson import ObjectId
from flask import session, jsonify

def register_assignment(mongo, sensor_id, idUsuario, permiso="Read", estadoAsignacion=None):
    """
    Inserta una asignación para relacionar un sensor y un usuario.
    Los datos incluyen:
       - idSensor: Identificador del sensor
       - idUsuario: Identificador del usuario (o email, si aun no tienes un id)
       - fechaAsignacion: Fecha y hora en el formato dd/mm/aaaa HH:mm:ss
       - fechaModificacion: Igual al valor inicial; se actualizará cuando se edite
       - modoNotificacion: 'mail' por defecto
       - estadoAsignacion: "Activo" por defecto
       - estadoAlerta: True por defecto
       - permiso: "Edit" o "Read" (por defecto "Read")
    """
    now = datetime.datetime.now()
    assignment_data = {
         "idSensor": sensor_id,
         "idUsuario": idUsuario,
         "fechaAsignacion": now,
         "fechaModificacion": now,
         "modoNotificacion": "mail",
         "estadoAlerta": True,
         "estadoAsignacion": estadoAsignacion,
         "permiso": permiso
    }
    assignment_id = insert_assignment(mongo, assignment_data)
    return assignment_id

def update_assignment(mongo, assignment_id, permiso=None, estadoAsignacion=None):
    """
    Actualiza la asignación identificada por assignment_id.
    Solo se modifica "fechaModificacion" (y opcionalmente "permiso" y "estadoAsignacion"),
    dejando intacta "fechaAsignacion", "modoNotificacion" y otros campos que no se actualizan.
    """
    now = datetime.datetime.now()
    update_fields = {"fechaModificacion": now}
    if permiso is not None:
        update_fields["permiso"] = permiso
    if estadoAsignacion is not None:
        update_fields["estadoAsignacion"] = estadoAsignacion

    result = mongo.db.asignaciones.update_one(
        {"_id": ObjectId(assignment_id)},
        {"$set": update_fields}
    )
    return result.modified_count

def get_asignaciones_empresa(mongo):
    id_empresa = session.get('idEmpresa')
    if not id_empresa:
        return jsonify([])

    # Buscar sensores de la empresa
    sensores = list(mongo.db.sensors.find({"idEmpresa": id_empresa}))
    ids_sensores = [s["nroSensor"] for s in sensores]

    # Buscar asignaciones de esos sensores
    asignaciones = list(mongo.db.asignaciones.find({"idSensor": {"$in": ids_sensores}}))
    # Opcional: convertir ObjectId a str si es necesario
    for a in asignaciones:
        a["_id"] = str(a["_id"])
    return jsonify(asignaciones)