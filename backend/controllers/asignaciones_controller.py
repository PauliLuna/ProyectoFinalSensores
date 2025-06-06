import datetime
from models.asignaciones import insert_assignment

def register_assignment(mongo, sensor_id, idUsuario, permiso="Read"):
    """
    Inserta una asignación para relacionar un sensor y un usuario.
    Los datos incluyen:
       - idSensor: Identificador del sensor
       - idUsuario: Identificador del usuario (o email, si aun no tienes un id)
       - fechaAsignacion: Fecha y hora en el formato dd/mm/aaaa HH:mm:ss
       - fechaModificacion: Igual al valor inicial; se actualizará cuando se edite
       - modoNotificacion: 'mail' por defecto
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
         "permiso": permiso
    }
    assignment_id = insert_assignment(mongo, assignment_data)
    return assignment_id