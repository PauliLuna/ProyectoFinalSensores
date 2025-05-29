def save_contacto(mongo, name, email, message):
    contacto = {
        "name": name,
        "email": email,
        "message": message
    }
    mongo.db.contactos.insert_one(contacto)