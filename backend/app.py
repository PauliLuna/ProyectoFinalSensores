from flask import Flask, send_from_directory, render_template
from flask_mail import Mail
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os
#from apscheduler.schedulers.background import BackgroundScheduler
from controllers.alerta_controller import chequear_alertas_criticas

print("Cargando variables de entorno...")
load_dotenv()

print("Cargando Flask...")
app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Configuración de la ruta para manejar errores 404
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

#Para que la sesion funcione correctamente en Flask, es necesario establecer una clave secreta.
# Esta clave se utiliza para firmar cookies y proteger la sesión del usuario.
app.config['SECRET_KEY'] = os.getenv("FLASK_SECRET_KEY")

# Configuración de la carpeta estática
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

# Configuración de MongoDB
print("Configurando MongoDB...")
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)
app.mongo = mongo

# Configuración de Flask-Mail
print("Configurando Mail...")
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
mail = Mail(app)
app.mail = mail

# Configuración de la clave secreta para tokens JWT
print("Configurando clave secreta para tokens JWT...")
SECRET_KEY_TOKEN = os.getenv("SECRET_KEY_TOKEN")

# Importar y registrar Blueprints
from routes.contacto_routes import contacto_bp
app.register_blueprint(contacto_bp)

# Registrar sensor blueprint
from routes.sensor_routes import sensor_bp
app.register_blueprint(sensor_bp)

# Registrar usuario blueprint
from routes.usuario_routes import usuario_bp
app.register_blueprint(usuario_bp)

# Registrar empresa blueprint
from routes.empresa_routes import empresa_bp
app.register_blueprint(empresa_bp)

# Registrar codigo invitacion blueprint
from routes.codigo_invitacion_routes import codigo_bp
app.register_blueprint(codigo_bp)

#Registrar asignacion blueprint
from routes.asignaciones_routes import asignaciones_bp
app.register_blueprint(asignaciones_bp)

# Registrar alertas blueprint
from routes.alerta_routes import create_alerta_routes
app.register_blueprint(create_alerta_routes(mongo))

if __name__ == '__main__':
     # Solo arrancar scheduler en el proceso principal
    #if not os.environ.get("WERKZEUG_RUN_MAIN"):
    #    start_scheduler(mongo)

    print("🚀 Iniciando la aplicación Flask...")
    app.run(debug=True)