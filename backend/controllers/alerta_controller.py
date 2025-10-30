from flask import jsonify, request, session, current_app
from models.alerta import (
    get_alertas_filtradas,  
    insert_alerta, 
    get_alerta_caida_energia_abierta, 
    get_alertas_puerta_abierta,
    q_alerta_abierta_temp,
    q_alerta_abierta_offline,
    q_alerta_abierta_puerta,
    updateDuracion,
    get_checkpoint,
    update_checkpoint_informativas,
    get_alertas_sensor,
    update_checkpoint,
    update_description_offline,
    get_alertas_seguridad)
from models.sensor import(
    get_mediciones,
    get_ultima_medicion,
    updateStatus,
    get_sensor_by_nro,
    update_puerta_inicio,
    update_puerta_inicio_unset)
from bson import ObjectId
from datetime import datetime, timedelta
from controllers.sensor_controller import get_all_sensors_empresa
from models.usuario import get_super_admins_by_criticidad
import pytz

# Tabla de referencia de parámetros por tipo de cámara
TIPOS_CAMARA = {
    "congelados": {"duracion_min": 20, "duracion_max": 40, "incremento_max": 8},
    "helados": {"duracion_min": 20, "duracion_max": 30, "incremento_max": 6},
    "carnes frescas": {"duracion_min": 15, "duracion_max": 25, "incremento_max": 4},
    "frutas": {"duracion_min": 10, "duracion_max": 20, "incremento_max": 4}
}

def obtener_alertas(mongo):
    id_empresa = session.get("idEmpresa")  # Asegúrate que el login guarda esto en la sesión
    if not id_empresa:
        return jsonify({"error": "Empresa no encontrada"}), 401

    tipo = request.args.get("tipoAlerta")
    alertas = get_alertas_filtradas(mongo, id_empresa, tipo)
    
    # Recolectar IDs válidos para join con sensores
    sensores_ids_validos = set()
    for alerta in alertas:
        valor_sensor = alerta.get("idSensor")
        if isinstance(valor_sensor, list):
            for sensor_id in valor_sensor:
                if sensor_id is not None and isinstance(sensor_id, str) and sensor_id.isdigit():
                    sensores_ids_validos.add(int(sensor_id))
        elif valor_sensor is not None and isinstance(valor_sensor, str) and valor_sensor.isdigit():
            sensores_ids_validos.add(int(valor_sensor))
    
    sensores_ids = list(sensores_ids_validos)
    sensores = list(mongo.db.sensors.find({"nroSensor": {"$in": sensores_ids}}))
    sensor_alias = {int(s["nroSensor"]): s.get("alias", "") for s in sensores}
    sensor_direccion = {int(s["nroSensor"]): s.get("direccion", "") for s in sensores}

    # Definimos la zona horaria UTC y la zona de Argentina.
    zona_utc = pytz.timezone('UTC')
    zona_argentina = pytz.timezone('America/Argentina/Buenos_Aires')

    for alerta in alertas:
        try:
            alerta["_id"] = str(alerta["_id"])

            # Seguridad: no tiene idSensor, alias ni direccion
            if alerta.get("criticidad", "").lower() == "seguridad":
                alerta["idSensor"] = "N/A"
                alerta["alias"] = "N/A"
                alerta["direccion"] = ""
            # Caída de energía eléctrica: idSensor es array
            elif alerta.get("tipoAlerta") == "Caída de energía eléctrica":
                sensores_info = []
                valor_sensor = alerta.get("idSensor", [])
                for sensor_id in valor_sensor:
                    if sensor_id is not None and isinstance(sensor_id, str) and sensor_id.isdigit():
                        sid = int(sensor_id)
                        sensores_info.append({
                            "idSensor": sensor_id,
                            "alias": sensor_alias.get(sid, ""),
                            "direccion": sensor_direccion.get(sid, "")
                        })
                alerta["sensores_info"] = sensores_info
                # No sobrescribas 'direccion' si ya existe en la alerta
            # Alertas normales: idSensor único
            else:
                valor_sensor = alerta.get("idSensor")
                if valor_sensor is not None and isinstance(valor_sensor, str) and valor_sensor.isdigit():
                    sid = int(valor_sensor)
                    alerta["alias"] = sensor_alias.get(sid, "")
                    alerta["direccion"] = sensor_direccion.get(sid, "")
                else:
                    alerta["alias"] = ""
                    alerta["direccion"] = ""

            # Convertir fechaHoraAlerta a zona local
            fecha_utc = alerta["fechaHoraAlerta"]
            fecha_utc_con_zona = zona_utc.localize(fecha_utc)
            fecha_argentina = fecha_utc_con_zona.astimezone(zona_argentina)
            alerta["fechaHoraAlerta"] = fecha_argentina.isoformat()

        except Exception as e:
            alerta["alias"] = ""
            alerta["direccion"] = ""
            print(f"[ERROR] No se pudo procesar la alerta porque la excepción fue: {e}")
    return jsonify(alertas), 200


def obtener_alertas_por_sensor(mongo, sensor_id):
    id_empresa = session.get("idEmpresa")
    if not id_empresa:
        return jsonify({"error": "Empresa no encontrada"}), 401

    # Busca solo las alertas de ese sensor y empresa
    alertas_sensor = get_alertas_sensor(mongo, id_empresa, sensor_id)

    alertas_seguridad = get_alertas_seguridad(mongo, id_empresa)

    alertas = alertas_sensor + alertas_seguridad   

    # Definimos la zona horaria UTC y la zona de Argentina.
    zona_utc = pytz.timezone('UTC')
    zona_argentina = pytz.timezone('America/Argentina/Buenos_Aires')
    for alerta in alertas:
        alerta["_id"] = str(alerta["_id"])

        # Convertir fechaHoraAlerta a zona local
        fecha_utc = alerta["fechaHoraAlerta"]
        fecha_utc_con_zona = zona_utc.localize(fecha_utc)
        fecha_argentina = fecha_utc_con_zona.astimezone(zona_argentina)
        alerta["fechaHoraAlerta"] = fecha_argentina.isoformat()

    return jsonify(alertas), 200


def nueva_alerta(mongo):
    data = request.get_json()
    data["idEmpresa"] = session.get("idEmpresa")
    print(f"[DEBUG] Insertando alerta: {data}")
    alerta_id = insert_alerta(mongo, data)
    return jsonify({"message": "Alerta creada", "id": str(alerta_id)}), 201

def evaluar_alertas(mongo, id_empresa):
    total = 0
    total += chequear_alertas_criticas(mongo, id_empresa)
    print(f"[DEBUG] Total alertas críticas generadas: {total}")
    total += chequear_alertas_preventivas(mongo, id_empresa)
    print(f"[DEBUG] Total + alertas preventivas generadas: {total}")
    total += chequear_alertas_informativas(mongo, id_empresa)
    print(f"[DEBUG] Total + alertas informativas generadas: {total}")
    return total


