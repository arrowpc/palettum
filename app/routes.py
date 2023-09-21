from app import app
from flask import request, send_file
import cv2
import palettum
import io
import numpy as np


@app.route("/")
def index():
    return "Welcome to Palettum API!"


@app.route("/upload", methods=["POST"])
def upload_image():
    if "image" not in request.files:
        return "No image provided", 400
    if "palette" not in request.files:
        return "No palette provided", 400

    image = request.files["image"]
    palette_file = request.files["palette"]

    palette_lines = palette_file.read().decode("utf-8").splitlines()
    palette = [eval(color) for color in palette_lines]

    img_stream = io.BytesIO(image.read())
    img = cv2.imdecode(np.frombuffer(img_stream.read(), np.uint8), 1)

    width = request.form.get("width", type=int)
    height = request.form.get("height", type=int)

    original_height, original_width = img.shape[:2]

    if width and not height:
        aspect_ratio = original_height / original_width
        height = int(aspect_ratio * width)

    elif height and not width:
        aspect_ratio = original_width / original_height
        width = int(aspect_ratio * height)

    if width and height:
        img = cv2.resize(img, (width, height))

    p = palettum.Palettum(img, palette)
    result = p.convertToPalette()

    is_success, buffer = cv2.imencode(".png", result)
    io_buf = io.BytesIO(buffer)

    return send_file(io_buf, mimetype="image/png")
