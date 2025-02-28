#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "palettum.h"

namespace py = pybind11;

PYBIND11_MODULE(palettum, m)
{
    m.doc() = "Core functionality for the Palettum project.";

    m.def(
        "palettify",
        [](Image &img, Config &config) -> Image {
            return palettum::palettify(img, config);
        },
        py::arg("image"), py::arg("config"));

    m.def(
        "palettify",
        [](GIF &gif, Config &config) -> GIF {
            return palettum::palettify(gif, config);
        },
        py::arg("gif"), py::arg("config"));

    m.def("validate", &palettum::validate, py::arg("image"), py::arg("config"));

    py::enum_<Formula>(m, "Formula")
        .value("EUCLIDEAN", Formula::EUCLIDEAN)
        .value("CIE76", Formula::CIE76)
        .value("CIE94", Formula::CIE94)
        .value("CIEDE2000", Formula::CIEDE2000)
        .export_values();

    py::enum_<Architecture>(m, "Architecture")
        .value("SCALAR", Architecture::SCALAR)
        .value("NEON", Architecture::NEON)
        .value("AVX2", Architecture::AVX2)
        .export_values();

    py::class_<Config>(m, "Config")
        .def(py::init<>())
        .def_readwrite("palette", &Config::palette)
        .def_readwrite("transparencyThreshold", &Config::transparencyThreshold)
        .def_readwrite("formula", &Config::formula)
        .def_readwrite("architecture", &Config::architecture);

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
        .def(py::init<simde_float16_t, simde_float16_t, simde_float16_t>(),
             py::arg("L") = 0, py::arg("a") = 0, py::arg("b") = 0)
        .def("L", &Lab::L)
        .def("a", &Lab::a)
        .def("b", &Lab::b)
        .def("toRGB", &Lab::toRGB)
        .def("__repr__", [](const Lab &lab) {
            return "Lab(" + std::to_string((float)lab.L()) + ", " +
                   std::to_string((float)lab.a()) + ", " +
                   std::to_string((float)lab.b()) + ")";
        });

    py::class_<RGBA, RGB>(m, "RGBA")
        .def(py::init<unsigned char, unsigned char, unsigned char,
                      unsigned char>(),
             py::arg("r") = 0, py::arg("g") = 0, py::arg("b") = 0,
             py::arg("a") = 255)
        .def("alpha", &RGBA::alpha);

    py::class_<Image>(m, "Image")
        .def(py::init<>())
        .def(py::init<const std::string &>())
        .def(py::init<const char *>())
        .def(py::init<int, int>())
        .def(py::init<int, int, bool>())
        .def(py::init([](py::buffer buffer) {
            py::buffer_info info = buffer.request();
            if (info.ndim != 1)
            {
                throw std::runtime_error("Buffer must be 1-dimensional");
            }
            return new Image(static_cast<const unsigned char *>(info.ptr),
                             static_cast<int>(info.size));
        }))
        .def("write", py::overload_cast<>(&Image::write, py::const_))
        .def("write",
             py::overload_cast<const std::string &>(&Image::write, py::const_))
        .def("write",
             py::overload_cast<const char *>(&Image::write, py::const_))
        .def("resize", &Image::resize)
        .def("get", &Image::get)
        .def("set", py::overload_cast<int, int, const RGBA &>(&Image::set))
        .def("set", py::overload_cast<int, int, const RGB &>(&Image::set))
        .def("width", &Image::width)
        .def("height", &Image::height)
        .def("channels", &Image::channels)
        .def("hasAlpha", &Image::hasAlpha)
        .def("data",
             [](const Image &img) {
                 return py::array_t<uint8_t>(
                     {img.height(), img.width(), img.channels()},  // shape
                     {img.width() * img.channels(), img.channels(),
                      1},  // strides
                     img.data(),
                     py::cast(img)  // keep parent alive
                 );
             })
        .def("__eq__", &Image::operator==)
        .def("__ne__", &Image::operator!=)
        .def("__sub__", &Image::operator-);

    py::class_<GIF>(m, "GIF")
        .def(py::init<const std::string &>())
        .def(py::init<const char *>())
        .def(py::init<int, int>())
        .def(py::init([](py::buffer buffer) {
            py::buffer_info info = buffer.request();
            if (info.ndim != 1)
            {
                throw std::runtime_error("Buffer must be 1-dimensional");
            }
            return new GIF(static_cast<const unsigned char *>(info.ptr),
                           static_cast<int>(info.size));
        }))
        .def("write",
             py::overload_cast<const std::string &>(&GIF::write, py::const_))
        .def("write", py::overload_cast<const char *>(&GIF::write, py::const_))
        .def("write", py::overload_cast<>(&GIF::write, py::const_))
        .def("resize", &GIF::resize)
        .def("frameCount", &GIF::frameCount)
        .def("width", &GIF::width)
        .def("height", &GIF::height)
        .def("addFrame", &GIF::addFrame, py::arg("image"),
             py::arg("delay_cs") = 10)
        .def("setPixel",
             py::overload_cast<size_t, int, int, const RGBA &>(&GIF::setPixel))
        .def("setPixel",
             py::overload_cast<size_t, int, int, const RGB &>(&GIF::setPixel))
        .def("setPalette", &GIF::setPalette)
        .def("getFrame", py::overload_cast<size_t>(&GIF::getFrame, py::const_));
}
