import os

import palettum
import pytest


class TestPalettum:
    @pytest.fixture(scope="class", autouse=True)
    def setup_class(self, request):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.img_path = os.path.join(
            self.current_dir, "..", "test_images", "hydrangea.jpeg"
        )

        self.img = palettum.Image(self.img_path)

        self.palette = [
            palettum.RGB(190, 0, 57),
            palettum.RGB(255, 69, 0),
            palettum.RGB(255, 168, 0),
            palettum.RGB(255, 214, 53),
            palettum.RGB(0, 163, 104),
            palettum.RGB(0, 204, 120),
            palettum.RGB(126, 237, 86),
            palettum.RGB(0, 117, 111),
            palettum.RGB(0, 158, 170),
            palettum.RGB(36, 80, 164),
            palettum.RGB(54, 144, 234),
            palettum.RGB(81, 233, 244),
            palettum.RGB(73, 58, 193),
            palettum.RGB(106, 92, 255),
            palettum.RGB(129, 30, 159),
            palettum.RGB(180, 74, 192),
            palettum.RGB(255, 56, 129),
            palettum.RGB(255, 153, 170),
            palettum.RGB(109, 72, 47),
            palettum.RGB(156, 105, 38),
            palettum.RGB(0, 0, 0),
            palettum.RGB(137, 141, 144),
            palettum.RGB(212, 215, 217),
            palettum.RGB(255, 255, 255),
        ]
        self.result = palettum.Palettum.convertToPalette(self.img, self.palette)

        request.cls.img = self.img
        request.cls.result = self.result
        request.cls.palette = self.palette
        request.cls.current_dir = self.current_dir
        request.cls.img_path = self.img_path

    def test_deltaE_computation(self):
        lab1 = palettum.Lab(50.0, 2.6772, -100.7751)
        lab2 = palettum.Lab(50.0, 50.0, 89.7485)
        result = lab1.deltaE(lab2)
        assert abs(result - 61.2219665084882) < 1e-2

    def test_convert_jpeg_to_palette(self):
        original_path = os.path.join(
            self.current_dir, "..", "test_images", "hydrangea_estimate.png"
        )
        original = palettum.Image(original_path)
        different_pixels = self.result - original
        total_pixels = original.width() * original.height()
        diff_percentage = (different_pixels * 100.0) / total_pixels

        assert diff_percentage <= 10.0, f"Images differ by {diff_percentage:.2f}% ({different_pixels} pixels out of {total_pixels})"

    def test_validate_image_colors(self):
        assert palettum.Palettum.validateImageColors(self.result, self.palette)
        assert not palettum.Palettum.validateImageColors(self.img, self.palette)
