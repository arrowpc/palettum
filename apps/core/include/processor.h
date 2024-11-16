#ifndef PROCESSOR_H
#define PROCESSOR_H

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

struct Pixel {
    unsigned char r, g, b;
    explicit Pixel(unsigned char r = 0, unsigned char g = 0,
                   unsigned char b = 0)
        : r(r)
        , g(g)
        , b(b)
    {
    }
    friend std::ostream &operator<<(std::ostream &os, const Pixel &pixel)
    {
        os << "(" << static_cast<int>(pixel.r) << ", "
           << static_cast<int>(pixel.g) << ", " << static_cast<int>(pixel.b)
           << ")";
        return os;
    }
    bool operator==(const Pixel &rhs) const
    {
        return (this->r == rhs.r && this->g == rhs.g && this->b == rhs.b);
    }
    bool operator!=(const Pixel &rhs) const
    {
        return !(*this == rhs);
    }
};

struct Image {
    explicit Image(  // NOLINT(*-pro-type-member-init)
        const std::string &filename)
    {
        data = stbi_load(filename.c_str(), &width, &height, &channels, 0);
        if (data == nullptr)
            throw std::invalid_argument("Image could not be loaded");
    }
    explicit Image(const char *filename)  // NOLINT(*-pro-type-member-init)
    {
        data = stbi_load(filename, &width, &height, &channels, 0);
        if (data == nullptr)
            throw std::invalid_argument("Image could not be loaded");
    }
    ~Image()
    {
        stbi_image_free(data);
    }
    Pixel get(int x, int y) const
    {
        if (x < 0 || x >= width || y < 0 || y >= height)
        {
            throw std::out_of_range("Pixel coordinates out of bounds");
        }

        size_t pos = (y * width + x) * 3;
        return Pixel(data[pos + 0],  // R
                     data[pos + 1],  // G
                     data[pos + 2]   // B
        );
    }
    void set(int x, int y, const Pixel &pixel) const
    {
        if (x < 0 || x >= width || y < 0 || y >= height)
        {
            throw std::out_of_range("Pixel coordinates out of bounds");
        }
        size_t pos = (y * width + x) * 3;
        data[pos + 0] = pixel.r;
        data[pos + 1] = pixel.g;
        data[pos + 2] = pixel.b;
    }
    bool operator==(Image const &rhs) const
    {
        size_t total_size = static_cast<size_t>(width) *
                            static_cast<size_t>(height) *
                            static_cast<size_t>(channels);
        return std::memcmp(data, rhs.data, total_size) == 0;
    }
    bool operator!=(Image const &rhs) const
    {
        return !(*this == rhs);
    }
    int width;
    int height;
    int channels;
    unsigned char *data;
};

class processor
{
public:
    static bool write(Image &image, const std::string &filename)
    {
        return stbi_write_png(filename.c_str(), image.width, image.height,
                              image.channels, image.data,
                              image.width * image.channels);
    }
    static bool write(Image &image, const char *filename)
    {
        return stbi_write_png(filename, image.width, image.height,
                              image.channels, image.data,
                              image.width * image.channels);
    }
};

#endif  // PROCESSOR_H
