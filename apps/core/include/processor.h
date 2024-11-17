#ifndef PROCESSOR_H
#define PROCESSOR_H

#include <algorithm>
#include <cmath>
#include <cstring>
#include <iostream>

#ifndef M_PI
#    define M_PI 3.14159265358979323846264338327950288
#endif

#ifndef M_PI_2
#    define M_PI_2 1.57079632679489661923132169163975144
#endif

#ifndef M_PI_4
#    define M_PI_4 0.785398163397448309615660845819875721
#endif

class RGB;
class Lab;

struct XYZ {
    double X{0}, Y{0}, Z{0};

    static constexpr double WHITE_X = 95.047;
    static constexpr double WHITE_Y = 100.000;
    static constexpr double WHITE_Z = 108.883;

    static constexpr double EPSILON = 0.008856;
    static constexpr double KAPPA = 903.3;
};
class Lab
{
public:
    explicit Lab(double L = 0, double a = 0, double b = 0) noexcept;
    [[nodiscard]] RGB toRGB() const noexcept;
    [[nodiscard]] double L() const noexcept;
    [[nodiscard]] double a() const noexcept;
    [[nodiscard]] double b() const noexcept;
    [[nodiscard]] double deltaE(const Lab &other) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const Lab &lab);

private:
    double m_L;
    double m_a;
    double m_b;

    static double fastPow(double a, double b);
    static double deg2Rad(double deg);
    static double FastAtan(double x);
    static double FastAtan2(double y, double x);
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
    [[nodiscard]] static double pivotXYZ(double n) noexcept;
};

class Image
{
public:
    explicit Image() = default;
    explicit Image(const std::string &filename);
    explicit Image(const char *filename);
    explicit Image(int width, int height);
    Image(const Image &) = default;
    Image &operator=(const Image &) = default;
    int operator-(const Image &other) const;

    bool write(const std::string &filename);
    bool write(const char *filename);
    [[nodiscard]] RGB get(int x, int y) const;
    void set(int x, int y, const RGB &RGB);
    [[nodiscard]] int width() const noexcept;
    [[nodiscard]] int height() const noexcept;
    [[nodiscard]] int channels() const noexcept;
    [[nodiscard]] int size() const noexcept;
    [[nodiscard]] const uint8_t *data() const noexcept;
    bool operator==(const Image &other) const;
    bool operator!=(const Image &other) const;

private:
    void validateCoordinates(int x, int y) const;
    int m_width;
    int m_height;
    int m_channels{3};
    std::vector<uint8_t> m_data;
};

#endif  // PROCESSOR_H
