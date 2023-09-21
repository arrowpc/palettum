from app import app
from flask import request, send_from_directory
import os
import cv2
import palettum


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

    image_path = os.path.join(app.config["UPLOAD_FOLDER"], image.filename)
    image.save(image_path)
    img = cv2.imread(image_path)

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

    processed_image_name = os.path.splitext(image.filename)[0] + ".png"
    processed_image_path = os.path.join(
        app.config["PROCESSED_FOLDER"], processed_image_name
    )
    cv2.imwrite(processed_image_path, result)

    return "Image processed successfully!"


@app.route("/processed/<filename>")
def processed_image(filename):
    """Endpoint to serve the processed images"""
    return send_from_directory(app.config["PROCESSED_FOLDER"], filename)
