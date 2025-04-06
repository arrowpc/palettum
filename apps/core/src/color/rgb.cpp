#include "color/rgb.h"

float pivotXYZ(float n) noexcept
{
    return n > XYZ::EPSILON ? std::cbrt(n) : (XYZ::KAPPA * n + 16.0f) / 116.0f;
}

Lab RGB::toLab() const noexcept
{
    float fr = r / 255.0f;
    float fg = g / 255.0f;
    float fb = b / 255.0f;

    fr = (fr > 0.04045f) ? std::pow((fr + 0.055f) / 1.055f, 2.4f) : fr / 12.92f;
    fg = (fg > 0.04045f) ? std::pow((fg + 0.055f) / 1.055f, 2.4f) : fg / 12.92f;
    fb = (fb > 0.04045f) ? std::pow((fb + 0.055f) / 1.055f, 2.4f) : fb / 12.92f;

    XYZ xyz;
    xyz.X = fr * 0.4124564f + fg * 0.3575761f + fb * 0.1804375f;
    xyz.Y = fr * 0.2126729f + fg * 0.7151522f + fb * 0.0721750f;
    xyz.Z = fr * 0.0193339f + fg * 0.1191920f + fb * 0.9503041f;

    xyz.X = xyz.X * 100.0f;
    xyz.Y = xyz.Y * 100.0f;
    xyz.Z = xyz.Z * 100.0f;

    float xr = xyz.X / XYZ::WHITE_X;
    float yr = xyz.Y / XYZ::WHITE_Y;
    float zr = xyz.Z / XYZ::WHITE_Z;

    xr = pivotXYZ(xr);
    yr = pivotXYZ(yr);
    zr = pivotXYZ(zr);

    float L = std::max<float>(0.0f, 116.0f * yr - 16.0f);
    float a = 500.0f * (xr - yr);
    float b_ = 200.0f * (yr - zr);

    return Lab(L, a, b_);
}

std::ostream &operator<<(std::ostream &os, const RGB &RGB)
{
    return os << "RGB(" << static_cast<int>(RGB.r) << ", "
              << static_cast<int>(RGB.g) << ", " << static_cast<int>(RGB.b)
              << ")";
}

std::ostream &operator<<(std::ostream &os, const RGBA &RGBA)
{
    return os << "RGBA(" << static_cast<int>(RGBA.r) << ", "
              << static_cast<int>(RGBA.g) << ", " << static_cast<int>(RGBA.b)
              << ", " << static_cast<int>(RGBA.a) << ")";
}
