#include "palettum.h"

namespace py = pybind11;

Palettum::Palettum(py::array_t<uint8_t> &image, const py::list &palette)
{
    py::buffer_info buf = image.request();
    cv::Mat mat(buf.shape[0], buf.shape[1], CV_8UC3, (unsigned char *)buf.ptr);

    image_ = mat;
    palette_.reserve(py::len(palette));

    for (const auto &color : palette)
    {
        py::list l = color.cast<py::list>();
        cv::Scalar c(l[2].cast<int>(), l[1].cast<int>(), l[0].cast<int>());
        palette_.push_back(c);
    }
}
cv::Mat Palettum::pyToMat(py::array_t<uint8_t> &image)
{
    py::buffer_info buffer = image.request();
    cv::Mat converted(buffer.shape[0], buffer.shape[1], CV_8UC3, buffer.ptr);

    return converted;
}
py::array_t<uint8_t> Palettum::matToPy(Mat &image)
{
    if (!Py_IsInitialized())
        Py_Initialize();
    PyGILState_STATE gstate;
    gstate = PyGILState_Ensure();

    auto rows = image.rows;
    auto cols = image.cols;

    py::array_t<uint8_t> converted(py::buffer_info(
        image.data, sizeof(uint8_t), py::format_descriptor<uint8_t>::format(),
        3,
        std::vector<size_t>{static_cast<unsigned long>(rows),
                            static_cast<unsigned long>(cols), 3},  // shape
        std::vector<size_t>{sizeof(uint8_t) * cols * 3, sizeof(uint8_t) * 3,
                            sizeof(uint8_t)}));
    PyGILState_Release(gstate);
    return converted;
}
double Palettum::deltaE(const Vec3f &lab1, const Vec3f &lab2)
{
    const double lBarPrime = (lab1[0] + lab2[0]) * 0.5;
    const double c1 = std::sqrt(lab1[1] * lab1[1] + lab1[2] * lab1[2]);
    const double c2 = std::sqrt(lab2[1] * lab2[1] + lab2[2] * lab2[2]);
    const double cBar = (c1 + c2) * 0.5;
    const double g = (1 - std::sqrt(fastPow(cBar, 7) /
                                    (fastPow(cBar, 7) + fastPow(25.0, 7)))) *
                     0.5;
    const double a1Prime = lab1[1] * (1 + g);
    const double a2Prime = lab2[1] * (1 + g);
    const double c1Prime = std::sqrt(a1Prime * a1Prime + lab1[2] * lab1[2]);
    const double c2Prime = std::sqrt(a2Prime * a2Prime + lab2[2] * lab2[2]);
    const double cBarPrime = (c1Prime + c2Prime) * 0.5;
    const double h1Prime =
        (FastAtan2(lab1[2], a1Prime) + 2 * M_PI) * 180.0 / M_PI;
    const double h2Prime =
        (FastAtan2(lab2[2], a2Prime) + 2 * M_PI) * 180.0 / M_PI;
    //        const double h1Prime = (atan2(lab1[2], a1Prime) + 2 * M_PI) * 180.0 / M_PI;
    //        const double h2Prime = (atan2(lab2[2], a2Prime) + 2 * M_PI) * 180.0 / M_PI;

    double deltaLPrime = lab2[0] - lab1[0];
    double deltaCPrime = c2Prime - c1Prime;
    double deltahPrime;
    if (std::abs(h1Prime - h2Prime) <= 180)
    {
        deltahPrime = h2Prime - h1Prime;
    }
    else if (h2Prime <= h1Prime)
    {
        deltahPrime = h2Prime - h1Prime + 360;
    }
    else
    {
        deltahPrime = h2Prime - h1Prime - 360;
    }

    const double deltaHPrime =
        2 * std::sqrt(c1Prime * c2Prime) * std::sin(deltahPrime * M_PI / 360.0);
    const double sL = 1 + (0.015 * fastPow(lBarPrime - 50, 2)) /
                              std::sqrt(20 + fastPow(lBarPrime - 50, 2));
    const double sC = 1 + 0.045 * cBarPrime;
    const double hBarPrime =
        (std::abs(h1Prime - h2Prime) <= 180) ? (h1Prime + h2Prime) / 2
        : (h1Prime + h2Prime < 360)          ? (h1Prime + h2Prime + 360) / 2
                                             : (h1Prime + h2Prime - 360) / 2;
    const double t = 1 - 0.17 * std::cos(deg2Rad(hBarPrime - 30)) +
                     0.24 * std::cos(deg2Rad(2 * hBarPrime)) +
                     0.32 * std::cos(deg2Rad(3 * hBarPrime + 6)) -
                     0.20 * std::cos(deg2Rad(4 * hBarPrime - 63));
    const double sH = 1 + 0.015 * cBarPrime * t;
    const double rT =
        -2 *
        std::sqrt(fastPow(cBarPrime, 7) /
                  (fastPow(cBarPrime, 7) + fastPow(25.0, 7))) *
        std::sin(deg2Rad(60 * std::exp(-fastPow((hBarPrime - 275) / 25, 2))));

    const double lightness = deltaLPrime / sL;
    const double chroma = deltaCPrime / sC;
    const double hue = deltaHPrime / sH;

    return std::sqrt(lightness * lightness + chroma * chroma + hue * hue +
                     rT * chroma * hue);
}

