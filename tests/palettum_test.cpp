#include "palettum.h"
#include <gtest/gtest.h>
#include <opencv2/opencv.hpp>
#include <vector>

TEST(DeltaE, 1)
{
    cv::Vec3f lab1 = {50.0, 2.6772, -100.7751};
    cv::Vec3f lab2 = {50.0, 50.0, 89.7485};
    EXPECT_EQ(Palettum::deltaE(lab1, lab2), 61.227918044407808);
}