def chequear_alertas_criticas(mongo, id_empresa):
    total_alertas_generadas = 0
    sensores = get_all_sensors_empresa(mongo,id_empresa)
    print(f"[DEBUG] Empresa {id_empresa} - Sensores encontrados: {len(sensores)}")

    if not sensores:
        print("[DEBUG] No hay sensores para esta empresa.")
        return 0

    for sensor in sensores:
        nro_sensor = sensor["nroSensor"]
        print(f"[DEBUG] Procesando sensor: {sensor['nroSensor']}")
        valor_min = sensor.get("valorMin")
        valor_max = sensor.get("valorMax")

        try:
            # 1️⃣ Obtener checkpoint
            checkpoint = get_checkpoint(mongo, id_empresa, nro_sensor, "critica")

            # 2️⃣ Obtener mediciones no analizadas
            last_date = checkpoint["fechaUltimaAnalizada"] if checkpoint else None
            print(f"[DEBUG] Checkpoint para sensor {nro_sensor}: {last_date}")
            mediciones = get_mediciones(mongo, nro_sensor, last_date) #Forma ascendente

            print(f"[DEBUG] Sensor {sensor['nroSensor']} - Mediciones encontradas: {len(mediciones)}")

            if not mediciones:
                # ⚠️ Si no hay mediciones nuevas, igual verificamos el estado offline.
                # Se usa la última medición conocida del sensor para el cálculo del tiempo.
                ultima_medicion = get_ultima_medicion(mongo, nro_sensor)
                
                if ultima_medicion:
                    offline_alertas = _alerta_offline(mongo, sensor, ultima_medicion, datetime.now(), id_empresa)
                    total_alertas_generadas += offline_alertas
                print(f"[DEBUG] No hay mediciones nuevas para sensor {sensor['nroSensor']}")
                continue

            # Mantener un flag de puerta abierta previa
            puerta_abierta_previa = False
            prev_med = None
            en_ciclo = False
            inicio_ciclo = None
            # Usar la última medición en BD como "prev_med" para permitir comparar
            # con la primera medición nueva (evita necesitar 2 mediciones nuevas).
            prev_med = get_ultima_medicion(mongo, nro_sensor)
            # first_iter indica que la siguiente iteración es la primera medición nueva
            first_iter = True
            

            # 3️⃣ Analizar mediciones
            for med in mediciones:
                print(f"[DEBUG] Medición: {med}")
                fecha_actual = med["fechaHoraMed"]

                # --- CASO ESPECIAL: Primera medición nueva ---
                if prev_med is None:
                    # Si el sensor está inactivo y hay alerta offline abierta, cerrarla y reactivar sensor
                    alerta_abierta = q_alerta_abierta_offline(mongo, sensor["nroSensor"], id_empresa)
                    print(f"[DEBUG] Alerta abierta offline para sensor {sensor['nroSensor']} - {sensor['estado']}: {alerta_abierta}")
                    if sensor['estado'] == "OFFLINE" and alerta_abierta:
                        inicio = alerta_abierta["fechaHoraAlerta"]
                        duracion = (fecha_actual - inicio).total_seconds() / 60
                        duracion = round(duracion, 1)
                        updateDuracion(mongo, alerta_abierta["_id"], duracion)
                        print(f"✅ ALERTA OFFLINE cerrada duración {duracion:.1f} min")
                        updateStatus(mongo, sensor["nroSensor"], id_empresa, "active")
                        print(f"🔄 Estado del sensor {sensor['nroSensor']} actualizado a 'active'")
                    prev_med = med
                    continue

                # --- CASO ESPECIAL: Primera medición nueva ---
                if first_iter:
                    # Si hay una alerta offline abierta y el sensor estaba marcado OFFLINE, cerrarla
                    alerta_abierta = q_alerta_abierta_offline(mongo, sensor["nroSensor"], id_empresa)
                    print(f"[DEBUG] Alerta abierta offline para sensor {sensor['nroSensor']} - {sensor.get('estado')}: {alerta_abierta}")
                    if sensor.get('estado') in ("OFFLINE", "inactive") and alerta_abierta:
                        inicio = alerta_abierta["fechaHoraAlerta"]
                        duracion = (fecha_actual - inicio).total_seconds() / 60
                        duracion = round(duracion, 1)
                        updateDuracion(mongo, alerta_abierta["_id"], duracion)
                        print(f"✅ ALERTA OFFLINE cerrada duración {duracion:.1f} min")
                        updateStatus(mongo, sensor["nroSensor"], id_empresa, "active")
                        print(f"🔄 Estado del sensor {sensor['nroSensor']} actualizado a 'active'")
                    # No hacemos `continue`: seguimos y procesamos puerta/temp usando prev_med (que puede venir de BD)
                    first_iter = False

                # --- ALERTA OFFLINE ---
                if prev_med:
                    try:
                        offline_alertas = _alerta_offline(mongo, sensor, prev_med, fecha_actual, id_empresa)
                        print(f"[DEBUG] Alertas offline generadas: {offline_alertas}")
                        total_alertas_generadas += offline_alertas
                    except Exception as e:
                        print(f"[ERROR] Fallo en _alerta_offline para sensor {nro_sensor}: {e}")

                # --- ALERTA PUERTA ---
                puerta_estado = med.get("puerta")  # 0 cerrado, 1 abierto
                try:
                    puerta_abierta_previa, alertas_puerta = _alerta_puerta(
                        mongo, sensor, puerta_estado, puerta_abierta_previa, fecha_actual, id_empresa
                    )
                    print(f"[DEBUG] Alertas puerta abierta prolongada generadas: {alertas_puerta}")
                    total_alertas_generadas += alertas_puerta
                except Exception as e:
                    print(f"[ERROR] Fallo en _alerta_puerta para sensor {nro_sensor}: {e}")
            
                # --- ALERTA TEMPERATURA FUERA DE RANGO + CICLO ---
                try:
                    temp = float(med.get("valorTempInt"))
                    print(f"[DEBUG] Temperatura interna: {temp}")
                except (TypeError, ValueError):
                    print("[DEBUG] Medición sin temperatura válida, se salta.")
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
                        try:
                            en_ciclo, inicio_ciclo,  alertas_generadas_ciclo= _alerta_ciclo_asincronico(
                                mongo, sensor, en_ciclo, inicio_ciclo, temp, valor_min, valor_max, fecha_actual, id_empresa
                            )
                            print(f"[DEBUG] Alertas ciclos generadas: {alertas_generadas_ciclo}")
                            total_alertas_generadas += alertas_generadas_ciclo
                        except Exception as e:
                            print(f"[ERROR] Fallo en _alerta_ciclo_asincronico para sensor {nro_sensor}: {e}")
                    try:
                        # Alerta temp fuera de rango
                        total_alertas_generadas += _alerta_temp_fuera_rango(mongo, sensor, temp, valor_min, valor_max, fecha_actual, id_empresa)
                    except Exception as e:
                        print(f"[ERROR] Fallo en _alerta_temp_fuera_rango para sensor {nro_sensor}: {e}")

                prev_med = med    

            # 6️⃣ Actualizar checkpoint con la última medición analizada
            last_med = mediciones[-1]
            update_checkpoint(mongo, id_empresa, nro_sensor, "critica", last_med["fechaHoraMed"])
            
        except Exception as e:
            print(f"[ERROR] Fallo al procesar el sensor {nro_sensor}: {e}")
            continue

    return total_alertas_generadas  # Retorna la cantidad de alertas agregadas


def _obtener_emails_asignados(mongo, nro_sensor, criticidad):
    """Obtiene los emails de los usuarios asignados a un sensor
    y que desean recibir ese tipo de alerta"""
    asignaciones = list(mongo.db.asignaciones.find({
        "idSensor": nro_sensor,
        "estadoAsignacion": "Activo"
    }))
    emails = []
    print(f"[DEBUG] Asignaciones encontradas: {len(asignaciones)} para sensor {nro_sensor} con criticidad {criticidad}")
    for a in asignaciones:
        print(f"[DEBUG] Asignación encontrada: {a}")
        usuario = mongo.db.usuarios.find_one({"_id": ObjectId(a["idUsuario"])})
        print(f"[DEBUG] Usuario encontrado: {usuario}")
        if usuario and usuario.get("email"):
            prefs = usuario.get("notificacionesAlertas", {})
            print(f"[DEBUG] Preferencias de notificación: {prefs}")
            # criticidad puede ser "Crítica", "Preventiva", etc. --> AQUI 
            crit_key = criticidad.lower().replace("í", "i").replace("á", "a")
            if prefs.get(crit_key, False):
                emails.append(usuario["email"])
    return emails

