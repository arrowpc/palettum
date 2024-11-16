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

    auto rows = image.rows;
    auto cols = image.cols;

    py::array_t<uint8_t> converted(py::buffer_info(
        image.data, sizeof(uint8_t), py::format_descriptor<uint8_t>::format(),
        3,
        std::vector<size_t>{static_cast<unsigned long>(rows),
                            static_cast<unsigned long>(cols), 3},  // shape
        std::vector<size_t>{sizeof(uint8_t) * cols * 3, sizeof(uint8_t) * 3,
                            sizeof(uint8_t)}));
    return converted;
}

void Palettum::mapToPalette(const int startRow, const int endRow,
                            const Mat &img_lab,
                            const std::vector<Lab> &lab_palette, Mat &result)
{
    for (int y = startRow; y < endRow; y++)
    {
        const auto *imgPtr = img_lab.ptr<cv::Vec3b>(y);
        auto *resultPtr = result.ptr<cv::Vec3b>(y);

        for (int x = 0; x < img_lab.cols; x++)
        {
            const Lab pixel(imgPtr[x][0], imgPtr[x][1], imgPtr[x][2]);

            double min_diff = std::numeric_limits<double>::max();
            int best_match_idx1 = 0;

            for (int i = 0; i < lab_palette.size(); i++)
            {
                double diff = pixel.deltaE(lab_palette[i]);

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

    std::vector<Lab> constants_lab(palette_.size());
    for (size_t i = 0; i < palette_.size(); i++)
    {
        Mat rgb(1, 1, CV_8UC3,
                cv::Scalar(palette_[i][0], palette_[i][1], palette_[i][2]));
        Mat lab;
        cvtColor(rgb, lab, COLOR_BGR2Lab);
        Vec3b lab_values = lab.at<Vec3b>(0, 0);
        constants_lab[i] = Lab(lab_values[0], lab_values[1], lab_values[2]);
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
