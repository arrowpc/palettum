import cv2
import numpy as np
import palettum
import pytest


def test_deltaE_computation():
    lab1 = [50.0, 2.6772, -100.7751]
    lab2 = [50.0, 50.0, 89.7485]

    result = palettum.Palettum.deltaE(lab1, lab2)

    assert abs(result - 61.2219665084882) < 1e-2


def test_convert_jpeg_to_palette():
    img = cv2.imread("../test_images/test.jpeg")
    assert img is not None, "Failed to open test.jpeg!"

    palette = [
        (190, 0, 57), (255, 69, 0), (255, 168, 0), (255, 214, 53),
        (0, 163, 104), (0, 204, 120), (126, 237, 86), (0, 117, 111),
        (0, 158, 170), (36, 80, 164), (54, 144, 234), (81, 233, 244),
        (73, 58, 193), (106, 92, 255), (129, 30, 159), (180, 74, 192),
        (255, 56, 129), (255, 153, 170), (109, 72, 47), (156, 105, 38),
        (0, 0, 0), (137, 141, 144), (212, 215, 217), (255, 255, 255)
    ]

    p = palettum.Palettum(img, palette)
    result = p.convertToPalette()

    cv2.imwrite("../test_images/python.png", result)

    original = cv2.imread("../test_images/test_estimate.png")
    assert original is not None, "Failed to open test_estimate.png!"
    difference_with_original = cv2.norm(result, original, cv2.NORM_L1)

    max_possible_difference = img.size * 255
    assert difference_with_original < 0.01 * max_possible_difference, "Resulting image difference with expected is more than 1%!"

    different = cv2.imread("../test_images/test.png")
    assert different is not None, "Failed to open test.png!"
    difference_with_different = cv2.norm(result, different, cv2.NORM_L1)
    assert difference_with_different != 0, "Resulting image should not be identical to the 'different' image!"
