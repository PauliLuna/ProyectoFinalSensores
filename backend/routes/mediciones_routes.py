import os
from flask import Blueprint, request, jsonify, current_app
from controllers.mediciones_controller import generar_mediciones

mediciones_bp = Blueprint("mediciones_bp", __name__)

MED_TOKEN = os.getenv("MEDICIONES_SECRET_TOKEN", "cambia-esto")

