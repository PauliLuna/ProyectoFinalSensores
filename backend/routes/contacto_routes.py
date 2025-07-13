from flask import Blueprint, request, current_app
from controllers.contacto_controller import handle_contact_submission

contacto_bp = Blueprint('contacto', __name__)

@contacto_bp.route('/contacto', methods=['POST'])
def submit_form():
    data = request.get_json()
    mongo = current_app.mongo
    mail = current_app.mail
    app = current_app
    return handle_contact_submission(mongo, mail, app, data)