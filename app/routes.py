from flask import jsonify, request, send_file
import cv2
import io
import numpy as np
import palettum
from app import app

VALID_IMAGE_PREFIX = "image/"
RGB_RANGE = range(256)


@app.errorhandler(ValueError)
def handle_value_error(error):
    return jsonify(error=str(error)), 400


@app.errorhandler(400)
def bad_request(error):
    return jsonify(error="Bad request"), 400


@app.route("/")
def index():
    return "Welcome to Palettum API!"


def validate_image_content_type(image):
    if not image.content_type.startswith(VALID_IMAGE_PREFIX):
        raise ValueError("Uploaded file is not an image")


def parse_palette(palette_file):
    palette_lines = palette_file.read().decode("utf-8").splitlines()
    try:
        palette = [eval(color) for color in palette_lines]
        if not all(isinstance(color, tuple) and len(color) == 3 for color in palette):
            raise ValueError
    except (SyntaxError, ValueError):
        raise ValueError("Invalid palette format. Please provide a valid RGB palette.")

    for color in palette:
        if not all(value in RGB_RANGE for value in color):
            raise ValueError(
                "Invalid RGB values in palette. Each value must be in the range [0, 255]."
            )

    return palette


def resize_image(img, width, height):
    original_height, original_width = img.shape[:2]

    if width and not height:
        aspect_ratio = original_height / original_width
        height = int(aspect_ratio * width)
    elif height and not width:
        aspect_ratio = original_width / original_height
        width = int(aspect_ratio * height)

    if width and height:
        if width <= 0 or height <= 0:
            raise ValueError("Invalid dimensions after aspect ratio calculation.")
        img = cv2.resize(img, (width, height))

    return img


@app.route("/upload", methods=["POST"])
def upload_image():
    if "image" not in request.files:
        return "No image provided", 400
    if "palette" not in request.files:
        return "No palette provided", 400

    image = request.files["image"]
    palette_file = request.files["palette"]

    validate_image_content_type(image)
    palette = parse_palette(palette_file)

    img_stream = io.BytesIO(image.read())
    img = cv2.imdecode(np.frombuffer(img_stream.read(), np.uint8), 1)

    if img is None:
        raise ValueError(
            "Failed to decode the image. Please provide a valid image format."
        )

    width = request.form.get("width", type=int)
    height = request.form.get("height", type=int)

    if width is not None and width <= 0:
        return jsonify(error="Width must be a positive value."), 400
    if height is not None and height <= 0:
        return jsonify(error="Height must be a positive value."), 400

    img = resize_image(img, width, height)

    img = resize_image(img, width, height)

    p = palettum.Palettum(img, palette)
    result = p.convertToPalette()

    is_success, buffer = cv2.imencode(".png", result)
    if not is_success:
        raise ValueError("Failed to encode the processed image.")

    io_buf = io.BytesIO(buffer)
    return send_file(io_buf, mimetype="image/png")
