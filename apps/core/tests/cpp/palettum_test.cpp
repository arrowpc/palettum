#include "palettum.h"
#include <gtest/gtest.h>
#include <vector>

TEST(ImageProcessing, TestLoadingImage)
{
    Image img("../../test_images/hydrangea.jpeg");
    EXPECT_EQ(img.width(), 1200);
    EXPECT_EQ(img.height(), 1366);
    EXPECT_EQ(img.channels(), 3);
}

TEST(ImageProcessing, TestWritingImage)
{
    Image original("../../test_images/hydrangea.jpeg");
    bool success = original.write("hydrangea.png");
    EXPECT_TRUE(success);

    Image written("hydrangea.png");
    EXPECT_EQ(original, written);

    Image different("../../test_images/hydrangea_accurate.png");
    EXPECT_NE(original, different);
}

TEST(ImageProcessing, TestPixelGetter)
{
    Image img("../../test_images/hydrangea.jpeg");
    RGB p(72, 111, 108);
    EXPECT_EQ(img.get(0, 0), p);
}

TEST(ImageProcessing, TestPixelSetter)
{
    Image img("../../test_images/hydrangea.jpeg");
    RGB p(0, 0, 0);
    img.set(0, 0, p);
    EXPECT_EQ(img.get(0, 0), p);
}

TEST(DeltaEComputation, TestSpecificLabValues)
{
    Lab lab1(50.0, 2.6772, -100.7751);
    Lab lab2(50.0, 50.0, 89.7485);
    EXPECT_NEAR(lab1.deltaE(lab2), 61.2219665084882, 1e-2);
}

class PalettumTests : public ::testing::Test
{
protected:
    Image result;
    Image img;
    vector<RGB> palette;

    void SetUp() override
    {
        img = Image("../../test_images/hydrangea.jpeg");
        palette = {
            {190, 0, 57},   {255, 69, 0},    {255, 168, 0},   {255, 214, 53},
            {0, 163, 104},  {0, 204, 120},   {126, 237, 86},  {0, 117, 111},
            {0, 158, 170},  {36, 80, 164},   {54, 144, 234},  {81, 233, 244},
            {73, 58, 193},  {106, 92, 255},  {129, 30, 159},  {180, 74, 192},
            {255, 56, 129}, {255, 153, 170}, {109, 72, 47},   {156, 105, 38},
            {0, 0, 0},      {137, 141, 144}, {212, 215, 217}, {255, 255, 255}};
        result = Palettum::convertToPalette(img, palette);
    }
};

TEST_F(PalettumTests, ConvertJpegToPalette)
{
    Image original("../../test_images/hydrangea_basic.png");
    int differentPixels = result - original;
    int totalPixels = original.width() * original.height();
    double diffPercentage = (differentPixels * 100.0) / totalPixels;

    EXPECT_LE(diffPercentage, 10.0)
        << "Images differ by " << diffPercentage << "% (" << differentPixels
        << " pixels out of " << totalPixels << ")";
}

TEST_F(PalettumTests, ValidateImageColors)
{
    EXPECT_EQ(Palettum::validateImageColors(result, palette), true);
    EXPECT_EQ(Palettum::validateImageColors(img, palette), false);
}
