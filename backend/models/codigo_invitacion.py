from datetime import datetime

def verificar_codigo_invitacion(mongo, mailUsuario, codigo_ingresado):
    """
    Verifica que el código ingresado coincida con el último generado para ese mailUsuario,
    que esté vigente y que no haya sido usado aún.
    """
    collection = mongo.db.codigoInvitacion

    # Buscar el último código para ese mailUsuario, ordenado por fecha de creación (más reciente primero)
    ultimo_codigo = collection.find_one(
        {"mailUsuario": mailUsuario},
        sort=[("fechaGenerado", -1)]
    )

    if not ultimo_codigo:
        return {"valido": False, "motivo": "No se encontró ningún código para este mail"}

    # Validaciones
    if ultimo_codigo["codigo"] != codigo_ingresado:
        return {"valido": False, "motivo": "Código incorrecto"}

    if "fechaExpiracion" in ultimo_codigo and datetime.now() > ultimo_codigo["fechaExpiracion"]:
        return {"valido": False, "motivo": "El código ha vencido"}

    if "fechaUsado" in ultimo_codigo and ultimo_codigo["fechaUsado"] is not None:
        return {"valido": False, "motivo": "El código ya fue usado"}

    # Si pasa todas las validaciones, actualizar el campo fechaUsado
    collection.update_one(
        {"_id": ultimo_codigo["_id"]},
        {"$set": {"fechaUsado": datetime.now()}}
    )

    return {"valido": True, "motivo": "Código válido"}
