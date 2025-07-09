from functools import wraps
from flask import request, jsonify
import jwt
import os

SECRET_KEY_TOKEN = os.getenv("SECRET_KEY_TOKEN")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        if not token:
            return jsonify({'error': 'Token requerido'}), 401
        try:
            data = jwt.decode(token, SECRET_KEY_TOKEN, algorithms=["HS256"])
            # Puedes agregar más validaciones aquí (roles, expiración, etc.)
        except Exception as e:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        return f(*args, **kwargs)
    return decorated