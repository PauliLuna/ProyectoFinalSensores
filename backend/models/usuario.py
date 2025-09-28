from bson import ObjectId

def insert_usuario(mongo, usuario_data):
    usuarios_coll = mongo.db.usuarios
    result = usuarios_coll.insert_one(usuario_data)
    return str(result.inserted_id)


def get_usuario_by_email(mongo, email):
    return mongo.db.usuarios.find_one({"email": email})


def get_usuarios_by_empresa(mongo, id_empresa):
    usuarios = list(mongo.db.usuarios.find(
        {"idEmpresa": id_empresa, "roles": "usuario"},
        {"email": 1}
    ))
    for usuario in usuarios:
        usuario["_id"] = str(usuario["_id"])
    return usuarios

def get_usuario_by_id(mongo, user_id):
    return mongo.db.usuarios.find_one({"_id": ObjectId(user_id)})

def update_usuario(mongo, user_id, update_fields):
    mongo.db.usuarios.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields}
    )

def update_usuario_email(mongo, email, update_fields):
    mongo.db.usuarios.update_one(
        {"email": email},
        {"$set": update_fields}
    )

def usuario_existente(mongo, email, id_empresa):
    return mongo.db.usuarios.find_one({"email": email, "idEmpresa": id_empresa})

def insert_codigo_invitacion(mongo, codigo_data):
    mongo.db.codigoInvitacion.insert_one(codigo_data)

def insert_usuario_invitado(mongo, usuario_data):
    mongo.db.usuarios.insert_one(usuario_data)

def get_password_reset_token(mongo, email, now):
    return mongo.db.passwordReset.find_one({
        "email": email,
        "expiresAt": {"$gt": now}
    })

def insert_password_reset(mongo, email, token, expires_at):
    mongo.db.passwordReset.insert_one({
        "email": email,
        "token": token,
        "expiresAt": expires_at
    })

def get_password_reset_by_token(mongo, token):
    return mongo.db.passwordReset.find_one({"token": token})

def update_usuario_password(mongo, email, hashed):
    mongo.db.usuarios.update_one({"email": email}, {"$set": {"password": hashed}})

def delete_password_reset(mongo, token):
    mongo.db.passwordReset.delete_one({"token": token})

def get_ultimas_conexiones(mongo, id_empresa):
    usuarios = list(
        mongo.db.usuarios.find(
            {"idEmpresa": id_empresa},
            {"username": 1, "email": 1, "fechaUltimoAcceso": 1, "estado": 1}
        ).sort("fechaUltimoAcceso", -1).limit(10)
    )
    return usuarios

def get_super_admins_by_criticidad(mongo, id_empresa, criticidad):
    # Se construye la clave de la preferencia dinámicamente
    crit_key_normalized = criticidad.lower().replace("í", "i").replace("á", "a")
    crit_key = "notificacionesAlertas." + crit_key_normalized
    
    # Se realiza la consulta
    usuarios = list(mongo.db.usuarios.find({
        "idEmpresa": id_empresa,
        "roles": "superAdmin",
        "estado": "Active",
        crit_key: True
    }, {
        "email": 1,
        "_id": 0 # No necesitamos el _id
    }))

    # Extraemos solo el email de cada objeto (esto produce una lista de strings)
    emails = [user["email"] for user in usuarios if "email" in user]
    
    return emails