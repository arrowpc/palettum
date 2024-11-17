#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "palettum.h"

namespace py = pybind11;

PYBIND11_MODULE(palettum, m)
{
    m.doc() = "Core functionality for the Palettum project.";

    py::class_<Palettum>(m, "Palettum")
        .def_static("convertToPalette", &Palettum::convertToPalette)
        .def_static("validateImageColors", &Palettum::validateImageColors);

    py::class_<RGB>(m, "RGB")
        .def(py::init<unsigned char, unsigned char, unsigned char>())
        .def(py::init<std::initializer_list<unsigned char>>())
        .def("red", &RGB::red)
        .def("green", &RGB::green)
        .def("blue", &RGB::blue)
        .def("toLab", &RGB::toLab)
        .def("__eq__", &RGB::operator==)
        .def("__ne__", &RGB::operator!=)
        .def("__repr__", [](const RGB &rgb) {
            return "RGB(" + std::to_string(rgb.red()) + ", " +
                   std::to_string(rgb.green()) + ", " +
                   std::to_string(rgb.blue()) + ")";
        });

    py::class_<Lab>(m, "Lab")
        .def(py::init<double, double, double>())
        .def("L", &Lab::L)
        .def("a", &Lab::a)
        .def("b", &Lab::b)
        .def("toRGB", &Lab::toRGB)
        .def("deltaE", &Lab::deltaE)
        .def("__repr__", [](const Lab &lab) {
            return "Lab(" + std::to_string(lab.L()) + ", " +
                   std::to_string(lab.a()) + ", " + std::to_string(lab.b()) +
                   ")";
        });

    py::class_<Image>(m, "Image")
        .def(py::init<>())
        .def(py::init<const std::string &>())
        .def(py::init<int, int>())
        .def("write",
             static_cast<bool (Image:: *)(const std::string &)>(&Image::write))
        .def("get", &Image::get)
        .def("set", &Image::set)
        .def("width", &Image::width)
        .def("height", &Image::height)
        .def("channels", &Image::channels)
        .def("data",
             [](const Image &img) {
                 return py::array_t<uint8_t>(
                     {img.height(), img.width(), img.channels()},  // shape
                     {img.width() * img.channels(), img.channels(),
                      1},           // strides
                     img.data(),    // data pointer
                     py::cast(img)  // parent object
                 );
             })
        .def("__eq__", &Image::operator==)
        .def("__ne__", &Image::operator!=)
        .def("__sub__", &Image::operator-);
}