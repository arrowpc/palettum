#include "palettum.h"

Image Palettum::convertToPalette(Image &image, vector<RGB> &palette)
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

#pragma omp parallel for collapse(2) schedule(dynamic)
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            Lab currentPixel = image.get(x, y).toLab();
            Lab closestColor = constants_lab[0];
            double closestDE = constants_lab[0].deltaE(currentPixel);
            for (int i = 1; i < constants_lab.size(); ++i)
            {
                double dE = constants_lab[i].deltaE(currentPixel);
                if (dE < closestDE)
                {
                    closestDE = dE;
                    closestColor = constants_lab[i];
                }
            }
            result.set(x, y, closestColor.toRGB());
        }
    }
    return result;
}

bool Palettum::validateImageColors(Image &image, vector<RGB> &palette)
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
