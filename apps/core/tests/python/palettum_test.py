import os

import pytest
from palettum import RGB, Config, Image, Lab, palettify, validate


class TestPalettum:
    @pytest.fixture(scope="class", autouse=True)
    def setup_class(self, request):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.img_path = os.path.join(
            self.current_dir, "..", "test_images", "hydrangea.jpeg"
        )

        self.img = Image(self.img_path)

        self.palette = [
            RGB(190, 0, 57),
            RGB(255, 69, 0),
            RGB(255, 168, 0),
            RGB(255, 214, 53),
            RGB(0, 163, 104),
            RGB(0, 204, 120),
            RGB(126, 237, 86),
            RGB(0, 117, 111),
            RGB(0, 158, 170),
            RGB(36, 80, 164),
            RGB(54, 144, 234),
            RGB(81, 233, 244),
            RGB(73, 58, 193),
            RGB(106, 92, 255),
            RGB(129, 30, 159),
            RGB(180, 74, 192),
            RGB(255, 56, 129),
            RGB(255, 153, 170),
            RGB(109, 72, 47),
            RGB(156, 105, 38),
            RGB(0, 0, 0),
            RGB(137, 141, 144),
            RGB(212, 215, 217),
            RGB(255, 255, 255),
        ]
        self.conf = Config()
        self.conf.palette = self.palette
        self.result = palettify(self.img, self.conf)

        request.cls.img = self.img
        request.cls.result = self.result
        request.cls.palette = self.palette
        request.cls.current_dir = self.current_dir
        request.cls.img_path = self.img_path
        request.cls.conf = self.conf

    # def test_deltaE_computation(self):
    #     lab1 = Lab(50.0, 2.6772, -100.7751)
    #     lab2 = Lab(50.0, 50.0, 89.7485)
    #     result = lab1.deltaE(lab2)
    #     assert abs(result - 61.2219665084882) < 1e-2

    def test_convert_jpeg_to_palette(self):
        original_path = os.path.join(
            self.current_dir, "..", "test_images", "hydrangea_basic.png"
        )
        original = Image(original_path)
        different_pixels = self.result - original
        total_pixels = original.width() * original.height()
        diff_percentage = (different_pixels * 100.0) / total_pixels

        assert (
            diff_percentage <= 10.0
        ), f"Images differ by {diff_percentage:.2f}% ({different_pixels} pixels out of {total_pixels})"

    def test_validate_image_colors(self):
        assert validate(self.result, self.conf)
        assert not validate(self.img, self.conf)