def _enviar_mail_alerta(emails, tipo_alerta, descripcion, criticidad, sensor, mensaje, fecha, termi):
    fecha_actual_local = fecha - timedelta(hours=3)
    fecha_actual = fecha_actual_local.strftime('%Y-%m-%d %H:%M:%S')
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
        .image-footer {{ text-align: center; margin-top: 20px; }} /* Estilo para centrar la imagen */
        .image-footer img {{ width: 200px; height: 200px; display: block; margin: 0 auto; }} /* Asegura que la imagen sea responsiva y centrada */
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
            <span class="label">Fecha y hora:</span> {fecha_actual} hs
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
         <!-- Imagen agregada aquí -->
        <div class="image-footer">
            <img src="https://sensia.onrender.com/assets/{termi}.png">
        </div>
    </div>
    </body>
    </html>
    """

    # Obtener el cliente de la API de Mailjet de la configuración de la app
    mailjet = current_app.config['MAILJET_CLIENT']
    
    # Obtener el email del remitente de la configuración de la app
    sender_email = current_app.config['MAIL_FROM_EMAIL']

    recipients = [{"Email": email, "Name": "Destinatario"} for email in emails]

    # Crear la carga útil (payload) para la API
    data = {
        'Messages': [
            {
                "From": {
                    "Email": sender_email,
                    "Name": "SensIA"
                },
                "To": recipients,
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
            print(recipients)
            return jsonify({"message": f"Se envió un correo de alerta a {recipients}"}), 200
        else:
            return jsonify({"error": f"Error al enviar el correo: {result.json()}"}), 500
    except Exception as e:
        # Captura cualquier excepción de red o de la librería
        return jsonify({"error": f"Error de conexión: {str(e)}"}), 500

def _enviar_mail_alerta_seguridad(emails, tipo_alerta, descripcion, criticidad, usuario, mensaje, fecha, termi):
    subject = f"[ALERTA] {tipo_alerta} - Usuario: {usuario}"
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
        .image-footer {{ text-align: center; margin-top: 20px; }} /* Estilo para centrar la imagen */
        .image-footer img {{ width: 200px; height: 200px; display: block; margin: 0 auto; }} /* Asegura que la imagen sea responsiva y centrada */
    </style>
    </head>
    <body>
    <div class="container">
        <h2>⚠️ Alerta en SensIA</h2>
        <div class="info">
            <span class="label">Usuario:</span> {usuario}
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
         <!-- Imagen agregada aquí -->
        <div class="image-footer">
            <img src="https://sensia.onrender.com/assets/{termi}.png">
        </div>
    </div>
    </body>
    </html>
    """
    # Obtener el cliente de la API de Mailjet de la configuración de la app
    mailjet = current_app.config['MAILJET_CLIENT']
    
    # Obtener el email del remitente de la configuración de la app
    sender_email = current_app.config['MAIL_FROM_EMAIL']

    recipients = [{"Email": email, "Name": "Destinatario"} for email in emails]

    # Crear la carga útil (payload) para la API
    data = {
        'Messages': [
            {
                "From": {
                    "Email": sender_email,
                    "Name": "SensIA"
                },
                "To": recipients,
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
            print(recipients)
            return jsonify({"message": f"Se envió un correo de alerta de seguridad a {recipients}"}), 200
        else:
            return jsonify({"error": f"Error al enviar el correo: {result.json()}"}), 500
    except Exception as e:
        # Captura cualquier excepción de red o de la librería
        return jsonify({"error": f"Error de conexión: {str(e)}"}), 500

def _alerta_acceso_nocturno(mongo, email, hora_local_dt, usuario):
    now = datetime.utcnow()
    alerta_data = {
            "tipoAlerta": "Acceso Nocturno",
            "mensajeAlerta": "Inicio de sesión nocturno",
            "criticidad": "Seguridad",
            "descripcion": f"Inicio de sesión nocturno detectado para el usuario {email} a las {hora_local_dt.strftime('%H:%M')}:00.",
            "fechaHoraAlerta": now,
            "idUsuario": str(usuario['_id']) if usuario else None,
            "idEmpresa": usuario.get('idEmpresa') if usuario else None
        }
    # Insertar alerta en la base
    insert_alerta(mongo, alerta_data)
    # Obtener emails de admins de la empresa
    emails_admins = []
    if usuario and usuario.get('idEmpresa'):
        emails_admins = get_super_admins_by_criticidad(mongo, usuario.get('idEmpresa') ,"seguridad")

    # Enviar mail
    if emails_admins:
        _enviar_mail_alerta_seguridad(
            emails_admins,
            tipo_alerta="Inicio de sesión nocturno",
            descripcion=alerta_data["descripcion"],
            criticidad="Seguridad",
            usuario= email,
            mensaje=alerta_data["descripcion"],
            fecha=hora_local_dt.strftime('%H:%M'),
            termi="termi-alerta"
        )
    ### Fin de alerta de inicio de sesión nocturno

def _alerta_bloqueo_cuenta(mongo, email, usuario):
    now = datetime.utcnow()
    alerta_data = {
            "tipoAlerta": "Bloqueo de Usuario",
            "mensajeAlerta": "Usuario bloqueado por intentos fallidos",
            "criticidad": "Seguridad",
            "descripcion": f"El usuario {email} ha sido bloqueado por 3 intentos fallidos de inicio de sesión.",
            "fechaHoraAlerta": now,
            "idUsuario": str(usuario['_id']),
            "idEmpresa": usuario.get('idEmpresa')
        }
    insert_alerta(mongo, alerta_data) # Inserta la alerta

    # Obtener emails de admins para notificar el bloqueo
    emails_admins = []
    if usuario and usuario.get('idEmpresa'):
        emails_admins = get_super_admins_by_criticidad(mongo, usuario.get('idEmpresa'), "seguridad")

    hora_local_dt = now - timedelta(hours=3)  # Ajusta a tu zona
    if emails_admins:
        _enviar_mail_alerta_seguridad(
            emails_admins,
            tipo_alerta="Bloqueo de usuario",
            descripcion=alerta_data["descripcion"],
            criticidad="Seguridad",
            usuario=email,
            mensaje=alerta_data["descripcion"],
            fecha=hora_local_dt.strftime('%H:%M'),  # Ajusta a tu zona,
            termi="termi-alerta"
        )
    ## Fin de alerta de bloqueo de usuario


def _alerta_offline(mongo, sensor, prev_med, fecha_actual, id_empresa):
    """Detecta huecos de tiempo sin mediciones"""

    # 1) Buscar la última alerta offline abierta
    alerta_abierta = q_alerta_abierta_offline(mongo, sensor["nroSensor"], id_empresa)

    gap = fecha_actual - prev_med["fechaHoraMed"]
    if gap >= timedelta(minutes=10):
        print(f"⚠️ ALERTA: sensor {sensor['nroSensor']} sin mediciones por {gap}")

        # Definir la zona horaria de Buenos Aires
        tz_buenos_aires = pytz.timezone('America/Argentina/Buenos_Aires')

        # Convertir las fechas UTC a la zona horaria de Buenos Aires
        fecha_med_local = prev_med['fechaHoraMed'].astimezone(tz_buenos_aires)
        fecha_actual_local = fecha_actual.astimezone(tz_buenos_aires)
        
        # Formatear las fechas a un formato legible de 24 horas (ej. 2025-09-20 10:30)
        fecha_med_str = fecha_med_local.strftime('%Y-%m-%d %H:%M:%S')
        fecha_actual_str = fecha_actual_local.strftime('%Y-%m-%d %H:%M:%S')

        # Si NO hay una alerta abierta, es la primera vez que se detecta el problema.
        if not alerta_abierta:

            alerta_data = {
                "idSensor": str(sensor["nroSensor"]),
                "idEmpresa": id_empresa,
                "criticidad": "Crítica",
                "tipoAlerta": "Sensor offline",
                "descripcion": f"El sensor {sensor['nroSensor']} no envió datos entre {fecha_med_str} hs y {fecha_actual_str} hs.",
                "mensajeAlerta": "Sensor offline (sin mediciones)",
                "fechaHoraAlerta": fecha_actual,
                "duracionMinutos": None,
                "estadoAlerta": "abierta"
            }
            print(f"[DEBUG] Insertando alerta: {alerta_data}")
            alerta_id = insert_alerta(mongo, alerta_data)
            print(f"✅ Alerta offline para sensor {sensor['nroSensor']} -> ID {alerta_id}")

            # 🔹 Actualizar estado del sensor a inactive
            updateStatus(mongo, sensor["nroSensor"], id_empresa, "inactive")
            
            print(f"🔄 Estado del sensor {sensor['nroSensor']} actualizado a 'inactive'")

            # Obtener los emails de los usuarios asignados y de los superadmins
            emails_asignados = _obtener_emails_asignados(mongo, sensor["nroSensor"], alerta_data["criticidad"])
            emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "critica")
            
            # Unir ambas listas de emails y eliminar duplicados
            emails = list(set(emails_asignados + emails_super_admins))

            print(f"[DEBUG] Emails asignados para alerta: {emails}")
            if emails:
                print(f"[DEBUG] Enviando mail de alerta a: {emails}")
                _enviar_mail_alerta(
                    emails,
                    "Sensor offline",
                    alerta_data["descripcion"], 
                    "Crítica", 
                    sensor, 
                    alerta_data["mensajeAlerta"], 
                    fecha_actual,
                    "termi-alerta"
                )
            return 1  # ⚠️ Devuelve 1 si se insertó una alerta
        else:
            # Si ya hay una alerta abierta, no hacemos nada y devolvemos 0
            print(f"La alerta offline para el sensor {sensor['nroSensor']} ya está activa.")
            # Reconstruir la descripción con la fecha_med_str original y la nueva fecha_actual_str
            nueva_descripcion = f"El sensor {sensor['nroSensor']} no envió datos entre {fecha_med_local} hs y {fecha_actual_str} hs."
            # Actualizar solo el campo descripcion en la alerta abierta
            update_description_offline(mongo, alerta_abierta["_id"], nueva_descripcion)
            return 0
    else: # El sensor está online (con mediciones recientes)
        # Si había una alerta abierta, la cerramos
        if alerta_abierta:
            inicio = alerta_abierta["fechaHoraAlerta"]
            duracion = (fecha_actual - inicio).total_seconds() / 60
            duracion = round(duracion, 1)
            nueva_descripcion = f"El sensor {sensor['nroSensor']} no envió datos entre {fecha_med_local} hs y {fecha_actual_str} hs."

            # Actualizar la alerta con la duración y descripcion
            updateDuracion(mongo, alerta_abierta["_id"], duracion)
            update_description_offline(mongo, alerta_abierta["_id"], nueva_descripcion)
            print(f"✅ ALERTA OFFLINE cerrada duración {duracion:.1f} min y descripción: {nueva_descripcion}")

            # Actualizar estado del sensor a active
            updateStatus(mongo, sensor["nroSensor"], id_empresa, "active")
            print(f"🔄 Estado del sensor {sensor['nroSensor']} actualizado a 'active'")
        return 0  # Devuelve 0 si no se insertó alerta

def _alerta_puerta(mongo, sensor, puerta_estado, puerta_abierta_previa, fecha_actual, id_empresa):
    """Detecta puerta abierta prolongada: dispara tras 10 minutos de puerta abierta.
    - Persistimos 'puertaInicio' en el documento del sensor para que la marca sobreviva entre ejecuciones.
    - Devuelve (nuevo_puerta_abierta_previa, alertas_generadas)
    """
    alertas_generadas = 0

     # Normalizar/forzar puerta_estado a 0/1
    try:
        if isinstance(puerta_estado, (bool, int)):
            puerta_estado = 1 if puerta_estado else 0
        else:
            puerta_estado = 1 if str(puerta_estado).strip().lower() in ("1", "true", "t", "yes", "y") else 0
    except Exception:
        puerta_estado = 0

    # Asegurar fecha_actual aware (usar UTC si es naive)
    if fecha_actual is not None and getattr(fecha_actual, "tzinfo", None) is None:
        fecha_actual = fecha_actual.replace(tzinfo=pytz.UTC)

    # Leer posible inicio persistido en BD (si existe)
    persisted_inicio = None
    try:
        doc = get_sensor_by_nro(mongo, sensor["nroSensor"], id_empresa)
        if doc and doc.get("puertaInicio"):
            persisted_inicio = doc.get("puertaInicio")
            # Si está almacenado como naive, marcar UTC
            if getattr(persisted_inicio, "tzinfo", None) is None:
                persisted_inicio = persisted_inicio.replace(tzinfo=pytz.UTC)
    except Exception as ex:
        print(f"[WARN] No se pudo leer puertaInicio en BD para sensor {sensor['nroSensor']}: {ex}")
    
    # Si no nos pasan un inicio en memoria, usar el persistido
    if not puerta_abierta_previa and persisted_inicio:
        puerta_abierta_previa = persisted_inicio

    # Caso: puerta abierta ahora
    if puerta_estado == 1:
        # Si no teníamos marca de inicio en memoria ni en BD, la registramos (persistimos)
        if not puerta_abierta_previa:
            try:
                # Persistir inicio en la colección sensors
                update_puerta_inicio(mongo, sensor["nroSensor"], id_empresa, fecha_actual)  
                print(f"[DEBUG][_alerta_puerta] Persistido puertaInicio={fecha_actual} para sensor {sensor['nroSensor']}")
            except Exception as ex:
                print(f"[WARN] No se pudo persistir puertaInicio para sensor {sensor['nroSensor']}: {ex}")
            return fecha_actual, 0

        # Ya había inicio: comprobar tiempo transcurrido
        elapsed = fecha_actual - puerta_abierta_previa
        elapsed_min = elapsed.total_seconds() / 60 if elapsed else 0
        print(f"[DEBUG][_alerta_puerta] elapsed={elapsed} (~{elapsed_min:.1f} min) para sensor {sensor['nroSensor']}")
        if elapsed >= timedelta(minutes=10):
            print(f"⚠️ ALERTA: puerta abierta ≥10 min en sensor {sensor['nroSensor']} (duración {elapsed})")

            alerta_abierta = q_alerta_abierta_puerta(mongo, sensor["nroSensor"], id_empresa)

            if not alerta_abierta:
                # Crear alerta usando la fecha de inicio (persistida/en memoria)
                tz_ba = pytz.timezone('America/Argentina/Buenos_Aires')
                inicio_local = puerta_abierta_previa.astimezone(tz_ba) if hasattr(puerta_abierta_previa, "astimezone") else puerta_abierta_previa
                inicio_str = inicio_local.strftime('%Y-%m-%d %H:%M:%S')

                alerta_data = {
                    "idSensor": str(sensor["nroSensor"]),
                    "idEmpresa": id_empresa,
                    "criticidad": "Crítica",
                    "tipoAlerta": "Puerta abierta prolongada",
                    "descripcion": f"Puerta abierta ≥10 min en sensor {sensor['nroSensor']} (desde {inicio_str}). Riesgo de pérdida de frío.",
                    "mensajeAlerta": "Puerta abierta prolongada",
                    "fechaHoraAlerta": puerta_abierta_previa,
                    "estadoAlerta": "abierta"
                }
                print(f"[DEBUG] Insertando alerta: {alerta_data}")
                alerta_id = insert_alerta(mongo, alerta_data)
                print(f"✅ Alerta puerta abierta en sensor {sensor['nroSensor']} -> ID {alerta_id}")
                alertas_generadas = 1

                emails_asignados = _obtener_emails_asignados(mongo, sensor["nroSensor"], alerta_data["criticidad"])
                emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "critica")
                emails = list(set(emails_asignados + emails_super_admins))

                print(f"[DEBUG] Emails asignados para alerta: {emails}")
                if emails:
                    _enviar_mail_alerta(
                        emails,
                        "Puerta abierta prolongada",
                        alerta_data["descripcion"],
                        "Crítica",
                        sensor,
                        alerta_data["mensajeAlerta"],
                        fecha_actual,
                        "termi-alerta"
                    )
            else:
                # Alerta ya abierta: actualizar descripción opcional
                try:
                    tz_ba = pytz.timezone('America/Argentina/Buenos_Aires')
                    inicio = alerta_abierta.get("fechaHoraAlerta")
                    inicio_local = inicio.astimezone(tz_ba) if hasattr(inicio, "astimezone") else inicio
                    actual_local = fecha_actual.astimezone(tz_ba) if hasattr(fecha_actual, "astimezone") else fecha_actual
                    inicio_str = inicio_local.strftime('%Y-%m-%d %H:%M:%S')
                    actual_str = actual_local.strftime('%Y-%m-%d %H:%M:%S')
                    nueva_descripcion = f"Puerta abierta ≥10 min en sensor {sensor['nroSensor']} (desde {inicio_str} hasta {actual_str}). Riesgo de pérdida de frío."
                    update_description_offline(mongo, alerta_abierta["_id"], nueva_descripcion)
                    print(f"[DEBUG] Actualizada descripción alerta puerta {alerta_abierta['_id']}: {nueva_descripcion}")
                except Exception as ex:
                    print(f"[ERROR] No se pudo actualizar descripción de alerta puerta {alerta_abierta.get('_id')}: {ex}")

        # Mantener la marca de inicio mientras siga abierta
        return puerta_abierta_previa, alertas_generadas

    # Caso: puerta cerrada ahora
    else:
        # Si antes teníamos inicio (persistido o en memoria), cerrar alerta si existe y limpiar persistencia
        if puerta_abierta_previa or persisted_inicio:
            print(f"[DEBUG] Puerta cerrada sensor {sensor['nroSensor']} - inicio anterior: {puerta_abierta_previa or persisted_inicio}, cierre: {fecha_actual}")

            alerta_abierta = q_alerta_abierta_puerta(mongo, sensor["nroSensor"], id_empresa)
            if alerta_abierta:
                inicio = alerta_abierta["fechaHoraAlerta"]
                duracion = (fecha_actual - inicio).total_seconds() / 60
                inicio = alerta_abierta.get("fechaHoraAlerta")
                # Asegurar que 'inicio' sea timezone-aware (asumir UTC si es naive)
                if inicio is None:
                    print(f"[WARN] Alerta abierta sin fechaHoraAlerta para {alerta_abierta.get('_id')}")
                    duracion = 0
                else:
                    if getattr(inicio, "tzinfo", None) is None:
                        inicio = inicio.replace(tzinfo=pytz.UTC)
                    duracion = (fecha_actual - inicio).total_seconds() / 60
                duracion = round(duracion, 1)
                updateDuracion(mongo, alerta_abierta["_id"], duracion)
                print(f"✅ ALERTA PUERTA cerrada duración {duracion:.1f} min para sensor {sensor['nroSensor']}")

            # Eliminar campo puertaInicio del documento sensor
            try:
                update_puerta_inicio_unset(mongo, sensor["nroSensor"], id_empresa)
                print(f"[DEBUG] Eliminado puertaInicio para sensor {sensor['nroSensor']}")
            except Exception as ex:
                print(f"[WARN] No se pudo eliminar puertaInicio para sensor {sensor['nroSensor']}: {ex}")

            return False, 0

        # No había inicio marcado: nada que hacer
        return False, 0


def _alerta_temp_fuera_rango(mongo, sensor, temp, valor_min, valor_max, fecha_actual, id_empresa):
    """Detecta temperatura fuera de rango"""

    # 1) Buscar la última alerta abierta una única vez
    alerta_abierta = q_alerta_abierta_temp(mongo, sensor["nroSensor"], id_empresa)

    print(f"[DEBUG] Alerta abierta temp para sensor {sensor['nroSensor']}: {alerta_abierta}")

    # 2) ¿Está la temperatura fuera de rango?
    if temp > valor_max or temp < valor_min:
        print(f"⚠️ ALERTA: temp={temp}°C fuera de rango ({valor_min}, {valor_max}) para sensor {sensor['nroSensor']}")
        
        # Generar mensaje y descripción
        if temp > valor_max:
            mensaje = "Temperatura interna alta"
            descripcion = f"La temperatura actual ({temp}°C) excede el límite superior ({valor_max}°C) para el sensor {sensor['nroSensor']}."
        else:
            mensaje = "Temperatura interna baja"
            descripcion = f"La temperatura actual ({temp}°C) está por debajo del límite inferior ({valor_min}°C) para el sensor {sensor['nroSensor']}."

        # Si NO hay una alerta abierta, crearla y mandar mail
        if not alerta_abierta:
            alerta_data = {
                "idSensor": str(sensor["nroSensor"]),
                "idEmpresa": id_empresa,
                "criticidad": "Crítica",
                "tipoAlerta": "Temperatura fuera de rango",
                "descripcion": descripcion,
                "mensajeAlerta": mensaje,
                "fechaHoraAlerta": fecha_actual,
                "duracionMinutos": None,
                "estadoAlerta": "abierta"
            }
            print(f"[DEBUG] Insertando alerta: {alerta_data}")
            alerta_id = insert_alerta(mongo, alerta_data)
            print(f"✅ Alerta temp fuera de rango en sensor {sensor['nroSensor']} -> ID {alerta_id}")

            emails_asignados = _obtener_emails_asignados(mongo, sensor["nroSensor"], alerta_data["criticidad"])
            emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "critica")    
            # Unir ambas listas de emails y eliminar duplicados --> AQUI
            emails = list(set(emails_asignados + emails_super_admins))

            if emails:
                _enviar_mail_alerta(
                    emails, 
                    "Temperatura fuera de rango", 
                    alerta_data["descripcion"], 
                    "Crítica", 
                    sensor, 
                    alerta_data["mensajeAlerta"], 
                    fecha_actual,
                    "termi-alerta"
                )
            return 1 # Devuelve 1 si se insertó una alerta
        else:
            # Si SÍ hay una alerta abierta, no hacemos nada y devolvemos 0
            print(f"La alerta para el sensor {sensor['nroSensor']} ya está activa.")
            return 0
    else: # La temperatura está dentro del rango
        # 3) Si el sensor vuelve al rango y hay una alerta abierta, la cerramos
        if alerta_abierta:
            inicio = alerta_abierta["fechaHoraAlerta"]
            duracion = (fecha_actual - inicio).total_seconds() / 60
            duracion = round(duracion, 1)

            updateDuracion(mongo, alerta_abierta["_id"], duracion)
            print(f"✅ ALERTA TEMP cerrada duración {duracion:.1f} min")

        # Si no hay alerta abierta, no pasa nada
        return 0


