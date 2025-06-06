import datetime
from models.asignaciones import insert_assignment
from bson import ObjectId

def register_assignment(mongo, sensor_id, idUsuario, permiso="Read"):
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
    now = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    assignment_data = {
         "idSensor": sensor_id,
         "idUsuario": idUsuario,
         "fechaAsignacion": now,
         "fechaModificacion": now,
         "modoNotificacion": "mail",
         "estadoAlerta": True,
         "estadoAsignacion": "Activo",
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
    now = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
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