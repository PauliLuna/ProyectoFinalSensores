from flask import Blueprint, current_app
from controllers.sensor_controller import register_sensor

sensor_bp = Blueprint('sensor_bp', __name__)

@sensor_bp.route('/sensor', methods=['POST'])
def register_sensor_route():
    """
    Ruta para registrar un sensor; utiliza el controlador.
    """
    # Obtenemos la instancia de PyMongo almacenada en current_app.config
    mongo = current_app.mongo
    return register_sensor(mongo)