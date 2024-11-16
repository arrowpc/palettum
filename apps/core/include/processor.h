#ifndef PROCESSOR_H
#define PROCESSOR_H

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

struct Image {
    explicit Image(std::string &filename)  // NOLINT(*-pro-type-member-init)
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
    int width;
    int height;
    int channels;
    unsigned char *data;
};

#endif  // PROCESSOR_H
