#ifndef PROCESSOR_H
#define PROCESSOR_H

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

class Pixel
{
public:
    explicit Pixel(unsigned char r = 0, unsigned char g = 0,
                   unsigned char b = 0) noexcept
        : m_r(r)
        , m_g(g)
        , m_b(b)
    {
    }

    [[nodiscard]] unsigned char red() const noexcept
    {
        return m_r;
    }
    [[nodiscard]] unsigned char green() const noexcept
    {
        return m_g;
    }
    [[nodiscard]] unsigned char blue() const noexcept
    {
        return m_b;
    }

    bool operator==(const Pixel &rhs) const noexcept
    {
        return m_r == rhs.m_r && m_g == rhs.m_g && m_b == rhs.m_b;
    }

    bool operator!=(const Pixel &rhs) const noexcept
    {
        return !(*this == rhs);
    }

    friend std::ostream &operator<<(std::ostream &os, const Pixel &pixel)
    {
        return os << '(' << static_cast<int>(pixel.m_r) << ", "
                  << static_cast<int>(pixel.m_g) << ", "
                  << static_cast<int>(pixel.m_b) << ')';
    }

private:
    unsigned char m_r, m_g, m_b;
};

class Image
{
public:
    explicit Image(const std::string &filename)
        : Image(filename.c_str())
    {
    }

    explicit Image(const char *filename)
    {
        m_data = stbi_load(filename, &m_width, &m_height, &m_channels, 3);
        if (!m_data)
        {
            throw std::runtime_error("Failed to load image: " +
                                     std::string(filename));
        }
    }

    ~Image()
    {
        if (m_data)
        {
            stbi_image_free(m_data);
        }
    }

    Image(const Image &) = delete;
    Image &operator=(const Image &) = delete;

    Image(Image &&other) noexcept
        : m_width(other.m_width)
        , m_height(other.m_height)
        , m_channels(other.m_channels)
        , m_data(other.m_data)
    {
        other.m_data = nullptr;
    }

    Image &operator=(Image &&other) noexcept
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
    bool write(const std::string &filename)
    {
        return write(filename.c_str());
    }

    bool write(const char *filename)
    {
        return stbi_write_png(filename, m_width, m_height, m_channels, m_data,
                              m_width * m_channels);
    }

    [[nodiscard]] Pixel get(int x, int y) const
    {
        validateCoordinates(x, y);
        size_t pos = (y * m_width + x) * 3;
        return Pixel(m_data[pos], m_data[pos + 1], m_data[pos + 2]);
    }

    void set(int x, int y, const Pixel &pixel)
    {
        validateCoordinates(x, y);
        size_t pos = (y * m_width + x) * 3;
        m_data[pos] = pixel.red();
        m_data[pos + 1] = pixel.green();
        m_data[pos + 2] = pixel.blue();
    }

    [[nodiscard]] int width() const noexcept
    {
        return m_width;
    }
    [[nodiscard]] int height() const noexcept
    {
        return m_height;
    }
    [[nodiscard]] int channels() const noexcept
    {
        return m_channels;
    }
    [[nodiscard]] const unsigned char *data() const noexcept
    {
        return m_data;
    }

    bool operator==(const Image &rhs) const
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

    bool operator!=(const Image &rhs) const
    {
        return !(*this == rhs);
    }

private:
    void validateCoordinates(int x, int y) const
    {
        if (x < 0 || x >= m_width || y < 0 || y >= m_height)
        {
            throw std::out_of_range("Pixel coordinates out of bounds");
        }
    }

    int m_width;
    int m_height;
    int m_channels;
    unsigned char *m_data;
};

#endif  // PROCESSOR_H
