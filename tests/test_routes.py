import os
from PIL import Image
import io

current_dir = os.path.dirname(os.path.abspath(__file__))


def test_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Welcome to Palettum API!" in response.data


def test_upload_image_with_default_palette(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        response = client.post("/upload", data={"image": img, "palette": palette})

    assert response.status_code == 200

    image = Image.open(io.BytesIO(response.data))
    assert image.format == "PNG"


def test_upload_image_with_resizing(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        response = client.post(
            "/upload", data={"image": img, "palette": palette, "width": 300}
        )

    assert response.status_code == 200

    image = Image.open(io.BytesIO(response.data))
    assert image.format == "PNG"
    assert image.width == 300
