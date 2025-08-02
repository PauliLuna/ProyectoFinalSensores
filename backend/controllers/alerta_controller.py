from flask import jsonify, request, session, current_app
from models.alerta import get_alertas_by_empresa,get_alertas_filtradas,  insert_alerta, cerrar_alerta
from bson import ObjectId
from datetime import datetime, timedelta
from flask_mail import Message
from models.usuario import get_usuario_by_id
from controllers.sensor_controller import get_all_sensors



def obtener_alertas(mongo):
    id_empresa = session.get("idEmpresa")  # Asegúrate que el login guarda esto en la sesión
    if not id_empresa:
        return jsonify({"error": "Empresa no encontrada"}), 401

    tipo = request.args.get("tipoAlerta")
    alertas = get_alertas_filtradas(mongo, id_empresa, tipo)
    for alerta in alertas:
        alerta["_id"] = str(alerta["_id"])
    return jsonify(alertas), 200

def nueva_alerta(mongo):
    data = request.get_json()
    data["idEmpresa"] = session.get("idEmpresa")
    data["estadoAlerta"] = "Activa"
    alerta_id = insert_alerta(mongo, data)
    return jsonify({"message": "Alerta creada", "id": str(alerta_id)}), 201

def cerrar_alerta_api(mongo, alerta_id):
    result = cerrar_alerta(mongo, alerta_id)
    if result.modified_count == 0:
        return jsonify({"message": "No se encontró la alerta"}), 404
    return jsonify({"message": "Alerta cerrada"}), 200


def chequear_alertas_criticas(mongo, id_empresa):
    sensores = get_all_sensors(mongo)

    for sensor in sensores:
        nro_sensor = sensor["nroSensor"]

        valor_min = sensor.get("valorMin")
        valor_max = sensor.get("valorMax")

        # 1️⃣ Obtener checkpoint
        checkpoint = mongo.db.alerta_checkpoint.find_one({
            "idEmpresa": id_empresa,
            "idSensor": nro_sensor
        })
        last_date = checkpoint["fechaUltimaAnalizada"] if checkpoint else None

        # 2️⃣ Obtener mediciones no analizadas
        filtro = {"idSensor": nro_sensor}
        if last_date:
            filtro["fechaHoraMed"] = {"$gt": last_date}

        mediciones = list(mongo.db.mediciones.find(filtro).sort("fechaHoraMed", 1))

        if not mediciones:
            continue

        # Mantener un flag de puerta abierta previa
        puerta_abierta_previa = False
        prev_med = None
        en_ciclo = False
        inicio_ciclo = None

        # 3️⃣ Analizar mediciones
        for med in mediciones:
            fecha_actual = med["fechaHoraMed"]

            # --- ALERTA OFFLINE ---
            if prev_med:
                 _alerta_offline(mongo, sensor, prev_med, fecha_actual, id_empresa)

            # --- ALERTA PUERTA ---
            puerta_estado = med.get("puerta")  # 0 cerrado, 1 abierto
            puerta_abierta_previa = _alerta_puerta(
                mongo, sensor, puerta_estado, puerta_abierta_previa, fecha_actual, id_empresa
            )

            
           # --- ALERTA TEMPERATURA FUERA DE RANGO + CICLO ---
            try:
                temp = float(med.get("valorTempInt"))
            except (TypeError, ValueError):
                prev_med = med
                continue

            if valor_min is not None and valor_max is not None:
                # Detectar entrada/salida en ciclo
                if temp > valor_max and not en_ciclo:
                    en_ciclo = True
                    inicio_ciclo = fecha_actual
                elif en_ciclo and valor_min <= temp <= valor_max:
                    en_ciclo = False
                    inicio_ciclo = None
                else:
                    en_ciclo, inicio_ciclo = _alerta_ciclo_asincronico(
                        mongo, sensor, en_ciclo, inicio_ciclo, temp, valor_min, valor_max, fecha_actual, id_empresa
                    )

                # Alerta temp fuera de rango
                _alerta_temp_fuera_rango(mongo, sensor, temp, valor_min, valor_max, fecha_actual, id_empresa)

           
            prev_med = med      

        # 6️⃣ Actualizar checkpoint con la última medición analizada
        last_med = mediciones[-1]
        mongo.db.alerta_checkpoint.update_one(
            {"idEmpresa": id_empresa, "idSensor": nro_sensor},
            {"$set": {"fechaUltimaAnalizada": last_med["fechaHoraMed"]}},
            upsert=True
        )


