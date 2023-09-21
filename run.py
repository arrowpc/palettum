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
    image = request.files["image"]

    image_path = os.path.join(app.config["UPLOAD_FOLDER"], image.filename)
    image.save(image_path)

    img = cv2.imread(image_path)
    palette = [
        (190, 0, 57),
        (255, 69, 0),
        (255, 168, 0),
        (255, 214, 53),
        (0, 163, 104),
        (0, 204, 120),
        (126, 237, 86),
        (0, 117, 111),
        (0, 158, 170),
        (36, 80, 164),
        (54, 144, 234),
        (81, 233, 244),
        (73, 58, 193),
        (106, 92, 255),
        (129, 30, 159),
        (180, 74, 192),
        (255, 56, 129),
        (255, 153, 170),
        (109, 72, 47),
        (156, 105, 38),
        (0, 0, 0),
        (137, 141, 144),
        (212, 215, 217),
        (255, 255, 255),
    ]

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
