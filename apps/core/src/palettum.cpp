#include "palettum.h"

std::vector<float> results;

namespace palettum {

Image palettify(Image &image, Config &config)
{
    Image result(image.width(), image.height(), image.hasAlpha());
    std::vector<Lab> constants_lab(config.palette.size());
    RGBCache cache;

#pragma omp parallel for
    for (size_t i = 0; i < config.palette.size(); ++i)
    {
        constants_lab[i] = config.palette[i].toLab();
    }

    const size_t height = image.height();
    const size_t width = image.width();
    const size_t palette_size = config.palette.size();

#pragma omp parallel
    {
        results.resize(palette_size);

#pragma omp for collapse(2) schedule(dynamic)
        for (size_t y = 0; y < height; ++y)
        {
            for (size_t x = 0; x < width; ++x)
            {
                RGBA currentPixel = image.get(x, y);

                if (currentPixel.alpha() < config.transparencyThreshold)
                {
                    result.set(x, y, RGBA(0, 0, 0, 0));
                    continue;
                }

                auto closestColor = cache.get(currentPixel);

                if (!closestColor)
                {
                    float closestDE = FLT_MAX;
                    Lab currentLab = currentPixel.toLab();

                    results = deltaE(currentLab, constants_lab, config.formula,
                                     config.architecture);
                    for (size_t i = 0; i < palette_size; ++i)
                    {
                        if (results[i] < closestDE)
                        {
                            closestDE = results[i];
                            closestColor = config.palette[i];
                        }
                    }
                    cache.set(currentPixel, *closestColor);
                }

                result.set(x, y, *closestColor);
            }
        }
    }
    return result;
}

GIF palettify(GIF &gif, Config &config)
{
    std::vector<Lab> constants_lab(config.palette.size());
    RGBCache cache;

    GIF result = gif;

    for (size_t frameIndex = 0; frameIndex < result.frameCount(); ++frameIndex)
    {
        result.setPalette(frameIndex, config.palette);
    }

#pragma omp parallel for
    for (size_t i = 0; i < config.palette.size(); ++i)
    {
        constants_lab[i] = config.palette[i].toLab();
    }

    const size_t palette_size = config.palette.size();

    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
    {
        const auto &sourceFrame = gif.getFrame(frameIndex);
        const int height = sourceFrame.image.height();
        const int width = sourceFrame.image.width();

#pragma omp parallel
        {
            results.resize(palette_size);

#pragma omp for collapse(2) schedule(dynamic)
            for (int y = 0; y < height; ++y)
            {
                for (int x = 0; x < width; ++x)
                {
                    RGBA currentPixel = sourceFrame.image.get(x, y);

                    if (currentPixel.alpha() < config.transparencyThreshold)
                    {
                        result.setPixel(frameIndex, x, y, RGBA(0, 0, 0, 0));
                        continue;
                    }

                    auto closestColor = cache.get(currentPixel);

                    if (!closestColor)
                    {
                        float closestDE = FLT_MAX;
                        Lab currentLab = currentPixel.toLab();

                        results = deltaE(currentLab, constants_lab,
                                         config.formula, config.architecture);

                        for (size_t i = 0; i < palette_size; ++i)
                        {
                            if (results[i] < closestDE)
                            {
                                closestDE = results[i];
                                closestColor = config.palette[i];
                            }
                        }
                        cache.set(currentPixel, *closestColor);
                    }

                    result.setPixel(frameIndex, x, y, *closestColor);
                }
            }
        }
    }
    return result;
}

bool validate(Image &image, Config &config)
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
            for (const auto &color : config.palette)
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
}  // namespace palettum
