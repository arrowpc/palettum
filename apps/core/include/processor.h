#ifndef PROCESSOR_H
#define PROCESSOR_H

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

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