def _alerta_ciclo_asincronico(mongo, sensor, en_ciclo, inicio_ciclo, temp, valor_min, valor_max, fecha_actual, id_empresa):
    """Detecta ciclo de refrigeramiento asincrónico"""
    if en_ciclo and (fecha_actual - inicio_ciclo) >= timedelta(minutes=15):
        alerta_data = {
            "idSensor": str(sensor["nroSensor"]), # ⚠️ Convertir a string
            "idEmpresa": id_empresa,
            "criticidad": "Crítica",
            "tipoAlerta": "Ciclo de refrigeramiento asincrónico",
            "descripcion": f"La temperatura no retornó al rango seguro ({valor_min}°C-{valor_max}°C) tras un ciclo de descongelamiento.",
            "mensajeAlerta": "Ciclo asincrónico detectado",
            "fechaHoraAlerta": fecha_actual
        }
        print(f"[DEBUG] Insertando alerta: {alerta_data}")
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta ciclo asincrónico en sensor {sensor['nroSensor']} -> ID {alerta_id}")

        emails_asignados = _obtener_emails_asignados(mongo, sensor["nroSensor"],alerta_data["criticidad"])
        emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "critica")    
        # Unir ambas listas de emails y eliminar duplicados
        emails = list(set(emails_asignados + emails_super_admins))
        
        print(f"[DEBUG] Emails asignados para alerta: {emails}")
        if emails:
            _enviar_mail_alerta(
                emails, 
                "Ciclo de refrigeramiento asincrónico", 
                alerta_data["descripcion"], 
                "Crítica", 
                sensor, 
                alerta_data["mensajeAlerta"], 
                fecha_actual,
                "termi-alerta"
            )
        return False, None, 1  # reset ciclo, ⚠️ Devuelve el estado, inicio y el contador
    return en_ciclo, inicio_ciclo, 0 #⚠️ Devuelve el estado, inicio y el contador


