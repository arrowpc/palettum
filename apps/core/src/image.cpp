#include "image.h"
#include <stb_image.h>
#include <stb_image_resize2.h>
#include <stb_image_write.h>

Image::Image(const unsigned char *buffer, int length)
{
    int width, height, channels;
    uint8_t *data = stbi_load_from_memory(buffer, length, &width, &height,
                                          &channels, STBI_rgb);
    if (!data)
    {
        throw std::runtime_error(
            std::string("Failed to load image from memory: ") +
            stbi_failure_reason());
    }
    m_width = width;
    m_height = height;
    m_channels = 3;
    m_data.assign(data, data + (width * height * m_channels));
    stbi_image_free(data);
}

Image::Image(const std::string &filename)
    : Image(filename.c_str())
{
}

Image::Image(const char *filename)
{
    unsigned char *data =
        stbi_load(filename, &m_width, &m_height, &m_channels, 3);
    if (!data)
    {
        throw std::runtime_error("Failed to load image: " +
                                 std::string(filename));
    }
    m_data.assign(data, data + size());
    stbi_image_free(data);
}

Image::Image(int width, int height)
    : m_width(width)
    , m_height(height)
    , m_data(size())
{
}

int Image::operator-(const Image &other) const
{
    if (m_width != other.m_width || m_height != other.m_height)
    {
        throw std::invalid_argument(
            "Images must have the same dimensions to calculate "
            "difference");
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

std::vector<unsigned char> Image::write() const
{
    int len;
    unsigned char *png_data =
        stbi_write_png_to_mem(m_data.data(), m_width * m_channels, m_width,
                              m_height, m_channels, &len);
    if (!png_data)
    {
        return std::vector<unsigned char>();
    }

    std::vector<unsigned char> result(png_data, png_data + len);
    STBIW_FREE(png_data);

    return result;
}

bool Image::write(const std::string &filename) const
{
    return write(filename.c_str());
}

bool Image::write(const char *filename) const
{
    return stbi_write_png(filename, m_width, m_height, m_channels,
                          m_data.data(), m_width * m_channels);
}

bool Image::resize(int width, int height)
{
    bool res =
        stbir_resize_uint8_linear(m_data.data(), m_width, m_height, 0,
                                  m_data.data(), width, height, 0, STBIR_RGB);
    if (res)
    {
        m_width = width;
        m_height = height;
    }
    return res;
}

RGB Image::get(int x, int y) const
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * m_channels;
    return RGB(m_data[pos], m_data[pos + 1], m_data[pos + 2]);
}

void Image::set(int x, int y, const RGB &RGB)
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * m_channels;
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

const uint8_t *Image::data() const noexcept
{
    return m_data.data();
}

bool Image::operator==(const Image &other) const
{
    return m_width == other.m_width && m_height == other.m_height &&
           m_data == other.m_data;
}

bool Image::operator!=(const Image &other) const
{
    return !(*this == other);
}

void Image::validateCoordinates(int x, int y) const
{
    if (x < 0 || x >= m_width || y < 0 || y >= m_height)
    {
        throw std::out_of_range("RGB coordinates out of bounds");
    }
}

int Image::size() const noexcept
{
    return m_width * m_height * m_channels;
}
