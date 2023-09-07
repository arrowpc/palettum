#include "palettum.h"
Palettum::Palettum(Mat &image, const vector<Scalar> &palette)
{
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
    //    const double h1Prime = (atan2(lab1[2], a1Prime) + 2 * M_PI) * 180.0 / M_PI;
    //    const double h2Prime = (atan2(lab2[2], a2Prime) + 2 * M_PI) * 180.0 / M_PI;

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
