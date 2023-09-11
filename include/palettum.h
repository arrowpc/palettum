
#ifndef PALETTUM_CORE_PALETTUM_H
#define PALETTUM_CORE_PALETTUM_H

#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <cmath>
#include <iostream>
#include <opencv2/opencv.hpp>
#include <vector>

using namespace cv;
using namespace std;
namespace py = pybind11;

class Palettum
{
private:
    Mat image_;
    vector<Scalar> palette_;

    static double fastPow(double a, double b)
    {
        union {
            double d;
            int x[2];
        } u = {a};
        u.x[1] = (int)(b * (u.x[1] - 1072632447) + 1072632447);
        u.x[0] = 0;
        return u.d;
    }
    static double deg2Rad(const double deg)
    {
        return (deg * (M_PI / 180.0));
    }
    static double FastAtan(double x)
    {
        return M_PI_4 * x - x * (fabs(x) - 1) * (0.2447 + 0.0663 * fabs(x));
    }
    static double FastAtan2(double y, double x)
    {
        if (x >= 0)
        {
            if (y >= 0)
            {
                if (y < x)
                    return FastAtan(y / x);
                else
                    return M_PI_2 - FastAtan(x / y);
            }
            else
            {
                if (-y < x)
                    return FastAtan(y / x);

                else
                    return -M_PI_2 - FastAtan(x / y);
            }
        }
        else
        {
            if (y >= 0)
            {
                if (y < -x)
                    return FastAtan(y / x) + M_PI;

                else
                    return M_PI_2 - FastAtan(x / y);
            }
            else
            {
                if (-y < -x)
                    return FastAtan(y / x) - M_PI;

                else
                    return -M_PI_2 - FastAtan(x / y);
            }
        }
    }
    void mapToPalette(int startRow, int endRow, const Mat &img_lab,
                      const std::vector<cv::Vec3b> &lab_palette, Mat &result);
    bool isColorInPalette(const Vec3b &color);

public:
    Palettum(py::array_t<uint8_t> &image, const py::list &palette);
    static double deltaE(const Vec3f &lab1, const Vec3f &lab2);
    py::array_t<uint8_t> convertToPalette();
    bool validateImageColors();
    static cv::Mat pyToMat(py::array_t<uint8_t> &image);
    static py::array_t<uint8_t> matToPy(cv::Mat &image);
};

#endif  //PALETTUM_CORE_PALETTUM_H
