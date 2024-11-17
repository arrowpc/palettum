
#ifndef PALETTUM_CORE_PALETTUM_H
#define PALETTUM_CORE_PALETTUM_H

#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <atomic>
#include <cmath>
#include <iostream>
#include <vector>
#include "processor.h"

using namespace std;
namespace py = pybind11;

class Palettum
{
private:
    Image m_image;
    vector<Pixel> m_palette;

public:
    Palettum(py::array_t<uint8_t> &image, const py::list &palette);
    static double py_deltaE(const py::list &lab1, const py::list &lab2);
    py::array_t<uint8_t> convertToPalette();
    //    static bool validateImageColors(
    //        const Mat &image, const std::vector<std::array<int, 3>> &palette);
    static bool py_validateImageColors(
        pybind11::array_t<uint8_t> &image,
        const std::vector<std::array<int, 3>> &palette);
    static Image pyToImage(py::array_t<uint8_t> &image);
    static py::array_t<uint8_t> imageToPy(Image &image);
};

#endif  //PALETTUM_CORE_PALETTUM_H
