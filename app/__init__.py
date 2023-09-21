from flask import Flask
import os

app = Flask(__name__)

UPLOAD_FOLDER = "uploads/"
PROCESSED_FOLDER = "processed/"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["PROCESSED_FOLDER"] = PROCESSED_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

from app import routes
