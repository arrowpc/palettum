#include "palettum.h"

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
    for (size_t i = 0; i < m_palette.size(); ++i)
    {
        constants_lab[i] = m_palette[i].toLab();
    }

    for (int y = 0; y < m_image.height(); ++y)
    {
        for (int x = 0; x < m_image.width(); ++x)
        {
            // Convert current pixel to Lab once instead of multiple times
            Lab currentPixel = m_image.get(x, y).toLab();

            // Initialize with first palette color
            Lab closestColor = constants_lab[0];
            double closestDE = constants_lab[0].deltaE(currentPixel);

            // Find closest color
            for (size_t i = 1; i < constants_lab.size(); ++i)
            {
                double dE = constants_lab[i].deltaE(currentPixel);
                if (dE < closestDE)
                {
                    closestDE = dE;
                    closestColor = constants_lab[i];
                }
            }

            // Set the closest color
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
