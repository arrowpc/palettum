from flask import jsonify, request, send_file
from app import app
import cv2
import palettum
import io
import numpy as np


@app.errorhandler(ValueError)
def handle_value_error(error):
    return jsonify(error=str(error)), 400


@app.errorhandler(400)
def bad_request(error):
    return jsonify(error="Bad request"), 400


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

    if not image.content_type.startswith("image/"):
        raise ValueError("Uploaded file is not an image")

    palette_lines = palette_file.read().decode("utf-8").splitlines()
    try:
        palette = [eval(color) for color in palette_lines]
        if not all(isinstance(color, tuple) and len(color) == 3 for color in palette):
            raise ValueError
    except (SyntaxError, ValueError):
        raise ValueError("Invalid palette format. Please provide a valid RGB palette.")

    img_stream = io.BytesIO(image.read())
    img = cv2.imdecode(np.frombuffer(img_stream.read(), np.uint8), 1)

    if img is None:
        raise ValueError(
            "Failed to decode the image. Please provide a valid image format."
        )

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
    if not is_success:
        raise ValueError("Failed to encode the processed image.")

    io_buf = io.BytesIO(buffer)

    return send_file(io_buf, mimetype="image/png")