def chequear_alertas_preventivas(mongo, id_empresa):
    """
    Función principal para analizar las alertas preventivas
    """
    total_alertas_generadas = 0
    sensores = get_all_sensors_empresa(mongo,id_empresa)
    print(f"[DEBUG] Empresa {id_empresa} - Sensores encontrados: {len(sensores)}")

    if not sensores:
        return 0

    # Agrupar sensores por dirección para evitar duplicados
    direcciones_procesadas = set()
    for sensor in sensores:
        print(f"[DEBUG] Procesando sensor: {sensor['nroSensor']}")
        #Validación de caida de energía
        direccion = sensor.get("direccion")
        if direccion and direccion not in direcciones_procesadas:
            total_alertas_generadas += _alerta_caida_energia(mongo, sensor, id_empresa)
            direcciones_procesadas.add(direccion)

        print(f"[DEBUG] Total alertas generadas hasta ahora (caida_energia): {total_alertas_generadas}")
        nro_sensor = sensor["nroSensor"]
        valor_min = sensor.get("valorMin")
        valor_max = sensor.get("valorMax")

        print(f"[DEBUG] Sensor {nro_sensor} - Rango de temperatura ({valor_min}, {valor_max})")

        # 1️⃣ Obtener checkpoint de preventivas
        checkpoint = get_checkpoint(mongo, id_empresa, nro_sensor, "preventiva")
        
        last_date = checkpoint["fechaUltimaAnalizada"] if checkpoint else None

        print(f"[DEBUG] Checkpoint para sensor {nro_sensor}: {last_date}")

         # 2️⃣ Obtener mediciones nuevas (no analizadas desde el checkpoint)
        mediciones = get_mediciones(mongo, nro_sensor, last_date)

        print(f"[DEBUG] Sensor {sensor['nroSensor']} - Mediciones encontradas: {len(mediciones)}")

        if not mediciones:
            continue

        if len(mediciones) < 3:
            continue  # Necesitamos varias mediciones para detectar fluctuaciones

        # Analizar fluctuaciones
        total_alertas_generadas += _alerta_fluctuacion_temp(mongo, sensor, mediciones, valor_min, valor_max, id_empresa)

        print(f"[DEBUG] Total alertas generadas hasta ahora (fluctuacion_temp): {total_alertas_generadas}")

        # Alerta de puerta abierta recurrente
        total_alertas_generadas += _alerta_puerta_recurrente(mongo, sensor, id_empresa)

        print(f"[DEBUG] Total alertas generadas hasta ahora (puerta_recurrente): {total_alertas_generadas}")

        # 3️⃣ Actualizar checkpoint
        update_checkpoint(mongo, id_empresa, nro_sensor, "preventiva", mediciones[-1]["fechaHoraMed"])
    
    return total_alertas_generadas # Retorna la cantidad de mediciones analizadas




