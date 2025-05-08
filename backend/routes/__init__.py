from flask import Blueprint

# Create a blueprint for the routes
main = Blueprint('main', __name__)

# Import route handlers
from . import example_routes  # Assuming there are route handlers defined in example_routes.py