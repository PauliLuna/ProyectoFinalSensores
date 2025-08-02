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
            "idSensor": nro_sensor,
            "tipo": "critica"
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

              # 🔹 Actualizar estado del sensor a active
            mongo.db.sensors.update_one(
                {"nroSensor": sensor["nroSensor"], "idEmpresa": id_empresa},
                {"$set": {"estado": "active"}}
            )
            print(f"🔄 Estado del sensor {sensor['nroSensor']} actualizado a 'active'")

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
            {"idEmpresa": id_empresa, "idSensor": nro_sensor, "tipo": "critica"},
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
        print(f"⚠️ ALERTA: sensor {sensor['nroSensor']} sin mediciones por {gap}")

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

          # 🔹 Actualizar estado del sensor a inactive
        mongo.db.sensors.update_one(
            {"nroSensor": sensor["nroSensor"], "idEmpresa": id_empresa},
            {"$set": {"estado": "inactive"}}
        )
        print(f"🔄 Estado del sensor {sensor['nroSensor']} actualizado a 'inactive'")

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


def chequear_alertas_preventivas(mongo, id_empresa):
    """
    Función principal para analizar las alertas preventivas
    """
    sensores = get_all_sensors(mongo)

    for sensor in sensores:
        #Validación de caida de energía
        _alerta_caida_energia(mongo, sensor, id_empresa)

        nro_sensor = sensor["nroSensor"]
        valor_min = sensor.get("valorMin")
        valor_max = sensor.get("valorMax")

          # 1️⃣ Obtener checkpoint de preventivas
        checkpoint = mongo.db.alerta_checkpoint.find_one({
            "idEmpresa": id_empresa,
            "idSensor": nro_sensor,
            "tipo": "preventiva"
        })
        last_date = checkpoint["fechaUltimaAnalizada"] if checkpoint else None

         # 2️⃣ Obtener mediciones nuevas (no analizadas desde el checkpoint)
        filtro = {"idSensor": nro_sensor}
        if last_date:
            filtro["fechaHoraMed"] = {"$gt": last_date}

        mediciones = list(mongo.db.mediciones.find(filtro).sort("fechaHoraMed", 1))

        if not mediciones:
            continue

        if len(mediciones) < 3:
            continue  # Necesitamos varias mediciones para detectar fluctuaciones

        # 2️⃣ Analizar fluctuaciones
        _alerta_fluctuacion_temp(mongo, sensor, mediciones, valor_min, valor_max, id_empresa)

        # 3️⃣ Alerta de puerta abierta recurrente
        _alerta_puerta_recurrente(mongo, sensor, id_empresa)

        # 3️⃣ Actualizar checkpoint
        mongo.db.alerta_checkpoint.update_one(
            {"idEmpresa": id_empresa, "idSensor": nro_sensor, "tipo": "preventiva"},
            {"$set": {"fechaUltimaAnalizada": mediciones[-1]["fechaHoraMed"]}},
            upsert=True
        )




def _alerta_fluctuacion_temp(mongo, sensor, mediciones, valor_min, valor_max, id_empresa):
    """Detecta oscilaciones abruptas en un periodo corto (ej. 1 hora)"""
    nro_sensor = sensor["nroSensor"]

    # Calcular min y max de las últimas mediciones
    temps = [float(m["valorTempInt"]) for m in mediciones if m.get("valorTempInt") is not None]
    if not temps:
        return

    temp_max = max(temps)
    temp_min = min(temps)
    delta = temp_max - temp_min
    print(f"⚠️fluctuación de {delta}°C detectada en sensor {nro_sensor}, con rango ({temp_max}, {temp_min})")

    # 1️⃣ Validar amplitud mayor al rango normal + margen
    margen_permitido = abs(valor_max - valor_min)  
    if delta > margen_permitido:
        print(f"⚠️ ALERTA PREVENTIVA: fluctuación de {delta}°C detectada en sensor {nro_sensor}")

        # 2️⃣ Insertar alerta
        alerta_data = {
            "idSensor": str(nro_sensor),
            "idEmpresa": id_empresa,
            "criticidad": "Preventiva",
            "tipoAlerta": "Fluctuación de temperatura excesiva",
            "descripcion": f"Oscilaciones de temperatura mayores a {margen_permitido}°C en 1h. Delta: {delta:.2f}°C.",
            "estadoAlerta": "pendiente",
            "mensajeAlerta": "Fluctuación de temperatura excesiva",
            "fechaHoraAlerta": mediciones[-1]["fechaHoraMed"]
        }
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta preventiva insertada para sensor {nro_sensor} -> ID {alerta_id}")

        # 3️⃣ Notificar
        emails = _obtener_emails_asignados(mongo, nro_sensor)
        if emails:
            _enviar_mail_alerta(
                emails=emails,
                tipo_alerta="Fluctuación de temperatura excesiva",
                descripcion=alerta_data["descripcion"],
                criticidad="Preventiva",
                sensor=sensor,
                mensaje="Oscilaciones de temperatura detectadas",
                fecha=mediciones[-1]["fechaHoraMed"]
            )

