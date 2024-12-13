#include "palettum.h"

Image Palettum::convertToPalette(Image &image, std::vector<RGB> &palette)
{
    Image result(image.width(), image.height());
    std::vector<Lab> constants_lab(palette.size());
#pragma omp parallel for
    for (int i = 0; i < palette.size(); ++i)
    {
        constants_lab[i] = palette[i].toLab();
    }
    const int height = image.height();
    const int width = image.width();
#pragma omp parallel
    {
        std::unordered_map<RGB, RGB> cache;

#pragma omp for collapse(2) schedule(dynamic)
        for (int y = 0; y < height; ++y)
        {
            for (int x = 0; x < width; ++x)
            {
                RGB currentPixel = image.get(x, y);
                RGB closestColor;

                auto it = cache.find(currentPixel);
                if (it != cache.end())
                {
                    closestColor = it->second;
                }
                else
                {
                    float closestDE = 250.0f;
                    std::vector<float> results(palette.size());
                    Lab::deltaE(currentPixel.toLab(), constants_lab.data(),
                                results.data(), palette.size());
                    for (size_t i{}; i < palette.size(); ++i)
                    {
                        if (results[i] < closestDE)
                        {
                            closestDE = results[i];
                            closestColor = palette[i];
                        }
                    }
                    cache[currentPixel] = closestColor;
                }
                result.set(x, y, closestColor);
            }
        }
    }
    return result;
}

bool Palettum::validateImageColors(Image &image, std::vector<RGB> &palette)
{
    const int height = image.height();
    const int width = image.width();
    bool isValid = true;
#pragma omp parallel for collapse(2) schedule(dynamic)
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            bool foundMatch = false;
            for (const auto &color : palette)
            {
                if (image.get(x, y) == color)
                    foundMatch = true;
            }
            if (!foundMatch)
                isValid = false;
        }
    }
    return isValid;
}
