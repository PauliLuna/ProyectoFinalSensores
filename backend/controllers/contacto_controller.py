from flask import jsonify, current_app
from models.contacto import save_contacto

def enviar_mail_contacto(name, email, message):
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #222; }}
        .container {{ padding: 20px; border: 1px solid #eee; border-radius: 8px; background: #fafafa; }}
        h2 {{ color: #2a7ae2; }}
        .info {{ margin-bottom: 10px; }}
        .label {{ font-weight: bold; }}
        .message {{ margin-top: 15px; padding: 10px; background: #f1f7ff; border-radius: 5px; }}
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Nuevo mensaje de contacto</h2>
        <div class="info"><span class="label">Nombre:</span> {name}</div>
        <div class="info"><span class="label">Correo:</span> {email}</div>
        <div class="message">
        <span class="label">Mensaje:</span><br>
        {message}
        </div>
    </div>
    </body>
    </html>
    """.format(name=name, email=email, message=message)

    # Obtener el cliente de la API de Mailjet de la configuración de la app
    mailjet = current_app.config['MAILJET_CLIENT']
    subject=f"Nuevo mensaje de {name}"
    
    # Obtener el email del remitente de la configuración de la app
    sender_email = current_app.config['MAIL_FROM_EMAIL']

    # Crear la carga útil (payload) para la API
    data = {
        'Messages': [
            {
                "From": {
                    "Email": sender_email,
                    "Name": "SensIA"
                },
                "To": sender_email,
                "Subject": subject,
                "HTMLPart": html_template
            }
        ]
    }

    try:
        # Enviar el correo usando la API de Mailjet
        result = mailjet.send.create(data=data)
        
        # Verificar si la respuesta fue exitosa
        if result.status_code == 200:
            print(sender_email)
            return jsonify({"message": f"Se envió un correo de alerta de seguridad a {sender_email}"}), 200
        else:
            return jsonify({"error": f"Error al enviar el correo: {result.json()}"}), 500
    except Exception as e:
        # Captura cualquier excepción de red o de la librería
        return jsonify({"error": f"Error de conexión: {str(e)}"}), 500


def handle_contact_submission(mongo, data):
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not name or not email or not message:
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    try:
        save_contacto(mongo, name, email, message)
        enviar_mail_contacto(name, email, message)
        return jsonify({'success': 'Correo enviado correctamente'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500