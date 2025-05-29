from flask import Blueprint, request, jsonify, current_app
from models.contacto import save_contacto
from controllers.contacto_controller import enviar_mail_contacto

contacto_bp = Blueprint('contacto', __name__)

@contacto_bp.route('/contacto', methods=['POST'])
def submit_form():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not name or not email or not message:
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    try:
        # Guardar en la base de datos
        save_contacto(current_app.mongo, name, email, message)
        # Enviar correo
        enviar_mail_contacto(current_app.mail, current_app, name, email, message)
        return jsonify({'success': 'Correo enviado correctamente'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500