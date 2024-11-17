#ifndef PALETTUM_CORE_PALETTUM_H
#define PALETTUM_CORE_PALETTUM_H

#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <cmath>
#include <vector>
#include "processor.h"

using namespace std;
namespace py = pybind11;

class Palettum
{
private:
    Image m_image;
    vector<RGB> m_palette;

public:
    Palettum(py::array_t<uint8_t> &image, const py::list &palette);
    py::array_t<uint8_t> convertToPalette();
    static bool validateImageColors(Image &image, vector<RGB> &palette);
    static Image pyToImage(py::array_t<uint8_t> &image);
    static py::array_t<uint8_t> imageToPy(Image &image);
};

#endif  //PALETTUM_CORE_PALETTUM_H
