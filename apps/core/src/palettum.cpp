#include "palettum.h"
#include <omp.h>

namespace py = pybind11;

Palettum::Palettum(py::array_t<uint8_t> &image, const py::list &palette)
    : m_image(image.request().shape[1], image.request().shape[0],
              static_cast<unsigned char *>(image.request().ptr))
{
    m_palette.reserve(py::len(palette));

    for (const auto &color : palette)
    {
        auto l = color.cast<py::list>();
        Pixel c(l[0].cast<int>(), l[1].cast<int>(), l[2].cast<int>());
        m_palette.push_back(c);
    }
}

Image Palettum::pyToImage(py::array_t<uint8_t> &image)
{
    py::buffer_info buffer = image.request();
    return Image(buffer.shape[1], buffer.shape[0],
                 static_cast<unsigned char *>(buffer.ptr));
}

py::array_t<uint8_t> Palettum::imageToPy(Image &image)
{
    if (!Py_IsInitialized())
        Py_Initialize();

    return py::array_t<uint8_t>(
        {static_cast<size_t>(image.height()),
         static_cast<size_t>(image.width()), static_cast<size_t>(3)},
        {static_cast<size_t>(image.width() * 3), static_cast<size_t>(3),
         static_cast<size_t>(1)},
        image.data());
}

py::array_t<uint8_t> Palettum::convertToPalette()
{
    std::vector<Lab> constants_lab(m_palette.size());
#pragma omp parallel for
    for (size_t i = 0; i < m_palette.size(); ++i)
    {
        constants_lab[i] = m_palette[i].toLab();
    }

    const int height = m_image.height();
    const int width = m_image.width();

#pragma omp parallel for collapse(2) schedule(dynamic)
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            Lab currentPixel = m_image.get(x, y).toLab();
            Lab closestColor = constants_lab[0];
            double closestDE = constants_lab[0].deltaE(currentPixel);
            for (size_t i = 1; i < constants_lab.size(); ++i)
            {
                double dE = constants_lab[i].deltaE(currentPixel);
                if (dE < closestDE)
                {
                    closestDE = dE;
                    closestColor = constants_lab[i];
                }
            }
            m_image.set(x, y, closestColor.toRGB());
        }
    }
    return imageToPy(m_image);
}

//bool Palettum::validateImageColors(
//    const Mat &image, const std::vector<std::array<int, 3>> &palette)
//{
//    std::atomic<bool> foundMismatch(false);
//
//    auto isColorInPalette = [&palette](const cv::Vec3b &color) -> bool {
//        for (const auto &paletteColor : palette)
//        {
//            if (color[2] == paletteColor[0] && color[1] == paletteColor[1] &&
//                color[0] == paletteColor[2])
//            {
//                return true;
//            }
//        }
//        return false;
//    };
//
//    auto parallelValidator = [&isColorInPalette, &foundMismatch,
//                              &image](const cv::Range &range) {
//        for (int y = range.start; y < range.end; y++)
//        {
//            for (int x = 0; x < image.cols; x++)
//            {
//                if (!isColorInPalette(image.at<cv::Vec3b>(y, x)))
//                {
//                    foundMismatch.store(true);
//                    return;
//                }
//            }
//        }
//    };
//
//    cv::parallel_for_(cv::Range(0, image.rows), parallelValidator);
//
//    return !foundMismatch.load();
//}

//bool Palettum::py_validateImageColors(
//    pybind11::array_t<uint8_t> &image,
//    const std::vector<std::array<int, 3>> &palette)
//{
//    auto img = pyToMat(image);
//    return validateImageColors(img, palette);
//}
