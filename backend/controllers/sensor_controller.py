from flask import request, jsonify
from models.sensor import insert_sensor

def register_sensor(mongo):
    """
    Lee los datos del formulario (por POST) y los inserta en la base de datos.
    """
    sensor_data = {
         "nroSensor": request.form.get('nroSensor'),
         "alias": request.form.get('alias'),
         "valorMin": request.form.get('valorMin'),
         "valorMax": request.form.get('valorMax'),
         "direccion": request.form.get('direccion'),
         "pais": request.form.get('pais'),
         "provincia": request.form.get('provincia'),
         "ciudad": request.form.get('ciudad'),
         "cp": request.form.get('cp'),
         "estado": request.form.get('estado')
    }
    # Puedes agregar validaciones aquí según lo necesario
    sensor_id = insert_sensor(mongo, sensor_data)
    return jsonify({"message": "Sensor registrado correctamente", "sensor_id": sensor_id}), 201