def _alerta_fluctuacion_temp(mongo, sensor, mediciones, valor_min, valor_max, id_empresa):
    """Detecta oscilaciones abruptas en un periodo corto (ej. 1 hora)"""
    nro_sensor = sensor["nroSensor"]

    if not mediciones:
        print(f"[DEBUG] Sensor {nro_sensor} - Temperaturas alerta_fluctuacion_temp: {mediciones}")
        return 0
    
    # Calcular min y max de las últimas mediciones
    temps = [float(m["valorTempInt"]) for m in mediciones if m.get("valorTempInt") is not None]

    print(f"[DEBUG] Sensor {nro_sensor} - Temperaturas analizadas: {temps}")
    if not temps:
        return 0

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
            "idSensor": str(sensor["nroSensor"]), # ⚠️ Convertir a string
            "idEmpresa": id_empresa,
            "criticidad": "Preventiva",
            "tipoAlerta": "Fluctuación de temperatura excesiva",
            "descripcion": f"Oscilaciones de temperatura mayores a {margen_permitido}°C en 1h. Delta: {delta:.2f}°C.",
            "mensajeAlerta": "Fluctuación de temperatura excesiva",
            "fechaHoraAlerta": mediciones[-1]["fechaHoraMed"]
        }
        print(f"[DEBUG] Insertando alerta: {alerta_data}")
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta preventiva insertada para sensor {nro_sensor} -> ID {alerta_id}")

        # 3️⃣ Notificar
        emails_asignados = _obtener_emails_asignados(mongo, nro_sensor, alerta_data["criticidad"])
        emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "preventiva")    
        # Unir ambas listas de emails y eliminar duplicados
        emails = list(set(emails_asignados + emails_super_admins))

        print(f"[DEBUG] Emails asignados para alerta: {emails}")
        if emails:
            _enviar_mail_alerta(
                emails=emails,
                tipo_alerta="Fluctuación de temperatura excesiva",
                descripcion=alerta_data["descripcion"],
                criticidad="Preventiva",
                sensor=sensor,
                mensaje="Oscilaciones de temperatura detectadas",
                fecha=mediciones[-1]["fechaHoraMed"],
                termi="termi-inteligente"
            )
        return 1  # ⚠️ Devuelve 1 si se insertó una alerta
    return 0  # ⚠️ Devuelve 0 si no se insertó alerta