def _alerta_puerta_recurrente(mongo, sensor, id_empresa, max_repeticiones=3):
    """
    Genera alerta preventiva si el sensor tiene más de X alertas de puerta abierta prolongada
    en el mismo día.
    """
    nro_sensor = sensor["nroSensor"]
    hoy_inicio = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Buscar alertas críticas de puerta abierta prolongada de hoy
    count_alertas = mongo.db.alertas.count_documents({
        "idSensor": str(nro_sensor),
        "idEmpresa": id_empresa,
        "tipoAlerta": "Puerta abierta prolongada",
        "fechaHoraAlerta": {"$gte": hoy_inicio}
    })

    if count_alertas >= max_repeticiones:
        print(f"⚠️ ALERTA PREVENTIVA: puerta abierta recurrente (sensor {nro_sensor})")

        alerta_data = {
            "idSensor": str(nro_sensor),
            "idEmpresa": id_empresa,
            "criticidad": "Preventiva",
            "tipoAlerta": "Puerta abierta recurrente",
            "descripcion": f"Más de {max_repeticiones} alertas de puerta abierta prolongada en el día para el sensor {nro_sensor}.",
            "estadoAlerta": "pendiente",
            "mensajeAlerta": "Patrón recurrente de puerta abierta",
            "fechaHoraAlerta": datetime.utcnow()
        }

        # Insertar alerta
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta preventiva (puerta recurrente) insertada -> ID {alerta_id}")

        # Notificar por mail
        emails = _obtener_emails_asignados(mongo, nro_sensor)
        if emails:
            _enviar_mail_alerta(
                emails=emails,
                tipo_alerta="Puerta abierta recurrente",
                descripcion=alerta_data["descripcion"],
                criticidad="Preventiva",
                sensor=sensor,
                mensaje="Patrón recurrente de puerta abierta",
                fecha=alerta_data["fechaHoraAlerta"]
            )

def _alerta_caida_energia(mongo, sensor, id_empresa):
    """
    Genera alerta preventiva si todos los sensores de la misma dirección
    están inactivos -> posible caída de energía eléctrica.
    """
    direccion = sensor.get("direccion")
    if not direccion:
        return

    # Buscar sensores de la misma dirección
    sensores_misma_dir = list(mongo.db.sensors.find({
        "idEmpresa": id_empresa,
        "direccion": direccion
    }))

    if not sensores_misma_dir:
        return

    # Verificar si todos están inactivos
    if all(s["estado"] == "inactive" for s in sensores_misma_dir):
        existe = mongo.db.alertas.find_one({
            "idEmpresa": id_empresa,
            "tipoAlerta": "Caída de energía eléctrica",
            "direccion": direccion,
            "estadoAlerta": "pendiente"
        })
        if existe:
            return
    
        print(f"⚠️ ALERTA PREVENTIVA: caída de energía en dirección {direccion}")

        alerta_data = {
            "idSensor": str(sensor["nroSensor"]),  # Usamos uno como referencia
            "idEmpresa": id_empresa,
            "criticidad": "Preventiva",
            "tipoAlerta": "Caída de energía eléctrica",
            "descripcion": f"Todos los sensores en {direccion} están inactivos. Posible caída de energía.",
            "estadoAlerta": "pendiente",
            "mensajeAlerta": "Caída de energía eléctrica",
            "fechaHoraAlerta": datetime.utcnow()
        }

        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta preventiva (caída energía) insertada -> ID {alerta_id}")

        # Obtener emails de todos los sensores de la dirección
        emails = []
        for s in sensores_misma_dir:
            emails += _obtener_emails_asignados(mongo, s["nroSensor"])
        emails = list(set(emails))  # eliminar duplicados

        if emails:
            _enviar_mail_alerta(
                emails=emails,
                tipo_alerta="Caída de energía eléctrica",
                descripcion=alerta_data["descripcion"],
                criticidad="Preventiva",
                sensor=sensor,
                mensaje="Caída de energía eléctrica en la sucursal",
                fecha=alerta_data["fechaHoraAlerta"]
            )
