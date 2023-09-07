
#ifndef PALETTUM_CORE_PALETTUM_H
#define PALETTUM_CORE_PALETTUM_H

#include <cmath>
#include <iostream>
#include <opencv2/flann.hpp>
#include <opencv2/opencv.hpp>
#include <vector>

using namespace cv;
using namespace std;

class Palettum
{
private:
    Mat image_;
    vector<Scalar> palette_;
    vector<Vec3b> lab_palette_;
    //    std::atomic<bool>& foundMismatch_;

    inline double fastPow(double a, double b)
    {
        union {
            double d;
            int x[2];
        } u = {a};
        u.x[1] = (int)(b * (u.x[1] - 1072632447) + 1072632447);
        u.x[0] = 0;
        return u.d;
    }
    double deg2Rad(const double deg)
    {
        return (deg * (M_PI / 180.0));
    }
    double FastAtan2(double y, double x)
    {
        return M_PI_4 * x - x * (fabs(x) - 1) * (0.2447 + 0.0663 * fabs(x));
    }
    double deltaE(const Vec3f &lab1, const Vec3f &lab2);
    void mapToPalette(const int startRow, const int endRow, const Mat &img_lab,
                      Mat &result);
    bool isColorInPalette(const Vec3b &color);

public:
    Palettum(Mat &image, const vector<Scalar> &palette);
    Mat convertToPalette();
    bool validateImageColors();
};

#endif  //PALETTUM_CORE_PALETTUM_H
