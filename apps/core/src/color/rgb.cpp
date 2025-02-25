#include "color/rgb.h"

RGB::RGB(unsigned char r, unsigned char g, unsigned char b) noexcept
    : m_r(r)
    , m_g(g)
    , m_b(b)
{
}

Lab RGB::toLab() const noexcept
{
    float r = m_r / 255.0f;
    float g = m_g / 255.0f;
    float b = m_b / 255.0f;

    r = (r > 0.04045f) ? std::pow((r + 0.055f) / 1.055f, 2.4f) : r / 12.92f;
    g = (g > 0.04045f) ? std::pow((g + 0.055f) / 1.055f, 2.4f) : g / 12.92f;
    b = (b > 0.04045f) ? std::pow((b + 0.055f) / 1.055f, 2.4f) : b / 12.92f;
    XYZ xyz;
    xyz.X = r * 0.4124564f + g * 0.3575761f + b * 0.1804375f;
    xyz.Y = r * 0.2126729f + g * 0.7151522f + b * 0.0721750f;
    xyz.Z = r * 0.0193339f + g * 0.1191920f + b * 0.9503041f;

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
    b = 200.0f * (yr - zr);

    return Lab(L, a, b);
}

float RGB::pivotXYZ(float n) noexcept
{
    return n > XYZ::EPSILON ? std::cbrt(n) : (XYZ::KAPPA * n + 16.0f) / 116.0f;
}

bool RGB::operator==(const RGB &rhs) const noexcept
{
    return m_r == rhs.m_r && m_g == rhs.m_g && m_b == rhs.m_b;
}

bool RGB::operator!=(const RGB &rhs) const noexcept
{
    return !(*this == rhs);
}

std::ostream &operator<<(std::ostream &os, const RGB &RGB)
{
    return os << "RGB(" << static_cast<int>(RGB.m_r) << ", "
              << static_cast<int>(RGB.m_g) << ", " << static_cast<int>(RGB.m_b)
              << ")";
}

RGBA::RGBA(unsigned char r, unsigned char g, unsigned char b,
           unsigned char a) noexcept
    : RGB(r, g, b)
    , m_a(a)
{
}