def _obtener_emails_asignados(mongo, nro_sensor):
    """Obtiene los emails de los usuarios asignados a un sensor"""
    asignaciones = mongo.db.asignaciones.find({
        "idSensor": nro_sensor,
        "estadoAsignacion": "Activo"
    })
    emails = []
    for a in asignaciones:
        usuario = mongo.db.usuarios.find_one({"_id": ObjectId(a["idUsuario"])})
        if usuario and usuario.get("email"):
            emails.append(usuario["email"])
    return emails

def _enviar_mail_alerta(emails, tipo_alerta, descripcion, criticidad, sensor, mensaje, fecha):
    mail = current_app.mail
    subject = f"[ALERTA] {tipo_alerta} - Sensor {sensor['nroSensor']}"
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #333; }}
        .container {{ padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9; max-width: 600px; margin: auto; }}
        h2 {{ color: #ef4444; }}
        .info {{ margin-bottom: 10px; }}
        .label {{ font-weight: bold; }}
        .message {{ margin-top: 15px; padding: 12px; background-color: #fee2e2; border-left: 5px solid #ef4444; border-radius: 4px; }}
    </style>
    </head>
    <body>
    <div class="container">
        <h2>⚠️ Alerta en SensIA</h2>
        <div class="info">
            <span class="label">Sensor:</span> {sensor['nroSensor']}
        </div>
        <div class="info">
            <span class="label">Tipo:</span> {tipo_alerta}
        </div>
        <div class="info">
            <span class="label">Descripción:</span> {descripcion}
        </div>
        <div class="info">
            <span class="label">Fecha y hora:</span> {fecha}
        </div>
        <div class="info">
            <span class="label">Criticidad:</span> {criticidad}
        </div>
        <div class="message">
            {mensaje}
        </div>
        <p>Por favor, revise la situación lo antes posible.</p>
        <p>Gracias por usar <strong>SensIA</strong>.</p>

        <p>🌐 <a href="https://sensia.onrender.com">https://sensia.onrender.com</a><br>
        📩 <a href="mailto:sensiaproyecto@gmail.com">sensiaproyecto@gmail.com</a></p>
    </div>
    </body>
    </html>
    """
    msg = Message(
        subject=subject, 
        sender=current_app.config['MAIL_USERNAME'], 
        recipients=emails,
        html=html_template
    )
    try:
        mail.send(msg)
        print(f"✅ Mail enviado a {emails}")
    except Exception as e:
        print(f"❌ Error enviando mail de alerta: {e}")


def _alerta_offline(mongo, sensor, prev_med, fecha_actual, id_empresa):
    """Detecta huecos de tiempo sin mediciones"""
    gap = fecha_actual - prev_med["fechaHoraMed"]
    if gap >= timedelta(minutes=10):
        alerta_data = {
            "idSensor": str(sensor["nroSensor"]),
            "idEmpresa": id_empresa,
            "criticidad": "Crítica",
            "tipoAlerta": "Sensor offline",
            "descripcion": f"El sensor {sensor['nroSensor']} no envió datos entre {prev_med['fechaHoraMed']} y {fecha_actual}.",
            "estadoAlerta": "pendiente",
            "mensajeAlerta": "Sensor offline (sin mediciones)",
            "fechaHoraAlerta": fecha_actual
        }
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta offline para sensor {sensor['nroSensor']} -> ID {alerta_id}")

        emails = _obtener_emails_asignados(mongo, sensor["nroSensor"])
        if emails:
            _enviar_mail_alerta(
                emails,
                "Sensor offline",
                alerta_data["descripcion"], 
                "Crítica", 
                sensor, 
                alerta_data["mensajeAlerta"], 
                fecha_actual
            )

def _alerta_puerta(mongo, sensor, puerta_estado, puerta_abierta_previa, fecha_actual, id_empresa):
    """Detecta puerta abierta prolongada"""
    if puerta_estado == 1 and puerta_abierta_previa:
        print(f"⚠️ ALERTA: puerta abierta prolongada en sensor {sensor['nroSensor']}")
        alerta_data = {
            "idSensor": str(sensor["nroSensor"]),
            "idEmpresa": id_empresa,
            "criticidad": "Crítica",
            "tipoAlerta": "Puerta abierta prolongada",
            "descripcion": f"Puerta abierta ≥10 min en sensor {sensor['nroSensor']}. Riesgo de pérdida de frío.",
            "estadoAlerta": "pendiente",
            "mensajeAlerta": "Puerta abierta prolongada",
            "fechaHoraAlerta": fecha_actual
        }
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta puerta abierta en sensor {sensor['nroSensor']} -> ID {alerta_id}")

        emails = _obtener_emails_asignados(mongo, sensor["nroSensor"])
        if emails:
            _enviar_mail_alerta(
                emails, 
                "Puerta abierta prolongada", 
                alerta_data["descripcion"], 
                "Crítica", 
                sensor, 
                alerta_data["mensajeAlerta"], 
                fecha_actual
            )
    # Si no se disparó alerta, actualizamos el estado según puerta actual
    return puerta_estado == 1


def _alerta_temp_fuera_rango(mongo, sensor, temp, valor_min, valor_max, fecha_actual, id_empresa):
    """Detecta temperatura fuera de rango"""
    if temp > valor_max or temp < valor_min:
        print(f"⚠️ ALERTA: temp={temp}°C fuera de rango ({valor_min}, {valor_max}) para sensor {sensor['nroSensor']}")
         # Generar mensaje y descripción
        if temp > valor_max:
            mensaje = "Temperatura interna alta"
            descripcion = f"La temperatura actual ({temp}°C) excede el límite superior ({valor_max}°C) para el sensor {sensor['nroSensor']}."
        else:
            mensaje = "Temperatura interna baja"
            descripcion = f"La temperatura actual ({temp}°C) está por debajo del límite inferior ({valor_min}°C) para el sensor {sensor['nroSensor']}."

        alerta_data = {
            "idSensor": str(sensor["nroSensor"]),
            "idEmpresa": id_empresa,
            "criticidad": "Crítica",
            "tipoAlerta": "Temperatura fuera de rango",
            "descripcion": descripcion,
            "estadoAlerta": "pendiente",
            "mensajeAlerta": mensaje,
            "fechaHoraAlerta": fecha_actual
        }
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta temp fuera de rango en sensor {sensor['nroSensor']} -> ID {alerta_id}")

        emails = _obtener_emails_asignados(mongo, sensor["nroSensor"])
        if emails:
            _enviar_mail_alerta(
                emails, 
                "Temperatura fuera de rango", 
                descripcion, 
                "Crítica", 
                sensor, 
                mensaje, 
                fecha_actual
            )


def _alerta_ciclo_asincronico(mongo, sensor, en_ciclo, inicio_ciclo, temp, valor_min, valor_max, fecha_actual, id_empresa):
    """Detecta ciclo de refrigeramiento asincrónico"""
    if en_ciclo and (fecha_actual - inicio_ciclo) >= timedelta(minutes=15):
        alerta_data = {
            "idSensor": str(sensor["nroSensor"]),
            "idEmpresa": id_empresa,
            "criticidad": "Crítica",
            "tipoAlerta": "Ciclo de refrigeramiento asincrónico",
            "descripcion": f"La temperatura no retornó al rango seguro ({valor_min}°C-{valor_max}°C) tras un ciclo de descongelamiento.",
            "estadoAlerta": "pendiente",
            "mensajeAlerta": "Ciclo asincrónico detectado",
            "fechaHoraAlerta": fecha_actual
        }
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta ciclo asincrónico en sensor {sensor['nroSensor']} -> ID {alerta_id}")

        emails = _obtener_emails_asignados(mongo, sensor["nroSensor"])
        if emails:
            _enviar_mail_alerta(
                emails, 
                "Ciclo de refrigeramiento asincrónico", 
                alerta_data["descripcion"], 
                "Crítica", 
                sensor, 
                alerta_data["mensajeAlerta"], 
                fecha_actual
            )
        return False, None  # reset ciclo
    return en_ciclo, inicio_ciclo


