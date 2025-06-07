import datetime
from flask import request, jsonify
from models.empresa import insert_empresa

def register_empresa(mongo):
    """
    Registra un nuevo empresa en la base de datos.
    Se guardan los datos de la empresa.
    """
    now = datetime.datetime.now()
    fechaAlta = now.strftime("%d/%m/%Y")
    # Por el empresa, generalmente la fecha de alta se registra solo en la parte de usuario,
    # pero puedes agregarla si es necesario en este caso.
    
    empresa_data = {
        "idCode": request.form.get('idCode'),
        "companyName": request.form.get('companyName'),
        "cuil": request.form.get('cuil'),
        "address": request.form.get('address'),
        "pais": request.form.get('pais'),
        "provincia": request.form.get('provincia'),
        "ciudad": request.form.get('ciudad'),
        "cp": request.form.get('cp')
        # Agrega otros campos propios de la empresa si los necesitas
    }
    empresa_id = insert_empresa(mongo, empresa_data)
    return jsonify({"message": "empresa registrado correctamente", "empresa_id": empresa_id}), 201