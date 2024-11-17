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

RGB Lab::toRGB() const noexcept
{
    double y = (m_L + 16.0) / 116.0;
    double x = m_a / 500.0 + y;
    double z = y - m_b / 200.0;

    XYZ xyz;
    double x3 = x * x * x;
    double z3 = z * z * z;

    xyz.X =
        XYZ::WHITE_X * (x3 > XYZ::EPSILON ? x3 : (x - 16.0 / 116.0) / 7.787);
    xyz.Y = XYZ::WHITE_Y * (m_L > (XYZ::KAPPA * XYZ::EPSILON)
                                ? std::pow((m_L + 16.0) / 116.0, 3)
                                : m_L / XYZ::KAPPA);
    xyz.Z =
        XYZ::WHITE_Z * (z3 > XYZ::EPSILON ? z3 : (z - 16.0 / 116.0) / 7.787);

    xyz.X /= 100.0;
    xyz.Y /= 100.0;
    xyz.Z /= 100.0;

    double r = xyz.X * 3.2404542 - xyz.Y * 1.5371385 - xyz.Z * 0.4985314;
    double g = xyz.X * -0.9692660 + xyz.Y * 1.8760108 + xyz.Z * 0.0415560;
    double b = xyz.X * 0.0556434 - xyz.Y * 0.2040259 + xyz.Z * 1.0572252;

    r = (r > 0.0031308) ? 1.055 * std::pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = (g > 0.0031308) ? 1.055 * std::pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    b = (b > 0.0031308) ? 1.055 * std::pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

    r = std::clamp(r, 0.0, 1.0) * 255.0;
    g = std::clamp(g, 0.0, 1.0) * 255.0;
    b = std::clamp(b, 0.0, 1.0) * 255.0;

    return RGB(static_cast<unsigned char>(std::round(r)),
               static_cast<unsigned char>(std::round(g)),
               static_cast<unsigned char>(std::round(b)));
}

double Lab::L() const noexcept
{
    return m_L;
}
double Lab::a() const noexcept
{
    return m_a;
}
double Lab::b() const noexcept
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
    if (x == 0 && y == 0)
        return 0;

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

RGB::RGB(unsigned char r, unsigned char g, unsigned char b) noexcept
    : m_r(r)
    , m_g(g)
    , m_b(b)
{
}

Lab RGB::toLab() const noexcept
{
    double r = m_r / 255.0;
    double g = m_g / 255.0;
    double b = m_b / 255.0;

    r = (r > 0.04045) ? std::pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? std::pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? std::pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    XYZ xyz;
    xyz.X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    xyz.Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    xyz.Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

    xyz.X = xyz.X * 100.0;
    xyz.Y = xyz.Y * 100.0;
    xyz.Z = xyz.Z * 100.0;

    double xr = xyz.X / XYZ::WHITE_X;
    double yr = xyz.Y / XYZ::WHITE_Y;
    double zr = xyz.Z / XYZ::WHITE_Z;

    xr = pivotXYZ(xr);
    yr = pivotXYZ(yr);
    zr = pivotXYZ(zr);

    double L = std::max(0.0, 116.0 * yr - 16.0);
    double a = 500.0 * (xr - yr);
    b = 200.0 * (yr - zr);

    return Lab(L, a, b);
}

double RGB::pivotXYZ(double n) noexcept
{
    return n > XYZ::EPSILON ? std::cbrt(n) : (XYZ::KAPPA * n + 16.0) / 116.0;
}

unsigned char RGB::red() const noexcept
{
    return m_r;
}
unsigned char RGB::green() const noexcept
{
    return m_g;
}
unsigned char RGB::blue() const noexcept
{
    return m_b;
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
    return os << '(' << static_cast<int>(RGB.m_r) << ", "
              << static_cast<int>(RGB.m_g) << ", " << static_cast<int>(RGB.m_b)
              << ')';
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

Image::Image(int width, int height, unsigned char *data)
    : m_width(width)
    , m_height(height)
    , m_channels(3)
{
    size_t size = width * height * 3;
    m_data = new unsigned char[size];
    if (data)
        std::memcpy(m_data, data, size);
}

Image::~Image()
{
    if (m_data)
    {
        stbi_image_free(m_data);
        m_data = nullptr;
    }
}

void Image::copyFrom(const Image &other)
{
    m_width = other.m_width;
    m_height = other.m_height;
    m_channels = other.m_channels;

    if (other.m_data)
    {
        const size_t size = m_width * m_height * m_channels;
        m_data = new unsigned char[size];
        std::memcpy(m_data, other.m_data, size);
    }
    else
    {
        m_data = nullptr;
    }
}

Image::Image(const Image &other)
    : m_data(nullptr)
{
    copyFrom(other);
}

Image &Image::operator=(const Image &other)
{
    if (this != &other)
    {
        stbi_image_free(m_data);
        m_data = nullptr;
        copyFrom(other);
    }
    return *this;
}

int Image::operator-(const Image &other) const
{
    if (m_width != other.m_width || m_height != other.m_height)
    {
        throw std::invalid_argument(
            "Images must have the same dimensions to calculate difference");
    }

    int differentPixels = 0;

    for (int y = 0; y < m_height; ++y)
    {
        for (int x = 0; x < m_width; ++x)
        {
            RGB thisColor = get(x, y);
            RGB otherColor = other.get(x, y);

            if (abs(thisColor.red() - otherColor.red()) > 5 ||
                abs(thisColor.green() - otherColor.green()) > 5 ||
                abs(thisColor.blue() - otherColor.blue()) > 5)
            {
                differentPixels++;
            }
        }
    }

    return differentPixels;
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

RGB Image::get(int x, int y) const
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * 3;
    return RGB(m_data[pos], m_data[pos + 1], m_data[pos + 2]);
}

void Image::set(int x, int y, const RGB &RGB)
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * 3;
    m_data[pos] = RGB.red();
    m_data[pos + 1] = RGB.green();
    m_data[pos + 2] = RGB.blue();
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
        throw std::out_of_range("RGB coordinates out of bounds");
    }
}
