import os

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

from app import routes
