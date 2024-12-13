import io

from app import app
from flask import jsonify, request, send_file

import palettum

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
                value in RGB_RANGE
                for value in [color.red(), color.green(), color.blue()]
            ):
                raise ValueError(
                    "Invalid RGB values in palette. Each value must be in the range [0, 255]."
                )

        return palette

    except UnicodeDecodeError as e:
        raise ValueError("Palette file must be a text file containing RGB values")
    except Exception as e:
        print(f"Other error: {type(e)}, {str(e)}")
        raise


def resize_image(img, width, height):
    if width and not height:
        aspect_ratio = img.height() / img.width()
        height = int(aspect_ratio * width)
    elif height and not width:
        aspect_ratio = img.width() / img.height()
        width = int(aspect_ratio * height)

    if width and height:
        if width <= 0 or height <= 0:
            raise ValueError("Invalid dimensions after aspect ratio calculation.")
        img.resize(width, height)

    return img


@app.route("/upload", methods=["POST"])
def upload_image():
    try:
        if "image" not in request.files:
            return "No image provided", 400
        if "palette" not in request.files:
            return "No palette provided", 400

        image = request.files["image"]
        palette_file = request.files["palette"]

        validate_image_content_type(image)

        print("Reading palette...")
        palette = parse_palette(palette_file)
        print(f"Palette parsed successfully, got {len(palette)} colors")

        print("Reading image...")

        img_data = memoryview(image.read())

        try:
            img = palettum.Image(img_data)
            print("Image loaded successfully")
        except RuntimeError as e:
            print(f"Image loading error: {e}")
            return jsonify(error=str(e)), 400

        width = request.form.get("width", type=int)
        height = request.form.get("height", type=int)
        print(f"Resize parameters: width={width}, height={height}")

        if width is not None and width <= 0:
            return jsonify(error="Width must be a positive value."), 400
        if height is not None and height <= 0:
            return jsonify(error="Height must be a positive value."), 400

        img = resize_image(img, width, height)
        print("Image resized successfully")

        print("Converting to palette...")
        result = palettum.Palettum.convertToPalette(img, palette)
        print("Conversion complete")

        print("Writing result...")
        png_data = result.write()
        if not png_data:
            raise ValueError("Failed to encode the processed image.")

        print("Sending response...")
        io_buf = io.BytesIO(bytes(png_data))
        return send_file(io_buf, mimetype="image/png")

    except Exception as e:
        print(f"Error in upload_image: {type(e).__name__}: {str(e)}")
        return jsonify(error=str(e)), 400
