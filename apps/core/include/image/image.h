#pragma once

#include <mtpng.h>
#include <png.h>
#include <pngconf.h>
#include <turbojpeg.h>
#include <webp/decode.h>
#include <cstring>
#include <memory>
#include <unordered_map>
#include <vector>
#include "color/rgb.h"
#include "config.h"

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

    void setMapping(Mapping type)
    {
        m_mapping = type;
    }
    Mapping getMapping() const
    {
        return m_mapping;
    }

    void setPalette(const std::vector<RGB> &palette);
    bool hasPalette() const
    {
        return m_hasPalette;
    }
    const std::vector<RGB> &getPalette() const
    {
        return m_palette;
    }

    bool writeIndexed(const std::string &filename) const;
    std::vector<unsigned char> writeIndexedToMemory() const;

private:
    void validateCoordinates(int x, int y) const;
    int m_width{0}, m_height{0}, m_channels{3};
    std::vector<uint8_t> m_data;

    std::vector<RGB> m_palette;
    bool m_hasPalette = false;
    Mapping m_mapping = Mapping::UNTOUCHED;
};

// LIBPNG STUFFS
struct PngMemoryReader {
    const unsigned char *data;
    size_t size;
    size_t offset;
};

static void png_memory_read(png_structp png_ptr, png_bytep outBytes,
                            png_size_t byteCountToRead)
{
    PngMemoryReader *reader =
        reinterpret_cast<PngMemoryReader *>(png_get_io_ptr(png_ptr));
    if (reader->offset + byteCountToRead > reader->size)
    {
        png_error(png_ptr, "Read Error");
    }
    std::memcpy(outBytes, reader->data + reader->offset, byteCountToRead);
    reader->offset += byteCountToRead;
}
