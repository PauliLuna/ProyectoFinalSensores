# Web Application

This project is a web application that utilizes HTML, CSS, and JavaScript for the front end, and Python for the back end.

# Project Structure

```
.
├── .gitignore
├── README.md
├── backend/
│   ├── .env                  # Variables de entorno (credenciales y URIs, no dentro de git)
│   ├── app.py                # Configuración principal de Flask, MongoDB y Flask-Mail, registro de blueprints
│   ├── Procfile              # Configuración para despliegue en plataformas como Heroku
│   ├── requirements.txt      # Dependencias de Python para el backend
│   ├── controllers/          # Lógica de negocio/controladores
│   │   ├── __init__.py
│   │   └── contacto_controller.py  # Lógica para enviar mails de contacto
│   ├── models/               # Modelos de datos (acceso a la base de datos)
│   │   ├── __init__.py
│   │   └── contacto.py       # Función para guardar contactos en MongoDB
│   └── routes/               # Definición de rutas/endpoints de la API
│       ├── __init__.py
│       └── contacto_routes.py    # Ruta para el formulario de contacto
├── frontend/
│   ├── index.html            # Página principal
│   ├── alarmas.html
│   ├── dashboard.html
│   ├── dashboard_sensor.html
│   ├── edit_sensor.html
│   ├── home.html
│   ├── login_cliente.html
│   ├── login_usuario.html
│   ├── mapa.html
│   ├── register_camera.html
│   ├── register_sensor.html
│   ├── register_user.html
│   ├── sensores.html
│   ├── signin.html
│   ├── assets/               # Imágenes y otros recursos estáticos
│   ├── scripts/              # Archivos JavaScript para la lógica del frontend
│   │   └── app.js
│   └── styles/               # Archivos CSS para los estilos
│       └── style.css
```

### Explicación

- **backend/**: Todo el código del servidor (API, lógica de negocio, modelos y rutas).
  - **app.py**: Punto de entrada del backend, configura Flask, MongoDB, Mail y registra los blueprints.
  - **controllers/**: Funciones que contienen la lógica de negocio (por ejemplo, enviar mails).
  - **models/**: Funciones para interactuar con la base de datos (por ejemplo, guardar contactos).
  - **routes/**: Define los endpoints de la API (por ejemplo, `/contacto`).
  - **.env**: Variables sensibles como contraseñas y URIs (no dentro de git).
  - **requirements.txt**: Lista de dependencias de Python.
  - **Procfile**: Archivo para despliegue en servicios como Heroku.

- **frontend/**: Todo el código del cliente (HTML, CSS, JS).
  - **index.html** y otras páginas: Distintas vistas de la aplicación.
  - **assets/**: Imágenes y recursos estáticos.
  - **scripts/**: Archivos JavaScript.
  - **styles/**: Archivos CSS.

- **.gitignore**: Archivos y carpetas que git ignora.
- **README.md**: Documentación del proyecto.

Esta estructura separa claramente el frontend y el backend, y dentro del backend organiza la lógica en controladores, modelos y rutas para facilitar el mantenimiento y la escalabilidad.