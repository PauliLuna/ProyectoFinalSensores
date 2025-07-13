from flask_mail import Message
from flask import jsonify
from models.contacto import save_contacto

def enviar_mail_contacto(mail, app, name, email, message):
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

    msg = Message(
        subject=f"Nuevo mensaje de {name}",
        sender="no-reply@sensia.com",
        recipients=[app.config['MAIL_USERNAME']],
        html=html_template
    )
    mail.send(msg)

def handle_contact_submission(mongo, mail, app, data):
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not name or not email or not message:
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    try:
        save_contacto(mongo, name, email, message)
        enviar_mail_contacto(mail, app, name, email, message)
        return jsonify({'success': 'Correo enviado correctamente'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500