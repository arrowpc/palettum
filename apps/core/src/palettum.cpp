#include "palettum.h"

Image Palettum::convertToPalette(Image &image, std::vector<RGB> &palette,
                                 int transparent_threshold)
{
    Image result(image.width(), image.height(), image.hasAlpha());
    std::vector<Lab> constants_lab(palette.size());
    RGBCache cache;

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
            RGBA currentPixel = image.get(x, y);

            if (currentPixel.alpha() < transparent_threshold)
            {
                result.set(x, y, RGBA(0, 0, 0, 0));
                continue;
            }

            auto closestColor = cache.get(currentPixel);

            if (!closestColor)
            {
                float closestDE = 250.0f;
                std::vector<float> results(palette.size());
                Lab::deltaE(currentPixel.toLab(), constants_lab.data(),
                            results.data(), palette.size());

                for (size_t i = 0; i < palette.size(); ++i)
                {
                    if (results[i] < closestDE)
                    {
                        closestDE = results[i];
                        closestColor = palette[i];
                    }
                }
                cache.set(currentPixel, *closestColor);
            }

            result.set(x, y, *closestColor);
        }
    }
    return result;
}

GIF Palettum::convertToPalette(GIF &gif, std::vector<RGB> &palette,
                               int transparent_threshold)
{
    std::vector<Lab> constants_lab(palette.size());
    RGBCache cache;

    GIF result = gif;

    for (size_t frameIndex = 0; frameIndex < result.frameCount(); ++frameIndex)
    {
        result.setPalette(frameIndex, palette);
    }

#pragma omp parallel for
    for (int i = 0; i < palette.size(); ++i)
    {
        constants_lab[i] = palette[i].toLab();
    }

    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
    {
        const auto &sourceFrame = gif.getFrame(frameIndex);

        const int height = sourceFrame.image.height();
        const int width = sourceFrame.image.width();

#pragma omp parallel for collapse(2) schedule(dynamic)
        for (int y = 0; y < height; ++y)
        {
            for (int x = 0; x < width; ++x)
            {
                RGBA currentPixel = sourceFrame.image.get(x, y);

                if (currentPixel.alpha() < transparent_threshold)
                {
                    result.setPixel(frameIndex, x, y, RGBA(0, 0, 0, 0));
                    continue;
                }

                auto closestColor = cache.get(currentPixel);
                if (!closestColor)
                {
                    float closestDE = 250.0f;
                    std::vector<float> results(palette.size());
                    Lab::deltaE(currentPixel.toLab(), constants_lab.data(),
                                results.data(), palette.size());
                    for (size_t i = 0; i < palette.size(); ++i)
                    {
                        if (results[i] < closestDE)
                        {
                            closestDE = results[i];
                            closestColor = palette[i];
                        }
                    }
                    cache.set(currentPixel, *closestColor);
                }
                result.setPixel(frameIndex, x, y, *closestColor);
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
            const RGBA currentPixel = image.get(x, y);
            bool foundMatch = false;
            for (const auto &color : palette)
            {
                if (currentPixel.red() == color.red() &&
                    currentPixel.green() == color.green() &&
                    currentPixel.blue() == color.blue())
                    foundMatch = true;
            }
            if (!foundMatch)
                isValid = false;
        }
    }
    return isValid;
}
