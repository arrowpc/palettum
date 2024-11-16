#include "processor.h"

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

Lab::Lab(double L, double a, double b) noexcept
    : m_L(L)
    , m_a(a)
    , m_b(b)
{
}

constexpr double Lab::L() const noexcept
{
    return m_L;
}
constexpr double Lab::a() const noexcept
{
    return m_a;
}
constexpr double Lab::b() const noexcept
{
    return m_b;
}

double Lab::deltaE(const Lab &other) const noexcept
{
    const double lBarPrime = (this->L() + other.L()) * 0.5;
    const double c1 = std::sqrt(this->a() * this->a() + this->b() * this->b());
    const double c2 = std::sqrt(other.a() * other.a() + other.b() * other.b());
    const double cBar = (c1 + c2) * 0.5;
    const double g = (1 - std::sqrt(fastPow(cBar, 7) /
                                    (fastPow(cBar, 7) + fastPow(25.0, 7)))) *
                     0.5;
    const double a1Prime = this->a() * (1 + g);
    const double a2Prime = other.a() * (1 + g);
    const double c1Prime = std::sqrt(a1Prime * a1Prime + this->b() * this->b());
    const double c2Prime = std::sqrt(a2Prime * a2Prime + other.b() * other.b());
    const double cBarPrime = (c1Prime + c2Prime) * 0.5;
    const double h1Prime =
        (FastAtan2(this->b(), a1Prime) + 2 * M_PI) * 180.0 / M_PI;
    const double h2Prime =
        (FastAtan2(other.b(), a2Prime) + 2 * M_PI) * 180.0 / M_PI;

    double deltaLPrime = other.L() - this->L();
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

std::ostream &operator<<(std::ostream &os, const Lab &lab)
{
    return os << "Lab(" << lab.m_L << ", " << lab.m_a << ", " << lab.m_b << ")";
}

double Lab::fastPow(double a, double b)
{
    union {
        double d;
        int x[2];
    } u = {a};
    u.x[1] = (int)(b * (u.x[1] - 1072632447) + 1072632447);
    u.x[0] = 0;
    return u.d;
}

double Lab::deg2Rad(const double deg)
{
    return (deg * (M_PI / 180.0));
}

double Lab::FastAtan(double x)
{
    return M_PI_4 * x - x * (fabs(x) - 1) * (0.2447 + 0.0663 * fabs(x));
}

double Lab::FastAtan2(double y, double x)
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

Pixel::Pixel(unsigned char r, unsigned char g, unsigned char b) noexcept
    : m_r(r)
    , m_g(g)
    , m_b(b)
{
}

unsigned char Pixel::red() const noexcept
{
    return m_r;
}
unsigned char Pixel::green() const noexcept
{
    return m_g;
}
unsigned char Pixel::blue() const noexcept
{
    return m_b;
}

bool Pixel::operator==(const Pixel &rhs) const noexcept
{
    return m_r == rhs.m_r && m_g == rhs.m_g && m_b == rhs.m_b;
}

bool Pixel::operator!=(const Pixel &rhs) const noexcept
{
    return !(*this == rhs);
}

std::ostream &operator<<(std::ostream &os, const Pixel &pixel)
{
    return os << '(' << static_cast<int>(pixel.m_r) << ", "
              << static_cast<int>(pixel.m_g) << ", "
              << static_cast<int>(pixel.m_b) << ')';
}

Image::Image(const std::string &filename)
    : Image(filename.c_str())
{
}

Image::Image(const char *filename)
{
    m_data = stbi_load(filename, &m_width, &m_height, &m_channels, 3);
    if (!m_data)
    {
        throw std::runtime_error("Failed to load image: " +
                                 std::string(filename));
    }
}

Image::~Image()
{
    if (m_data)
    {
        stbi_image_free(m_data);
    }
}

Image::Image(Image &&other) noexcept
    : m_width(other.m_width)
    , m_height(other.m_height)
    , m_channels(other.m_channels)
    , m_data(other.m_data)
{
    other.m_data = nullptr;
}

Image &Image::operator=(Image &&other) noexcept
{
    if (this != &other)
    {
        if (m_data)
        {
            stbi_image_free(m_data);
        }
        m_width = other.m_width;
        m_height = other.m_height;
        m_channels = other.m_channels;
        m_data = other.m_data;
        other.m_data = nullptr;
    }
    return *this;
}

bool Image::write(const std::string &filename)
{
    return write(filename.c_str());
}

bool Image::write(const char *filename)
{
    return stbi_write_png(filename, m_width, m_height, m_channels, m_data,
                          m_width * m_channels);
}

Pixel Image::get(int x, int y) const
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * 3;
    return Pixel(m_data[pos], m_data[pos + 1], m_data[pos + 2]);
}

void Image::set(int x, int y, const Pixel &pixel)
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * 3;
    m_data[pos] = pixel.red();
    m_data[pos + 1] = pixel.green();
    m_data[pos + 2] = pixel.blue();
}

int Image::width() const noexcept
{
    return m_width;
}
int Image::height() const noexcept
{
    return m_height;
}
int Image::channels() const noexcept
{
    return m_channels;
}
const unsigned char *Image::data() const noexcept
{
    return m_data;
}

bool Image::operator==(const Image &rhs) const
{
    if (m_width != rhs.m_width || m_height != rhs.m_height ||
        m_channels != rhs.m_channels)
    {
        return false;
    }
    size_t total_size = static_cast<size_t>(m_width) *
                        static_cast<size_t>(m_height) *
                        static_cast<size_t>(m_channels);
    return std::memcmp(m_data, rhs.m_data, total_size) == 0;
}

bool Image::operator!=(const Image &rhs) const
{
    return !(*this == rhs);
}

void Image::validateCoordinates(int x, int y) const
{
    if (x < 0 || x >= m_width || y < 0 || y >= m_height)
    {
        throw std::out_of_range("Pixel coordinates out of bounds");
    }
}
