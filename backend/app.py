from flask import Flask, request, jsonify, send_from_directory
from flask_mail import Mail, Message

from dotenv import load_dotenv
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')


# Configuración de la carpeta estática
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

load_dotenv()

# Configuración de Flask-Mail
app.config['MAIL_SERVER'] = 'smtp.gmail.com'  # Servidor SMTP de Gmail
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')  # Correo personal
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
mail = Mail(app)


# Ruta para enviar el formulario de contacto
@app.route('/submit', methods=['POST'])
def submit_form():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not name or not email or not message:
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    # Enviar correo
    try:
        msg = Message(
            subject=f"Nuevo mensaje de {name}",
            sender="no-reply@sensia.com",  # Emisor general
            recipients=[app.config['MAIL_USERNAME']],  # Tu correo personal como destinatario
            body=f"Nombre: {name}\nCorreo: {email}\nMensaje: {message}"
        )
        mail.send(msg)
        return jsonify({'success': 'Correo enviado correctamente'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)