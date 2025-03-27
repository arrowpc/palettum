import io
import logging
import time
from functools import wraps

from app import app, limiter
from app.auth import require_api_key
from flask import Response, jsonify, request, send_file

from palettum import GIF, RGB, Config, Formula, Image, Mapping, palettify

VALID_IMAGE_TYPES = {"image/gif", "image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_DIMENSION = 3840
MAX_THRESHOLD = 255
MAX_QUANT_LEVEL = 5
VALID_FORMULAS = {
    "CIEDE2000": Formula.CIEDE2000,
    "CIE94": Formula.CIE94,
    "CIE76": Formula.CIE76,
}


@app.errorhandler(ValueError)
def handle_value_error(error):
    return jsonify(error=str(error)), 400


@app.errorhandler(400)
def bad_request(error):
    return jsonify(error="Bad request"), 400


@app.route("/")
def index():
    return "Welcome to Palettum API!"


@app.route("/health")
def health_check():
    return jsonify({"status": "ok"})


def validate_image_content_type(image):
    if image.content_type not in VALID_IMAGE_TYPES:
        raise ValueError("Uploaded file is not an image")


def validate_dimensions(width: int | None, height: int | None) -> None:
    if width is None and height is None:
        raise ValueError("At least one dimension must be provided")

    if width is not None:
        if width <= 0:
            raise ValueError("Width must be positive")
        if width > MAX_DIMENSION:
            raise ValueError(f"Width cannot exceed {MAX_DIMENSION} pixels")

    if height is not None:
        if height <= 0:
            raise ValueError("Height must be positive")
        if height > MAX_DIMENSION:
            raise ValueError(f"Height cannot exceed {MAX_DIMENSION} pixels")


def validate_threshold(transparent_threshold: int) -> None:
    if transparent_threshold < 0:
        raise ValueError("Transparency threshold must be positive")
    if transparent_threshold > MAX_THRESHOLD:
        raise ValueError(f"Transparency threshold cannot exceed {MAX_THRESHOLD}")


def validate_quant_level(quant_level: int) -> None:
    if quant_level < 0:
        raise ValueError("Quantization level must be nonnegative")
    if quant_level > MAX_QUANT_LEVEL:
        raise ValueError(f"Quantization level cannot exceed {MAX_QUANT_LEVEL}")


def validate_formula(formula: str) -> None:
    if formula not in VALID_FORMULAS:
        raise ValueError("Not a valid formula. Choose from:", VALID_FORMULAS.keys())


def parse_palette(palette_file):
    try:
        content = palette_file.read()
        palette_text = content.decode("utf-8")
        palette_lines = palette_text.splitlines()
        palette = []
        for line in palette_lines:
            r, g, b = eval(line)
            color = RGB(r, g, b)
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
    validate_dimensions(width, height)

    if width and not height:
        aspect_ratio = img.height() / img.width()
        height = int(aspect_ratio * width)
    elif height and not width:
        aspect_ratio = img.width() / img.height()
        width = int(aspect_ratio * height)

    if width and height:
        img.resize(width, height)
    return img


def resize_gif(gif, width, height):
    validate_dimensions(width, height)

    if width and not height:
        aspect_ratio = gif.height() / gif.width()
        height = int(aspect_ratio * width)
    elif height and not width:
        aspect_ratio = gif.width() / gif.height()
        width = int(aspect_ratio * height)

    if width and height:
        gif.resize(width, height)
    return gif


def is_gif(data):
    return len(data) > 3 and data[:3] == b"GIF"


@app.route("/upload", methods=["POST"])
@limiter.limit("30 per hour")
def upload_image():
    try:
        if "image" not in request.files:
            return jsonify(error="No image provided"), 400
        if "palette" not in request.files:
            return jsonify(error="No palette provided"), 400

        image = request.files["image"]
        palette_file = request.files["palette"]
        validate_image_content_type(image)

        app.logger.info("Reading palette...")
        start_time = time.time()
        palette = parse_palette(palette_file)
        palette_time = time.time() - start_time
        app.logger.info(
            f"Palette parsed successfully in {palette_time:.2f}s, got {len(palette)} colors"
        )

        app.logger.info("Reading image...")
        start_time = time.time()
        img_data = memoryview(image.read())
        read_time = time.time() - start_time
        app.logger.info(f"Image read in {read_time:.2f}s")

        width = request.form.get("width", type=int)
        height = request.form.get("height", type=int)

        conf = Config()

        transparent_threshold = request.form.get("transparent_threshold", type=int)
        if transparent_threshold:
            validate_threshold(transparent_threshold)
            conf.transparencyThreshold = transparent_threshold

        quant_level = request.form.get("quant_level", type=int)
        if quant_level:
            validate_quant_level(quant_level)
            conf.quantLevel = quant_level

        formula = request.form.get("formula", type=str)
        if formula:
            validate_formula(formula.upper())
            conf.formula = VALID_FORMULAS[formula.upper()]

        conf.palette = palette

        try:
            if is_gif(img_data):
                app.logger.info("Processing GIF...")
                start_time = time.time()
                gif = GIF(img_data)
                gif_load_time = time.time() - start_time
                app.logger.info(f"GIF loaded in {gif_load_time:.2f}s")

                if width or height:
                    app.logger.info("Resizing GIF...")
                    start_time = time.time()
                    gif = resize_gif(gif, width, height)
                    resize_time = time.time() - start_time
                    app.logger.info(f"GIF resized in {resize_time:.2f}s")

                app.logger.info("Palettifying GIF...")
                start_time = time.time()
                result = palettify(gif, conf)
                palettify_time = time.time() - start_time
                app.logger.info(f"GIF palettified in {palettify_time:.2f}s")

                app.logger.info("Encoding GIF...")
                start_time = time.time()
                gif_data = result.write()
                encode_time = time.time() - start_time
                app.logger.info(f"GIF encoded in {encode_time:.2f}s")

                if not gif_data:
                    raise ValueError("Failed to encode the processed GIF")

                app.logger.info("Sending GIF response...")
                start_time = time.time()
                response = Response(bytes(gif_data), mimetype="image/gif")
                app.logger.info(
                    f"GIF response prepared in {time.time() - start_time:.2f}s"
                )
                return response
            else:
                app.logger.info("Loading static image...")
                start_time = time.time()
                img = Image(img_data)
                load_time = time.time() - start_time
                app.logger.info(f"Static image loaded in {load_time:.2f}s")

                if width or height:
                    app.logger.info("Resizing image...")
                    start_time = time.time()
                    img = resize_image(img, width, height)
                    resize_time = time.time() - start_time
                    app.logger.info(f"Image resized in {resize_time:.2f}s")

                app.logger.info("Palettifying static image...")
                start_time = time.time()
                result = palettify(img, conf)
                palettify_time = time.time() - start_time
                app.logger.info(f"Static image palettified in {palettify_time:.2f}s")

                app.logger.info("Writing PNG response...")
                start_time = time.time()
                png_data = result.write()
                encode_time = time.time() - start_time
                app.logger.info(f"PNG encoded in {encode_time:.2f}s")

                if not png_data:
                    raise ValueError("Failed to encode the processed image")

                app.logger.info("Sending PNG response...")
                start_time = time.time()
                response = Response(bytes(png_data), mimetype="image/png")
                app.logger.info(
                    f"PNG response prepared in {time.time() - start_time:.2f}s"
                )
                return response
        except RuntimeError as e:
            app.logger.error(f"Processing error: {e}")
            return jsonify(error=str(e)), 400

    except Exception as e:
        app.logger.exception("Error in upload_image")
        return jsonify(error=str(e)), 400
