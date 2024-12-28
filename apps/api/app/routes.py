import io
import os
from functools import wraps

from app import app
from flask import jsonify, request, send_file

import palettum

VALID_IMAGE_TYPES = {"image/gif", "image/png", "image/jpeg", "image/jpg"}


def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if os.getenv("FLASK_ENV") == "testing":
            return f(*args, **kwargs)

        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return jsonify({"error": "No API key provided"}), 401

        if api_key != os.getenv("API_KEY"):
            return jsonify({"error": "Invalid API key"}), 401

        return f(*args, **kwargs)

    return decorated


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
    if image.content_type not in VALID_IMAGE_TYPES:
        raise ValueError("Uploaded file is not an image")


def parse_palette(palette_file):
    try:
        content = palette_file.read()
        palette_text = content.decode("utf-8")
        palette_lines = palette_text.splitlines()
        palette = []
        for line in palette_lines:
            r, g, b = eval(line)
            color = palettum.RGB(r, g, b)
            palette.append(color)
        for color in palette:
            if not all(
                0 <= value <= 255
                for value in [color.red(), color.green(), color.blue()]
            ):
                raise ValueError("RGB values must be in range [0, 255]")
        return palette
    except Exception as e:
        raise ValueError(f"Invalid palette format: {str(e)}")


def resize_image(img, width, height):
    if width and not height:
        aspect_ratio = img.height() / img.width()
        height = int(aspect_ratio * width)
    elif height and not width:
        aspect_ratio = img.width() / img.height()
        width = int(aspect_ratio * height)
    if width and height:
        if width <= 0 or height <= 0:
            raise ValueError("Invalid dimensions after aspect ratio calculation")
        img.resize(width, height)
    return img


def is_gif(data):
    return len(data) > 3 and data[:3] == b"GIF"


@app.route("/upload", methods=["POST"])
@require_api_key
def upload_image():
    try:
        if "image" not in request.files:
            return jsonify(error="No image provided"), 400
        if "palette" not in request.files:
            return jsonify(error="No palette provided"), 400

        image = request.files["image"]
        palette_file = request.files["palette"]
        validate_image_content_type(image)

        print("Reading palette...")
        palette = parse_palette(palette_file)
        print(f"Palette parsed successfully, got {len(palette)} colors")

        print("Reading image...")
        img_data = memoryview(image.read())

        width = request.form.get("width", type=int)
        height = request.form.get("height", type=int)

        if width is not None and width <= 0:
            return (
                jsonify(error="Width must be a positive value"),
                400,
            )
        if height is not None and height <= 0:
            return jsonify(error="Height must be a positive value"), 400

        try:
            if is_gif(img_data):
                print("Processing GIF...")
                gif = palettum.GIF(img_data)
                result = palettum.Palettum.convertToPalette(gif, palette)
                gif_data = result.write()

                if not gif_data:
                    raise ValueError("Failed to encode the processed GIF")

                print("Sending GIF response...")
                return send_file(io.BytesIO(bytes(gif_data)), mimetype="image/gif")
            else:
                print("Processing static image...")
                img = palettum.Image(img_data)

                if width or height:
                    img = resize_image(img, width, height)

                result = palettum.Palettum.convertToPalette(img, palette)
                png_data = result.write()

                if not png_data:
                    raise ValueError("Failed to encode the processed image")

                print("Sending PNG response...")
                return send_file(io.BytesIO(bytes(png_data)), mimetype="image/png")

        except RuntimeError as e:
            print(f"Processing error: {e}")
            return jsonify(error=str(e)), 400

    except Exception as e:
        print(f"Error in upload_image: {type(e).__name__}: {str(e)}")
        return jsonify(error=str(e)), 400
