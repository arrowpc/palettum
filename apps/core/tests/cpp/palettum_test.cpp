#include "palettum.h"
#include <gtest/gtest.h>
#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <opencv2/opencv.hpp>
#include <vector>

TEST(DeltaEComputation, TestSpecificLabValues)
{
    cv::Vec3f lab1 = {50.0, 2.6772, -100.7751};
    cv::Vec3f lab2 = {50.0, 50.0, 89.7485};
    EXPECT_NEAR(Palettum::deltaE(lab1, lab2), 61.2219665084882, 1e-2);
}

class PalettumTests : public ::testing::Test
{
protected:
    cv::Mat result;
    cv::Mat img;
    std::vector<std::array<int, 3>> palette;

    void SetUp() override
    {
        img = cv::imread("../../test_images/hydrangea.jpeg", cv::IMREAD_COLOR);
        if (img.empty())
        {
            FAIL() << "Failed to open hydrangea.jpeg";
        }

        auto convertedImg = Palettum::matToPy(img);

        palette = {
            {190, 0, 57},   {255, 69, 0},    {255, 168, 0},   {255, 214, 53},
            {0, 163, 104},  {0, 204, 120},   {126, 237, 86},  {0, 117, 111},
            {0, 158, 170},  {36, 80, 164},   {54, 144, 234},  {81, 233, 244},
            {73, 58, 193},  {106, 92, 255},  {129, 30, 159},  {180, 74, 192},
            {255, 56, 129}, {255, 153, 170}, {109, 72, 47},   {156, 105, 38},
            {0, 0, 0},      {137, 141, 144}, {212, 215, 217}, {255, 255, 255}};
        py::list palette_py = py::cast(palette);

        Palettum test(convertedImg, palette_py);
        py::array_t<uint8_t> resultArray = test.convertToPalette();

        result = Palettum::pyToMat(resultArray);

        result = result.clone();
    }
};

TEST_F(PalettumTests, ConvertJpegToPalette)
{
    cv::Mat original = cv::imread("../../test_images/hydrangea_estimate.png",
                                  cv::IMREAD_COLOR);
    if (original.empty())
    {
        FAIL() << "Failed to open hydrangea_estimate.png!";
    }

    double originalDiff = cv::norm(result, original, cv::NORM_L1);
    double maxPossibleDifference =
        original.total() * original.channels() * 255.0;

    EXPECT_LT(originalDiff, 0.01 * maxPossibleDifference)
        << "Difference with original image exceeds 1%!";

    int differentDiff = cv::norm(result, img, cv::NORM_L1);
    EXPECT_NE(differentDiff, 0);
}

TEST_F(PalettumTests, ValidateImageColors)
{
    EXPECT_EQ(Palettum::validateImageColors(result, palette), true);
    EXPECT_EQ(Palettum::validateImageColors(img, palette), false);
}
