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


def test_missing_image(client):
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(palette_path, "rb") as palette:
        response = client.post("/upload", data={"palette": palette})
    assert response.status_code == 400
    assert b"No image provided" in response.data


def test_missing_palette(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    with open(image_path, "rb") as img:
        response = client.post("/upload", data={"image": img})
    assert response.status_code == 400
    assert b"No palette provided" in response.data


def test_invalid_image_format(client):
    image_path = os.path.join(current_dir, "test_images", "invalid.txt")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        response = client.post("/upload", data={"image": img, "palette": palette})
    assert response.status_code == 400
    assert b"Uploaded file is not an image" in response.data


def test_invalid_palette_format(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    invalid_palette_path = os.path.join(current_dir, "test_palettes", "invalid.txt")
    with open(image_path, "rb") as img, open(invalid_palette_path, "rb") as palette:
        response = client.post("/upload", data={"image": img, "palette": palette})
    assert response.status_code == 400
    assert (
        b"Invalid palette format. Please provide a valid RGB palette." in response.data
    )


def test_upload_image_with_resizing_height_only(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        response = client.post(
            "/upload", data={"image": img, "palette": palette, "height": 200}
        )
    assert response.status_code == 200
    image = Image.open(io.BytesIO(response.data))
    assert image.format == "PNG"
    assert image.height == 200


def test_negative_dimensions(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        response = client.post(
            "/upload", data={"image": img, "palette": palette, "width": -300}
        )
    assert response.status_code == 400
    assert b"Width must be a positive value." in response.data


def test_palette_not_in_range(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    invalid_palette_path = os.path.join(current_dir, "test_palettes", "range.txt")
    with open(image_path, "rb") as img, open(
        invalid_palette_path, "rb"
    ) as invalid_palette:
        response = client.post(
            "/upload", data={"image": img, "palette": invalid_palette}
        )
    assert response.status_code == 400
    assert (
        b"Invalid RGB values in palette. Each value must be in the range [0, 255]."
        in response.data
    )


def test_upload_image_with_contrast_adjustment(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    contrast_value = 2.0

    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        response = client.post(
            "/upload",
            data={"image": img, "palette": palette, "contrast": contrast_value},
        )

    assert response.status_code == 200

    image = Image.open(io.BytesIO(response.data))
    assert image.format == "PNG"


def test_upload_image_with_invalid_contrast(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    invalid_contrast_values = [0]
    with open(image_path, "rb") as img, open(palette_path, "rb") as palette:
        response = client.post(
            "/upload",
            data={"image": img, "palette": palette, "contrast": contrast_value},
        )

        assert response.status_code == 400
        assert b"Contrast must" in response.data
