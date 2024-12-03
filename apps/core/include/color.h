#ifndef COLOR_H
#define COLOR_H

#pragma push_macro("min")
#undef min
#include <simd_utils.h>
#pragma pop_macro("min")
#include <iostream>

#ifndef M_PI
#    define M_PI 3.14159265358979323846264338327950288
#endif

const float pow25_7 = 6103515625.0f;
float const RAD_TO_DEG = 180.0f / M_PI;
float const HALF_DEG_TO_RAD = M_PI / 360.0f;
float const DEG_TO_RAD = M_PI / 180.0f;

class RGB;
class Lab;

struct XYZ {
    float X{0}, Y{0}, Z{0};

    static constexpr float WHITE_X = 95.047f;
    static constexpr float WHITE_Y = 100.000;
    static constexpr float WHITE_Z = 108.883;
    static constexpr float EPSILON = 0.008856;
    static constexpr float KAPPA = 903.3;
};

class Lab
{
public:
    explicit Lab(float L = 0, float a = 0, float b = 0) noexcept;
    [[nodiscard]] RGB toRGB() const noexcept;
    [[nodiscard]] float L() const noexcept;
    [[nodiscard]] float a() const noexcept;
    [[nodiscard]] float b() const noexcept;
    static void deltaE(const Lab &ref, const Lab *comp, float *results,
                       int len);
    [[nodiscard]] float deltaE(const Lab &other) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const Lab &lab);

private:
    float m_L, m_a, m_b;
};

class RGB
{
public:
    explicit RGB(unsigned char r = 0, unsigned char g = 0,
                 unsigned char b = 0) noexcept;
    [[nodiscard]] Lab toLab() const noexcept;
    RGB(std::initializer_list<unsigned char> il) noexcept
    {
        auto it = il.begin();
        m_r = it != il.end() ? *it++ : 0;
        m_g = it != il.end() ? *it++ : 0;
        m_b = it != il.end() ? *it : 0;
    }
    [[nodiscard]] unsigned char red() const noexcept;
    [[nodiscard]] unsigned char green() const noexcept;
    [[nodiscard]] unsigned char blue() const noexcept;
    bool operator==(const RGB &rhs) const noexcept;
    bool operator!=(const RGB &rhs) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const RGB &RGB);

private:
    unsigned char m_r, m_g, m_b;
    [[nodiscard]] static float pivotXYZ(float n) noexcept;
};

#endif  //COLOR_H
