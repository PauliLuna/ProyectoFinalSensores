from flask_mail import Message

def enviar_mail_contacto(mail, app, name, email, message):
    msg = Message(
        subject=f"Nuevo mensaje de {name}",
        sender="no-reply@sensia.com",
        recipients=[app.config['MAIL_USERNAME']],
        body=f"¡Hay un nuevo contacto interesado! \n\nNombre: {name}\nCorreo: {email}\nMensaje: {message}"
    )
    mail.send(msg)