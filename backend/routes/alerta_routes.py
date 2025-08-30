from flask import Blueprint, request, session, current_app, jsonify
from controllers.usuario_controller import get_usuario_by_id
from controllers.alerta_controller import (
    obtener_alertas, 
    nueva_alerta, 
    chequear_alertas_criticas,
    chequear_alertas_preventivas,
    chequear_alertas_informativas,
    obtener_alertas_por_sensor
)

from utils.auth import token_required


alerta_bp = Blueprint('alertas', __name__)

@alerta_bp.route('/alertas', methods=['GET'])
@token_required
def get_alertas():
    mongo = current_app.mongo
    sensor_id = request.args.get('sensor_id')
    if sensor_id:
        return obtener_alertas_por_sensor(mongo, sensor_id)
    else:
        return obtener_alertas(mongo)
    
@alerta_bp.route('/alertas_por_mes', methods=['GET'])
@token_required
def alertas_por_mes():
    mongo = current_app.mongo
    id_empresa = session.get("idEmpresa")
    pipeline = [
        {"$match": {"idEmpresa": id_empresa}},
        {"$group": {
            "_id": {"year": {"$year": "$fechaHoraAlerta"}, "month": {"$month": "$fechaHoraAlerta"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.year": -1, "_id.month": -1}}
    ]
    result = list(mongo.db.alertas.aggregate(pipeline))
    return jsonify(result), 200

@alerta_bp.route('/promedio_fuera_rango', methods=['GET'])
@token_required
def promedio_fuera_rango():
    mongo = current_app.mongo
    id_empresa = session.get("idEmpresa")
    alertas = list(mongo.db.alertas.find({
        "idEmpresa": id_empresa,
        "tipoAlerta": "Temperatura fuera de rango"
    }))
    total_min = 0
    count = 0
    for alerta in alertas:
        duracion = alerta.get("duracionMinutos")  # Debe estar en minutos
        if duracion:
            total_min += duracion
            count += 1
    promedio = (total_min / count) if count else 0
    return jsonify({"promedio": promedio}), 200

@alerta_bp.route('/promedio_offline', methods=['GET'])
@token_required
def promedio_offline():
    mongo = current_app.mongo
    id_empresa = session.get("idEmpresa")
    alertas = list(mongo.db.alertas.find({
        "idEmpresa": id_empresa,
        "tipoAlerta": "Sensor offline"
    }))
    total_min = 0
    count = 0
    for alerta in alertas:
        duracion = alerta.get("duracionMinutos")  # Debe estar en minutos
        if duracion:
            total_min += duracion
            count += 1
    promedio = (total_min / count) if count else 0
    return jsonify({"promedio": promedio}), 200

@alerta_bp.route('/alertas', methods=['POST'])
@token_required
def post_alerta():
    mongo = current_app.mongo
    return nueva_alerta(mongo)


@alerta_bp.route('/reanalizar_alertas', methods=['POST'])
@token_required
def reanalizar_alertas_api():
    mongo = current_app.mongo
    user_id = session.get('user_id')
    usuario = get_usuario_by_id(mongo, user_id)
    id_empresa = usuario.get('idEmpresa')
    nuevas_criticas = chequear_alertas_criticas(mongo, id_empresa)
    nuevas_preventivas = chequear_alertas_preventivas(mongo, id_empresa)
    nuevas_informativas = chequear_alertas_informativas(mongo, id_empresa)
    total_nuevas = (nuevas_criticas or 0) + (nuevas_preventivas or 0) + (nuevas_informativas or 0)
    if total_nuevas == 0:
        return jsonify({"message": "Alertas reanalizadas correctamente. No se detectaron nuevas alertas."}), 200
    else:
        return jsonify({"message": f"Alertas reanalizadas correctamente. Se detectaron {total_nuevas} nuevas alertas."}), 200


