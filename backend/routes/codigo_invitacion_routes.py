from flask import Blueprint, current_app, request, jsonify
from controllers.codigo_invitacion_controller import verificar_codigo_controller
from models.codigo_invitacion import marcar_codigo_usado

codigo_bp = Blueprint('codigo_bp', __name__)

# usuarios.js
@codigo_bp.route('/verificar-codigo', methods=['POST'])
def verificar_codigo_route():
    mongo = current_app.mongo
    return verificar_codigo_controller(mongo)

@codigo_bp.route('/marcar-codigo-usado', methods=['POST'])
def marcar_codigo_usado_route():
    mongo = current_app.mongo
    data = request.json
    mailUsuario = data.get("mailUsuario")
    codigo = data.get("codigo")
    if not mailUsuario or not codigo:
        return jsonify({"ok": False, "motivo": "Faltan datos"}), 400
    marcar_codigo_usado(mongo, mailUsuario, codigo)
    return jsonify({"ok": True}), 200
