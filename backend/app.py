from flask import Flask, send_from_directory
from flask_mail import Mail
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os

print("Cargando Flask...")
app = Flask(__name__, static_folder='../frontend', static_url_path='')

print("Cargando variables de entorno...")
load_dotenv()

# Configuración de la carpeta estática
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

# Configuración de MongoDB
print("Configurando MongoDB...")
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
print("MONGO_URI:", os.getenv("MONGO_URI"))
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

# Importar y registrar Blueprints
from routes.contacto_routes import contacto_bp
app.register_blueprint(contacto_bp)

# Registrar sensor blueprint
from routes.sensor_routes import sensor_bp
app.register_blueprint(sensor_bp)

if __name__ == '__main__':
    app.run(debug=True)