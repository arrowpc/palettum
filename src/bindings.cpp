#include <pybind11/pybind11.h>
#include "palettum.h"

namespace py = pybind11;

PYBIND11_MODULE(palettum_core, m) {
    py::class_<Palettum>(m, "Palettum")
        .def(py::init<cv::Mat &, const std::vector<cv::Scalar> &>())
        .def("convertToPalette", &Palettum::convertToPalette)
        .def("validateImageColors", &Palettum::validateImageColors);
}

