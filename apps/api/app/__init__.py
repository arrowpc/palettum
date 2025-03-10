import logging
import os
import sys

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)


if os.getenv("FLASK_ENV") == "production":
    CORS(app, resources={r"/*": {"origins": os.getenv("ALLOWED_ORIGINS", "")}})
else:
    CORS(app)

app.config["ENV"] = os.getenv("FLASK_ENV", "production")


is_gunicorn = "gunicorn" in sys.modules

if is_gunicorn:
    gunicorn_logger = logging.getLogger("gunicorn.error")
    app.logger.handlers = gunicorn_logger.handlers
    app.logger.setLevel(gunicorn_logger.level)
else:
    default_logger = logging.getLogger(__name__)
    app.logger.handlers = default_logger.handlers
    app.logger.setLevel(default_logger.level)

from app import routes
