import os

import palettum

current_dir = os.path.dirname(os.path.abspath(__file__))


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
        response = client.post("/upload", data=data, content_type="multipart/form-data")

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
        response = client.post("/upload", data=data, content_type="multipart/form-data")

    assert response.status_code == 200
    result_image = palettum.Image(memoryview(response.data))
    assert result_image.width() == 300


def test_missing_image(client):
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(palette_path, "rb") as palette:
        data = {"palette": (palette, "default.txt", "text/plain")}
        response = client.post("/upload", data=data, content_type="multipart/form-data")
    assert response.status_code == 400
    assert b"No image provided" in response.data


def test_missing_palette(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    with open(image_path, "rb") as img:
        data = {"image": (img, "test.jpeg", "image/jpeg")}
        response = client.post("/upload", data=data, content_type="multipart/form-data")
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
        response = client.post("/upload", data=data, content_type="multipart/form-data")
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
        response = client.post("/upload", data=data, content_type="multipart/form-data")
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
        response = client.post("/upload", data=data, content_type="multipart/form-data")
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
        response = client.post("/upload", data=data, content_type="multipart/form-data")
    assert response.status_code == 400
    assert b"Width must be positive" in response.data


def test_palette_not_in_range(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    invalid_palette_path = os.path.join(current_dir, "test_palettes", "range.txt")
    with open(image_path, "rb") as img, open(invalid_palette_path, "rb") as palette:
        data = {
            "image": (img, "test.jpeg", "image/jpeg"),
            "palette": (palette, "range.txt", "text/plain"),
        }
        response = client.post("/upload", data=data, content_type="multipart/form-data")
    assert response.status_code == 400
    assert b"incompatible constructor arguments" in response.data
