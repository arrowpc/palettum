import os
import io

current_dir = os.path.dirname(os.path.abspath(__file__))


def test_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Welcome to Palettum API!" in response.data


def test_upload_image_with_default_palette(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "r") as palette_file:
        palette_content = palette_file.read().encode("utf-8")
        response = client.post(
            "/upload",
            data={
                "image": img,
                "palette": (io.BytesIO(palette_content), "default.txt"),
            },
        )

    assert response.status_code == 200
    assert b"Image processed successfully!" in response.data


def test_upload_image_with_resizing(client):
    image_path = os.path.join(current_dir, "test_images", "test.jpeg")
    palette_path = os.path.join(current_dir, "test_palettes", "default.txt")
    with open(image_path, "rb") as img, open(palette_path, "r") as palette_file:
        palette_content = palette_file.read().encode("utf-8")
        response = client.post(
            "/upload",
            data={
                "image": img,
                "palette": (io.BytesIO(palette_content), "default.txt"),
                "width": 300,
            },
        )

    assert response.status_code == 200
    assert b"Image processed successfully!" in response.data