def _alerta_puerta_recurrente(mongo, sensor, id_empresa, max_repeticiones=5):
    """
    Genera alerta preventiva si el sensor tiene más de 5 alertas de puerta abierta prolongada
    en el mismo día.
    """
    nro_sensor = sensor["nroSensor"]
    hoy_inicio = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Buscar alertas críticas de puerta abierta prolongada de hoy
    count_alertas = get_alertas_puerta_abierta( mongo, id_empresa, nro_sensor, hoy_inicio)

    if count_alertas >= max_repeticiones:
        print(f"⚠️ ALERTA PREVENTIVA: puerta abierta recurrente (sensor {nro_sensor})")

        alerta_data = {
            "idSensor": str(sensor["nroSensor"]), # ⚠️ Convertir a string
            "idEmpresa": id_empresa,
            "criticidad": "Preventiva",
            "tipoAlerta": "Puerta abierta recurrente",
            "descripcion": f"Más de {max_repeticiones} alertas de puerta abierta prolongada en el día para el sensor {nro_sensor}.",
            "mensajeAlerta": "Patrón recurrente de puerta abierta",
            "fechaHoraAlerta": datetime.utcnow()
        }

        # Insertar alerta
        print(f"[DEBUG] Insertando alerta: {alerta_data}")
        alerta_id = insert_alerta(mongo, alerta_data)
        print(f"✅ Alerta preventiva (puerta recurrente) insertada -> ID {alerta_id}")

        # Notificar por mail
        emails_asignados = _obtener_emails_asignados(mongo, nro_sensor, alerta_data["criticidad"])
        emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "preventiva")    
        # Unir ambas listas de emails y eliminar duplicados
        emails = list(set(emails_asignados + emails_super_admins))

        print(f"[DEBUG] Emails asignados para alerta: {emails}")
        if emails:
            _enviar_mail_alerta(
                emails=emails,
                tipo_alerta="Puerta abierta recurrente",
                descripcion=alerta_data["descripcion"],
                criticidad="Preventiva",
                sensor=sensor,
                mensaje="Patrón recurrente de puerta abierta",
                fecha=alerta_data["fechaHoraAlerta"],
                termi="termi-inteligente"
            )
        return 1  # ⚠️ Devuelve 1 si se insertó una alerta
    return 0  # ⚠️ Devuelve 0 si no se insertó alerta

def _alerta_caida_energia(mongo, sensor, id_empresa):
    """
    Genera alerta preventiva si todos los sensores de la misma dirección
    están inactivos -> posible caída de energía eléctrica.
    """
    direccion = sensor.get("direccion")
    print(f"[DEBUG] Verificando caída de energía para sensor {sensor['nroSensor']} en dirección {direccion}")
    if not direccion:
        return 0

    # Buscar sensores de la misma dirección
    sensores_misma_dir = list(mongo.db.sensors.find({
        "idEmpresa": id_empresa,
        "direccion": direccion
    }))
    print(f"[DEBUG] Sensores en la misma dirección ({direccion}): {len(sensores_misma_dir)}")
    if not sensores_misma_dir:
        return 0

    # Buscar si ya existe una alerta pendiente
    alerta_existente = get_alerta_caida_energia_abierta(mongo, id_empresa, direccion)

    # 1. Caso: Todos los sensores están inactivos
    if all(s["estado"] == "inactive" for s in sensores_misma_dir):
        if not alerta_existente:
            # Si no existe una alerta pendiente, se crea una nueva.
            print(f"⚠️ ALERTA PREVENTIVA: Caída de energía en dirección {direccion}")

            # Se recopilan los números de todos los sensores inactivos en una lista
            sensores_inactivos = [str(s["nroSensor"]) for s in sensores_misma_dir]

            # === Lógica para la descripción dinámica ===
            cantidad_sensores = len(sensores_inactivos)
            sensores_str = ", ".join(sensores_inactivos)

            if cantidad_sensores == 1:
                descripcion_alerta = f"Se detectó una posible interrupción del servicio eléctrico en la dirección {direccion}. El sensor ({sensores_str}) se encuentra inactivo."
            else:
                descripcion_alerta = f"Se detectó una posible interrupción del servicio eléctrico en la dirección {direccion}. Los {cantidad_sensores} sensores ({sensores_str}) se encuentran inactivos."

            alerta_data = {
                "idSensor": sensores_inactivos,
                "idEmpresa": id_empresa,
                "criticidad": "Preventiva",
                "tipoAlerta": "Caída de energía eléctrica",
                "descripcion": descripcion_alerta,
                "mensajeAlerta": "Caída de energía eléctrica",
                "fechaHoraAlerta": datetime.utcnow(),
                "estadoAlerta": "abierta",
                "direccion": direccion,
            }

            print(f"[DEBUG] Insertando alerta: {alerta_data}")
            alerta_id = insert_alerta(mongo, alerta_data)
            print(f"✅ Alerta preventiva (caída energía) insertada -> ID {alerta_id}")

            # Obtener emails de todos los sensores de la dirección para enviar notificación
            emails = []
            for s in sensores_misma_dir:
                emails.extend(_obtener_emails_asignados(mongo, s["nroSensor"], alerta_data["criticidad"]))
            emails_asignados = list(set(emails))

            emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "preventiva")    
            # Unir ambas listas de emails y eliminar duplicados
            emails = list(set(emails_asignados + emails_super_admins))

            if emails:
                _enviar_mail_alerta(
                    emails=emails,
                    tipo_alerta="Caída de energía eléctrica",
                    descripcion=alerta_data["descripcion"],
                    criticidad="Preventiva",
                    sensor=sensor,
                    mensaje=f"Caída de energía eléctrica en la sucursal: {direccion}",
                    fecha=alerta_data["fechaHoraAlerta"],
                    termi="termi-inteligente"
                )
            return 1 # Devuelve 1 si se insertó una alerta
        else:
            print(f"[DEBUG] Ya existe alerta pendiente: {alerta_existente['_id']}, no se crea otra.")
            return 0

    # 2. Caso: Al menos un sensor está activo
    # Este 'else' se ejecuta si la condición anterior no se cumple.
    # Es decir, si no todos los sensores están inactivos.
    else:
        if alerta_existente:
            print(f"✅ Se detectó al menos un sensor activo. Cerrando alerta pendiente: {alerta_existente['_id']}.")
            
            # Calcular la duración de la alerta
            inicio = alerta_existente["fechaHoraAlerta"]
            duracion = (datetime.now() - inicio).total_seconds() / 60
            duracion = round(duracion, 1)

            # Actualizar la duración en la base de datos
            updateDuracion(mongo, alerta_existente["_id"], duracion)
            
            print(f"✅ Alerta de caída de energía cerrada en dirección {direccion}")
            return 0
        else:
            print(f"[DEBUG] Sensores activos y no hay alerta pendiente para cerrar.")
            return 0

