#ifndef PROCESSOR_H
#define PROCESSOR_H

#include <cmath>
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

class Lab
{
public:
    explicit Lab(double L = 0, double a = 0, double b = 0) noexcept;
    [[nodiscard]] constexpr double L() const noexcept;
    [[nodiscard]] constexpr double a() const noexcept;
    [[nodiscard]] constexpr double b() const noexcept;
    [[nodiscard]] double deltaE(const Lab &other) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const Lab &lab);

private:
    double m_L;
    double m_a;
    double m_b;

    static double fastPow(double a, double b);
    static double deg2Rad(const double deg);
    static double FastAtan(double x);
    static double FastAtan2(double y, double x);
};

class Pixel
{
public:
    explicit Pixel(unsigned char r = 0, unsigned char g = 0,
                   unsigned char b = 0) noexcept;
    [[nodiscard]] unsigned char red() const noexcept;
    [[nodiscard]] unsigned char green() const noexcept;
    [[nodiscard]] unsigned char blue() const noexcept;
    bool operator==(const Pixel &rhs) const noexcept;
    bool operator!=(const Pixel &rhs) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const Pixel &pixel);

private:
    unsigned char m_r, m_g, m_b;
};

class Image
{
public:
    explicit Image(const std::string &filename);
    explicit Image(const char *filename);
    ~Image();
    Image(const Image &) = delete;
    Image &operator=(const Image &) = delete;
    Image(Image &&other) noexcept;
    Image &operator=(Image &&other) noexcept;

    bool write(const std::string &filename);
    bool write(const char *filename);
    [[nodiscard]] Pixel get(int x, int y) const;
    void set(int x, int y, const Pixel &pixel);
    [[nodiscard]] int width() const noexcept;
    [[nodiscard]] int height() const noexcept;
    [[nodiscard]] int channels() const noexcept;
    [[nodiscard]] const unsigned char *data() const noexcept;
    bool operator==(const Image &rhs) const;
    bool operator!=(const Image &rhs) const;

private:
    void validateCoordinates(int x, int y) const;
    int m_width;
    int m_height;
    int m_channels;
    unsigned char *m_data;
};

#endif  // PROCESSOR_H
