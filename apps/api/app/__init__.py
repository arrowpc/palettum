import logging
import os
import sys

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv()

app = Flask(__name__)
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="memory://",
    strategy="fixed-window",
)


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