double Palettum::py_deltaE(const py::list &lab1, const py::list &lab2)
{
    if (lab1.size() != 3 || lab2.size() != 3)
    {
        throw std::runtime_error("Both lists should have exactly 3 elements.");
    }

    Vec3f lab1_ = {lab1[0].cast<float>(), lab1[1].cast<float>(),
                   lab1[2].cast<float>()};
    Vec3f lab2_ = {lab2[0].cast<float>(), lab2[1].cast<float>(),
                   lab2[2].cast<float>()};

    return deltaE(lab1_, lab2_);
}

void Palettum::mapToPalette(const int startRow, const int endRow,
                            const Mat &img_lab,
                            const std::vector<cv::Vec3b> &lab_palette,
                            Mat &result)
{
    for (int y = startRow; y < endRow; y++)
    {
        const auto *imgPtr = img_lab.ptr<cv::Vec3b>(y);
        auto *resultPtr = result.ptr<cv::Vec3b>(y);

        for (int x = 0; x < img_lab.cols; x++)
        {
            const cv::Vec3b &pixel = imgPtr[x];

            double min_diff = std::numeric_limits<double>::max();
            int best_match_idx1 = 0;

            for (int i = 0; i < lab_palette.size(); i++)
            {
                double diff = deltaE(pixel, lab_palette[i]);

                if (diff < min_diff)
                {
                    min_diff = diff;
                    best_match_idx1 = i;
                }
            }

            resultPtr[x] = cv::Vec3b(palette_[best_match_idx1][0],
                                     palette_[best_match_idx1][1],
                                     palette_[best_match_idx1][2]);
        }
    }
}
py::array_t<uint8_t> Palettum::convertToPalette()
{
    Mat img_lab;
    cvtColor(image_, img_lab, COLOR_BGR2Lab);

    std::vector<cv::Vec3b> constants_lab(palette_.size());
    for (size_t i = 0; i < palette_.size(); i++)
    {
        Mat rgb(1, 1, CV_8UC3,
                cv::Scalar(palette_[i][0], palette_[i][1], palette_[i][2]));
        Mat lab;
        cvtColor(rgb, lab, COLOR_BGR2Lab);
        constants_lab[i] = lab.at<cv::Vec3b>(0, 0);
    }

    Mat result(image_.size(), image_.type());
    cv::parallel_for_(Range(0, image_.rows), [&](const Range &range) {
        mapToPalette(range.start, range.end, img_lab, constants_lab, result);
    });

    auto rows = image_.rows;
    auto cols = image_.cols;
    py::array_t<uint8_t> convertedResult(py::buffer_info(
        result.data, sizeof(uint8_t), py::format_descriptor<uint8_t>::format(),
        3,
        std::vector<size_t>{static_cast<unsigned long>(rows),
                            static_cast<unsigned long>(cols), 3},
        std::vector<size_t>{sizeof(uint8_t) * cols * 3, sizeof(uint8_t) * 3,
                            sizeof(uint8_t)}));
    return convertedResult;
}

bool Palettum::validateImageColors(
    const Mat &image, const std::vector<std::array<int, 3>> &palette)
{
    std::atomic<bool> foundMismatch(false);

    auto isColorInPalette = [&palette](const cv::Vec3b &color) -> bool {
        for (const auto &paletteColor : palette)
        {
            if (color[2] == paletteColor[0] && color[1] == paletteColor[1] &&
                color[0] == paletteColor[2])
            {
                return true;
            }
        }
        return false;
    };

    auto parallelValidator = [&isColorInPalette, &foundMismatch,
                              &image](const cv::Range &range) {
        for (int y = range.start; y < range.end; y++)
        {
            for (int x = 0; x < image.cols; x++)
            {
                if (!isColorInPalette(image.at<cv::Vec3b>(y, x)))
                {
                    foundMismatch.store(true);
                    return;
                }
            }
        }
    };

    cv::parallel_for_(cv::Range(0, image.rows), parallelValidator);

    return !foundMismatch.load();
}

bool Palettum::py_validateImageColors(
    pybind11::array_t<uint8_t> &image,
    const std::vector<std::array<int, 3>> &palette)
{
    auto img = pyToMat(image);
    return validateImageColors(img, palette);
}
