from flask import Blueprint, current_app, session, request, jsonify
from controllers.usuario_controller import (
    get_usuarios_controller,
    usuario_actual_controller,
    register_usuario_controller,
    invite_user_controller,
    complete_registration_controller,
    login_usuario_controller,
    get_ultimas_conexiones_controller,
    solicitar_reset_password_controller,
    reset_password_controller
)
from utils.auth import token_required

usuario_bp = Blueprint('usuario_bp', __name__)

@usuario_bp.route('/usuarios', methods=['GET'])
@token_required
def get_usuarios():
    mongo = current_app.mongo
    return get_usuarios_controller(mongo)

@usuario_bp.route('/usuario_actual', methods=['GET', 'PUT'])
@token_required
def usuario_actual_route():
    mongo = current_app.mongo
    return usuario_actual_controller(mongo)

@usuario_bp.route('/usuario', methods=['POST'])
def register_usuario_route():
    mongo = current_app.mongo
    return register_usuario_controller(mongo)

@usuario_bp.route('/invite_user', methods=['POST'])
@token_required
def invite_user_route():
    mongo = current_app.mongo
    return invite_user_controller(mongo)

@usuario_bp.route('/complete_registration', methods=['POST'])
def complete_registration_route():
    mongo = current_app.mongo
    return complete_registration_controller(mongo)

@usuario_bp.route('/login', methods=['POST'])
def login_usuario_route():
    mongo = current_app.mongo
    return login_usuario_controller(mongo)

@usuario_bp.route('/ultimas_conexiones', methods=['GET'])
@token_required
def ultimas_conexiones_route():
    mongo = current_app.mongo
    return get_ultimas_conexiones_controller(mongo)

@usuario_bp.route('/solicitar_reset_password', methods=['POST'])
def solicitar_reset_password():
    mongo = current_app.mongo
    return solicitar_reset_password_controller(mongo)

@usuario_bp.route('/reset_password', methods=['POST'])
def reset_password():
    mongo = current_app.mongo
    return reset_password_controller(mongo)