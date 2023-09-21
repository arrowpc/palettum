from flask import Flask, request, send_from_directory
import os
import cv2
import palettum

app = Flask(__name__)

UPLOAD_FOLDER = "uploads/"
PROCESSED_FOLDER = "processed/"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["PROCESSED_FOLDER"] = PROCESSED_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)


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


if __name__ == "__main__":
    app.run(debug=True)
