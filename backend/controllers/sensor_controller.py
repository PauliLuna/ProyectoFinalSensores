from flask import request, jsonify
from models.sensor import insert_sensor
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

def get_coordinates_from_address(address):
    """
    Convierte una dirección en coordenadas (latitud, longitud) usando Nominatim.
    """
    geolocator = Nominatim(user_agent="sensor_app")
    try:
        location = geolocator.geocode(address)
        if location:
            return location.latitude, location.longitude
        else:
            return None, None
    except GeocoderTimedOut:
        return None, None


def register_sensor(mongo):
    """
    Lee los datos del formulario (por POST),convierte la dirección en coordenadas y los inserta en la base de datos.
    """

     # Construimos la dirección completa
    full_address = f"{request.form.get('direccion')}, {request.form.get('ciudad')}, {request.form.get('provincia')}, {request.form.get('pais')}"

    lat, lon = get_coordinates_from_address(full_address)

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
         "estado": request.form.get('estado'), 
         "latitud": lat,
         "longitud": lon
    }
    # Puedes agregar validaciones aquí según lo necesario
    sensor_id = insert_sensor(mongo, sensor_data)
    return jsonify({"message": "Sensor registrado correctamente", "sensor_id": sensor_id}), 201