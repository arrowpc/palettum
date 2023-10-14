import cv2
import palettum
import os
import pytest


class TestPalettum:
    @pytest.fixture(scope="class", autouse=True)
    def setup_class(self, request):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.img_path = os.path.join(
            self.current_dir, "..", "test_images", "hydrangea.jpeg"
        )

        self.img = cv2.imread(self.img_path)

        self.palette = [
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

        p = palettum.Palettum(self.img, self.palette)
        self.result = p.convertToPalette()

        request.cls.img = self.img
        request.cls.result = self.result
        request.cls.palette = self.palette
        request.cls.current_dir = self.current_dir
        request.cls.img_path = self.img_path

    def test_deltaE_computation(self):
        lab1 = [50.0, 2.6772, -100.7751]
        lab2 = [50.0, 50.0, 89.7485]
        result = palettum.Palettum.deltaE(lab1, lab2)
        assert abs(result - 61.2219665084882) < 1e-2

    def test_convert_jpeg_to_palette(self):
        original_path = os.path.join(
            self.current_dir, "..", "test_images", "hydrangea_estimate.png"
        )
        original = cv2.imread(original_path)
        difference_with_original = cv2.norm(self.result, original, cv2.NORM_L1)
        max_possible_difference = self.img.size * 255
        assert difference_with_original < 0.01 * max_possible_difference

        different = cv2.imread(self.img_path)
        difference_with_different = cv2.norm(self.result, different, cv2.NORM_L1)
        assert difference_with_different != 0

    def test_validate_image_colors(self):
        assert palettum.Palettum.validateImageColors(self.result, self.palette)
        assert not palettum.Palettum.validateImageColors(self.img, self.palette)
