#pragma once

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#define STB_IMAGE_RESIZE_IMPLEMENTATION
#include <memory>
#include <vector>
#include "color/rgb.h"

class Image
{
public:
    explicit Image() = default;
    explicit Image(const unsigned char *buffer, int length);
    explicit Image(const std::string &filename);
    explicit Image(const char *filename);
    explicit Image(int width, int height);
    explicit Image(int width, int height, bool withAlpha);
    [[nodiscard]] bool hasAlpha() const noexcept
    {
        return m_channels == 4;
    }
    Image(const Image &) = default;
    Image &operator=(const Image &) = default;
    int operator-(const Image &other) const;

    [[nodiscard]] std::vector<unsigned char> write() const;
    [[nodiscard]] bool write(const std::string &filename) const;
    bool write(const char *filename) const;

    bool resize(int width, int height);
    [[nodiscard]] RGBA get(int x, int y) const;
    void set(int x, int y, const RGBA &color);
    void set(int x, int y, const RGB &color);
    [[nodiscard]] int width() const noexcept;
    [[nodiscard]] int height() const noexcept;
    [[nodiscard]] int channels() const noexcept;
    [[nodiscard]] int size() const noexcept;
    [[nodiscard]] const uint8_t *data() const noexcept;
    bool operator==(const Image &other) const;
    bool operator!=(const Image &other) const;

private:
    void validateCoordinates(int x, int y) const;
    int m_width{0}, m_height{0}, m_channels{3};
    std::vector<uint8_t> m_data;
};
