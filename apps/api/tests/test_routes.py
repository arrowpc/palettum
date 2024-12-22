import os
import sys

from dotenv import load_dotenv

import palettum

current_dir = os.path.dirname(os.path.abspath(__file__))

parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

load_dotenv(os.path.join(parent_dir, ".env"))


def add_api_key(client, data=None, api_key=None):
    if data is None:
        data = {}
    headers = {"X-API-Key": api_key or os.getenv("API_KEY")}
    return headers


def test_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Welcome to Palettum API!" in response.data


def test_upload_image_with_default_palette(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "default.txt", "text/plain"),
        }
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )

    assert response.status_code == 200
    result_image = palettum.Image(memoryview(response.data))
    assert result_image.width() > 0
    assert result_image.height() > 0
    assert result_image.channels() == 3


def test_upload_image_with_resizing(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "default.txt", "text/plain"),
            "width": "300",
        }
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )

    assert response.status_code == 200
    result_image = palettum.Image(memoryview(response.data))
    assert result_image.width() == 300


def test_missing_api_key(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "default.txt", "text/plain"),
        }
        response = client.post("/upload", data=data, content_type="multipart/form-data")

    assert response.status_code == 401
    assert b"No API key provided" in response.data


def test_invalid_api_key(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "default.txt", "text/plain"),
        }
        headers = {"X-API-Key": "incorrect_key"}
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )

    assert response.status_code == 401
    assert b"Invalid API key" in response.data


def test_missing_image(client):
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(palette_path, "rb") as palette:
        data = {"palette": (palette, "default.txt", "text/plain")}
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )
    assert response.status_code == 400
    assert b"No image provided" in response.data


def test_missing_palette(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    with open(image_path, "rb") as img:
        data = {"image": (img, "test.jpeg", "image/jpeg")}
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )
    assert response.status_code == 400
    assert b"No palette provided" in response.data


def test_invalid_image_format(client):
    image_path = os.path.join(current_dir, "test_images", "invalid.txt")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        data = {
            "image": (img, "invalid.txt", "text/plain"),
            "palette": (palette, "default.txt", "text/plain"),
        }
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )
    assert response.status_code == 400
    assert b"Uploaded file is not an image" in response.data


def test_invalid_palette_format(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    invalid_palette_path = os.path.join(current_dir, "test_palettes", "invalid.txt")
    with open(image_path, "rb") as img, open(invalid_palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "invalid.txt", "text/plain"),
        }
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )
    assert response.status_code == 400
    assert b"too many values to unpack" in response.data


def test_upload_image_with_resizing_height_only(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "default.txt", "text/plain"),
            "height": "200",
        }
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )
    assert response.status_code == 200
    result_image = palettum.Image(memoryview(response.data))
    assert result_image.height() == 200


def test_negative_dimensions(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "default.txt", "text/plain"),
            "width": "-300",
        }
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )
    assert response.status_code == 400
    assert b"Width must be a positive value" in response.data


def test_palette_not_in_range(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    invalid_palette_path = os.path.join(current_dir, "test_palettes", "range.txt")
    with open(image_path, "rb") as img, open(invalid_palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "range.txt", "text/plain"),
        }
        headers = add_api_key(client)
        response = client.post(
            "/upload", data=data, content_type="multipart/form-data", headers=headers
        )
    assert response.status_code == 400
    assert b"incompatible constructor arguments" in response.data
