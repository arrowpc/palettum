#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/stl_bind.h>
#include <opencv2/opencv.hpp>
#include "palettum.h"

namespace py = pybind11;

PYBIND11_PLUGIN(py_palettum_core)
{
    py::module handle("py_palettum_core", "docstring here");

    py::class_<Palettum>(handle, "Palettum")
        .def(py::init<py::array_t<uint8_t> &, const py::list &>())
        .def("convertToPalette", &Palettum::convertToPalette)
        .def("validateImageColors", &Palettum::validateImageColors);

    return handle.ptr();
}