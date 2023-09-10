#include "palettum.h"
#include <gtest/gtest.h>
#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <opencv2/opencv.hpp>
#include <vector>

TEST(DeltaE, 1)
{
    cv::Vec3f lab1 = {50.0, 2.6772, -100.7751};
    cv::Vec3f lab2 = {50.0, 50.0, 89.7485};
    EXPECT_EQ(Palettum::deltaE(lab1, lab2), 61.227918044407808);
}

TEST(Image, jpeg)
{
    cv::Mat img = cv::imread("../test_images/test.jpeg", cv::IMREAD_COLOR);

    auto rows = img.rows;
    auto cols = img.cols;
    Py_Initialize();
    py::array_t<uint8_t> convertedImg(py::buffer_info(
        img.data, sizeof(uint8_t), py::format_descriptor<uint8_t>::format(), 3,
        std::vector<size_t>{static_cast<unsigned long>(rows),
                            static_cast<unsigned long>(cols), 3},  // shape
        std::vector<size_t>{sizeof(uint8_t) * cols * 3, sizeof(uint8_t) * 3,
                            sizeof(uint8_t)}));

    std::vector<std::array<int, 3>> palette = {
        {190, 0, 57},   {255, 69, 0},    {255, 168, 0},   {255, 214, 53},
        {0, 163, 104},  {0, 204, 120},   {126, 237, 86},  {0, 117, 111},
        {0, 158, 170},  {36, 80, 164},   {54, 144, 234},  {81, 233, 244},
        {73, 58, 193},  {106, 92, 255},  {129, 30, 159},  {180, 74, 192},
        {255, 56, 129}, {255, 153, 170}, {109, 72, 47},   {156, 105, 38},
        {0, 0, 0},      {137, 141, 144}, {212, 215, 217}, {255, 255, 255}};
    py::list palette_py = py::cast(palette);

    auto test = Palettum(convertedImg, palette_py);
    py::array_t<uint8_t> resultArray = test.convertToPalette();

    py::buffer_info result_buf_info = resultArray.request();
    cv::Mat result(result_buf_info.shape[0], result_buf_info.shape[1], CV_8UC3,
                   result_buf_info.ptr);

    cv::Mat original =
        cv::imread("../test_images/test_estimate.png", cv::IMREAD_COLOR);
    int originalDiff = cv::norm(result, original, cv::NORM_L1);
    EXPECT_EQ(originalDiff, 0);

    cv::Mat different = cv::imread("../test_images/test.png", cv::IMREAD_COLOR);
    int differentDiff = cv::norm(result, different, cv::NORM_L1);
    EXPECT_NE(differentDiff, 0);

    bool valid = test.validateImageColors();
    EXPECT_EQ(valid, 0);
}