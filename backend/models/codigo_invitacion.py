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
        return {"valido": False, "motivo": "no se encontró ningún código para este mail"}

    # Validaciones
    if ultimo_codigo["codigo"] != codigo_ingresado:
        return {"valido": False, "motivo": "el código es incorrecto"}
    
    # PRIMERO: si ya fue usado
    if "fechaUsado" in ultimo_codigo and ultimo_codigo["fechaUsado"] is not None:
        return {"valido": False, "motivo": "el código ya fue usado"}
    
    # LUEGO: si está vencido
    if "fechaExpiracion" in ultimo_codigo and datetime.now() > ultimo_codigo["fechaExpiracion"]:
        return {"valido": False, "motivo": "el código ha vencido"}

    return {"valido": True, "motivo": "Código válido"}

def marcar_codigo_usado(mongo, mailUsuario, codigo_ingresado):
    collection = mongo.db.codigoInvitacion
    collection.update_one(
        {"mailUsuario": mailUsuario, "codigo": codigo_ingresado},
        {"$set": {"fechaUsado": datetime.now()}}
    )

def updateCondigoInvitacionEmpresa(mongo, idmpresa, codInvitacion):
    """
    Actualiza el campo idEmpresa en el código de invitación utilizado.
    """
    collection = mongo.db.codigoInvitacion
    result = collection.update_one(
        {"codigo": codInvitacion},
        {"$set": {"idEmpresa": idmpresa}}
    )
    return result.modified_count > 0