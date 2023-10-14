#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include "palettum.h"

namespace py = pybind11;

PYBIND11_MODULE(palettum, m)
{
    m.doc() = "Core functionality for the Palettum project.";

    py::class_<Palettum>(m, "Palettum")
        .def(py::init<py::array_t<uint8_t> &, const py::list &>())
        .def("convertToPalette", &Palettum::convertToPalette)
        .def_static("deltaE", &Palettum::py_deltaE)
        .def_static("validateImageColors", &Palettum::py_validateImageColors);
}