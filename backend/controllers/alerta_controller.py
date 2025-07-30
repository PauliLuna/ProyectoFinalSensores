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

        # 3️⃣ Analizar mediciones
        for med in mediciones:
            try:
                temp = float(med.get("valorTempInt"))
            except (TypeError, ValueError):
                print(f"⚠️ Medición inválida en sensor {nro_sensor}: {med.get('valorTempInt')}")
                continue

            print(f"🔹 Chequeando medición {med['_id']} -> temp={temp}°C | rango=({valor_min}, {valor_max})")

            # Validar que valor_min y valor_max no son None
            if valor_min is None or valor_max is None:
                print(f"⚠️ Sensor {nro_sensor} no tiene valor_min o valor_max definidos.")
                continue

            if temp > valor_max or temp < valor_min:
                print(f"⚠️ ALERTA: temp={temp}°C fuera de rango ({valor_min}, {valor_max}) para sensor {nro_sensor}")

                # Generar mensaje y descripción
                if temp > valor_max:
                    #mensaje = f"Temperatura alta: {temp}°C > {sensor['valorMax']}°C"
                    mensaje = "Temperatura interna alta"
                    descripcion = f"La temperatura actual ({temp}°C) excede el límite superior ({valor_max}°C) para el sensor {nro_sensor}."
                else:
                    #mensaje = f"Temperatura baja: {temp}°C < {sensor['valorMin']}°C"
                    mensaje = "Temperatura interna baja"
                    descripcion = f"La temperatura actual ({temp}°C) está por debajo del límite inferior ({valor_min}°C) para el sensor {nro_sensor}."
                #descripcion = f"Sensor {sensor['alias']} fuera de rango ({sensor['valorMin']}°C - {sensor['valorMax']}°C)."
                
                alerta_data = {
                    "idSensor": str(nro_sensor),
                    "idEmpresa": id_empresa,
                    "criticidad": "Crítica",
                    "tipoAlerta": "Temperatura fuera de rango",
                    "descripcion": descripcion,
                    "estadoAlerta": "pendiente",
                    "mensajeAlerta": mensaje,
                    "fechaHoraAlerta": med["fechaHoraMed"]
                }

                # 4️⃣ Guardar alerta en BD
                alerta_id = insert_alerta(mongo, alerta_data)
                print(f"✅ Alerta insertada para sensor {nro_sensor} -> ID {alerta_id}")

                # 5️⃣ Notificar por mail
                emails = _obtener_emails_asignados(mongo, nro_sensor)
                print(f"📧 Emails asignados: {emails}")
                if emails:
                    mail = current_app.mail
                    subject = f"[ALERTA] {mensaje} - Sensor {sensor['nroSensor']}"
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
                        <h2>⚠️ Alerta Crítica en SensIA</h2>
                        <div class="info">
                            <span class="label">Sensor:</span> {sensor['nroSensor']}
                        </div>
                        <div class="info">
                            <span class="label">Tipo:</span> {"Temperatura fuera de rango"}
                        </div>
                        <div class="info">
                            <span class="label">Descripción:</span> {descripcion}
                        </div>
                        <div class="info">
                            <span class="label">Fecha y hora:</span> {med["fechaHoraMed"]}
                        </div>
                        <div class="info">
                            <span class="label">Criticidad:</span> {"Critica"}
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

                else:
                    print("⚠️ No hay emails asignados a este sensor")
                

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