def chequear_alertas_informativas(mongo, id_empresa):
    total_alertas_generadas = 0
    sensores = get_all_sensors_empresa(mongo,id_empresa)
    if not sensores:
        return 0

    for sensor in sensores:
        nro_sensor = sensor["nroSensor"]

        notas = sensor.get("notas", "").lower()

        parametros = _obtener_parametros_ciclo(notas)
        if not parametros:
            continue

        # 2️⃣ Obtener checkpoint
        checkpoint = get_checkpoint(mongo, id_empresa, nro_sensor, "informativas")
        
        last_date = checkpoint["fechaUltimaAnalizada"] if checkpoint else None
        en_ciclo = checkpoint.get("enCiclo") if checkpoint else False
        fecha_inicio_ciclo = checkpoint.get("fechaInicioCiclo") if checkpoint else None
        temp_max_ciclo = checkpoint["tempMaxCiclo"] if checkpoint else None

        # 3️⃣ Obtener mediciones nuevas (sin analizar desde el ultimo checkpoint)
        mediciones = get_mediciones(mongo, nro_sensor, last_date)

        if not mediciones:
            continue

        # 4️⃣ Analizar mediciones
        for med in mediciones:
            fecha_actual = med["fechaHoraMed"]
            
            try:
                temp = float(med.get("valorTempInt"))
            except (TypeError, ValueError):
                last_date = fecha_actual
                continue

            valor_min = sensor.get("valorMin")
            valor_max = sensor.get("valorMax")

            en_ciclo, fecha_inicio_ciclo, temp_max_ciclo,alertas_generadas  = _alerta_inicio_fin_ciclo(
                mongo, sensor, id_empresa, temp, valor_min, valor_max,
                parametros, en_ciclo, fecha_inicio_ciclo, temp_max_ciclo,
                fecha_actual, last_date
            )
            total_alertas_generadas += alertas_generadas
            last_date = fecha_actual

        # 5️⃣ Actualizar checkpoint
        last_med = mediciones[-1]
        update_checkpoint_informativas(mongo, id_empresa, nro_sensor, last_med, en_ciclo, fecha_inicio_ciclo, temp_max_ciclo)
        
    return total_alertas_generadas  # Retorna la cantidad de mediciones analizadas


def _alerta_inicio_fin_ciclo(mongo, sensor, id_empresa, temp, valor_min, valor_max,
                             parametros, en_ciclo, fecha_inicio_ciclo, temp_max_ciclo,
                             fecha_actual, last_date):
    """Gestiona el inicio y fin de ciclos de descongelamiento"""
    duracion_min = parametros["duracion_min"]
    duracion_max = parametros["duracion_max"]
    incremento_max = parametros["incremento_max"]

    alertas_generadas = 0

       # Si ya está en ciclo, verificar interrupciones
    if en_ciclo and last_date and fecha_actual - last_date > timedelta(minutes=10):
        en_ciclo = False
        fecha_inicio_ciclo = None
        temp_max_ciclo = None
        return en_ciclo, fecha_inicio_ciclo, temp_max_ciclo, alertas_generadas

    # Inicio potencial
    if not en_ciclo and temp > valor_max:
        en_ciclo = True
        fecha_inicio_ciclo = fecha_actual
        temp_max_ciclo = temp

    # Fin válido
    elif en_ciclo and valor_min <= temp <= valor_max:
        duracion = (fecha_actual - fecha_inicio_ciclo).total_seconds() / 60

        if duracion >= duracion_min:
            anormal = duracion > duracion_max or (temp_max_ciclo - temp) > incremento_max

            tz_buenos_aires = pytz.timezone('America/Argentina/Buenos_Aires')
            fecha_inicio_ciclo_local = fecha_inicio_ciclo.astimezone(tz_buenos_aires)
            fecha_inicio_ciclo_str = fecha_inicio_ciclo_local.strftime('%Y-%m-%d %H:%M:%S')
            
            # Alertas de inicio y fin

            alerta_data = {
                "idSensor": str(sensor["nroSensor"]), # ⚠️ Convertir a string
                "idEmpresa": id_empresa,
                "criticidad": "Informativa",
                "tipoAlerta": "Inicio de ciclo de descongelamiento",
                "descripcion": f"El sensor {sensor['nroSensor']} inició el ciclo de descongelamiento a las {fecha_inicio_ciclo_str}.",
                "mensajeAlerta": "Inicio de ciclo de descongelamiento",
                "fechaHoraAlerta": fecha_inicio_ciclo
            }
            print(f"[DEBUG] Insertando alerta: {alerta_data}")
            alerta_id = insert_alerta(mongo, alerta_data)
            print(f"⚠️Alerta inicio ciclo para sensor {sensor['nroSensor']} -> ID {alerta_id} con fecha {fecha_inicio_ciclo}")

            # Notificar por mail
            emails_asignados = _obtener_emails_asignados(mongo, sensor["nroSensor"], alerta_data["criticidad"])
            emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "informativa")    
            # Unir ambas listas de emails y eliminar duplicados
            emails = list(set(emails_asignados + emails_super_admins))

            _enviar_mail_alerta(
                emails= emails,
                tipo_alerta="Inicio de ciclo de descongelamiento",
                descripcion=alerta_data["descripcion"],
                criticidad="Informativa",
                sensor=sensor,
                mensaje="Inicio de ciclo",
                fecha=fecha_inicio_ciclo,
                termi="termi-informativo"
            )

            alertas_generadas += 1

            descripcion_fin = (
                f"El sensor {sensor['nroSensor']} finalizó el ciclo de descongelamiento. "
                f"Duración: {duracion:.1f} min."
            )
            if anormal:
                descripcion_fin += " ⚠️ ANORMAL: fuera de los parámetros esperados."


            # Insertar alerta de fin de ciclo
            alerta_data = {
                "idSensor": str(sensor["nroSensor"]), # ⚠️ Convertir a string
                "idEmpresa": id_empresa,
                "criticidad": "Informativa",
                "tipoAlerta": "Fin de ciclo de descongelamiento",
                "descripcion": descripcion_fin,
                "mensajeAlerta": "Fin de ciclo de descongelamiento",
                "fechaHoraAlerta": fecha_actual
            }
            print(f"[DEBUG] Insertando alerta: {alerta_data}")
            alerta_id = insert_alerta(mongo, alerta_data)
            print(f"⚠️ Alerta fin ciclo para sensor {sensor['nroSensor']} -> ID {alerta_id} con fecha {fecha_actual}")

            # Notificar por mail
            emails_asignados = _obtener_emails_asignados(mongo, sensor["nroSensor"], alerta_data["criticidad"])
            emails_super_admins = get_super_admins_by_criticidad(mongo, id_empresa, "informativa")    
            # Unir ambas listas de emails y eliminar duplicados
            emails = list(set(emails_asignados + emails_super_admins))

            _enviar_mail_alerta(
                emails= emails,
                tipo_alerta="Fin de ciclo de descongelamiento",
                descripcion=descripcion_fin,
                criticidad="Informativa",
                sensor=sensor,
                mensaje="Fin de ciclo" + (" ⚠️ ANORMAL" if anormal else ""),
                fecha=fecha_actual,
                termi="termi-informativo"
            )
            alertas_generadas += 1

        # Resetear variables
        en_ciclo = False
        fecha_inicio_ciclo = None
        temp_max_ciclo = None

    return en_ciclo, fecha_inicio_ciclo, temp_max_ciclo, alertas_generadas

def _obtener_parametros_ciclo(notas):
    if "congelados" in notas:
        return {"duracion_min": 20, "duracion_max": 40, "incremento_max": 8}
    if "helados" in notas:
        return {"duracion_min": 20, "duracion_max": 30, "incremento_max": 8}
    if "carnes frescas" in notas:
        return {"duracion_min": 15, "duracion_max": 25, "incremento_max": 6}
    if "frutas" in notas or "verduras" in notas:
        return {"duracion_min": 10, "duracion_max": 20, "incremento_max": 5}
    return None