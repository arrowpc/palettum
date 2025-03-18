#include "palettum.h"

namespace palettum {

std::vector<uint8_t> lookup_deltaE(const Config &config,
                                   const std::vector<Lab> &constants_lab)
{
    const uint8_t q = config.quantLevel;
    const uint8_t rBins = 256 >> q;
    const uint8_t gBins = 256 >> q;
    const uint8_t bBins = 256 >> q;
    const size_t table_size = static_cast<size_t>(rBins) * gBins * bBins;
    std::vector<uint8_t> lookup(table_size);

#pragma omp parallel for collapse(3) schedule(dynamic)
    for (int r = 0; r < rBins; ++r)
    {
        for (int g = 0; g < gBins; ++g)
        {
            for (int b = 0; b < bBins; ++b)
            {
                int rounding = (q > 0) ? (1 << (q - 1)) : 0;

                uint8_t r_val = ((r << q) + rounding);
                uint8_t g_val = ((g << q) + rounding);
                uint8_t b_val = ((b << q) + rounding);

                Lab lab = RGB(r_val, g_val, b_val).toLab();
                std::vector<float> results = deltaE(
                    lab, constants_lab, config.formula, config.architecture);
                float min_de = std::numeric_limits<float>::max();
                uint8_t closest_idx = 0;
                for (size_t i = 0; i < config.palette.size(); ++i)
                {
                    if (results[i] < min_de)
                    {
                        min_de = results[i];
                        closest_idx = static_cast<uint8_t>(i);
                    }
                }
                size_t index = (static_cast<size_t>(r) * gBins + g) * bBins + b;
                lookup[index] = closest_idx;
            }
        }
    }
    return lookup;
}

RGB getClosestColor(const RGBA &pixel, const Config &config,
                    const std::vector<Lab> &labPalette, RGBCache &cache,
                    std::vector<float> &results,
                    const std::vector<uint8_t> *lookup = nullptr)
{
    if (lookup && config.quantLevel > 0)
    {
        const uint8_t q = config.quantLevel;
        const uint8_t binsPerChannel = 256 >> q;

        uint8_t r_q = pixel.red() >> q;
        uint8_t g_q = pixel.green() >> q;
        uint8_t b_q = pixel.blue() >> q;

        size_t index =
            (static_cast<size_t>(r_q) * binsPerChannel + g_q) * binsPerChannel +
            b_q;
        return config.palette[(*lookup)[index]];
    }

    auto cachedColor = cache.get(pixel);
    if (cachedColor)
    {
        return *cachedColor;
    }

    Lab currentLab = pixel.toLab();
    results =
        deltaE(currentLab, labPalette, config.formula, config.architecture);

    float closestDE = std::numeric_limits<float>::max();
    size_t closestIdx = 0;

    for (size_t i = 0; i < config.palette.size(); ++i)
    {
        if (results[i] < closestDE)
        {
            closestDE = results[i];
            closestIdx = i;
        }
    }

    RGB closestColor = config.palette[closestIdx];
    cache.set(pixel, closestColor);
    return closestColor;
}

Image palettify(Image &image, Config &config)
{
    const size_t width = image.width();
    const size_t height = image.height();
    Image result(width, height, image.hasAlpha());

    result.setPalette(config.palette);

    const size_t palette_size = config.palette.size();
    std::vector<Lab> labPalette(palette_size);

#pragma omp parallel for schedule(static)
    for (size_t i = 0; i < palette_size; ++i)
    {
        labPalette[i] = config.palette[i].toLab();
    }

    RGBCache cache;
    std::vector<uint8_t> lookup;

    if (config.quantLevel > 0)
    {
        lookup = lookup_deltaE(config, labPalette);
    }

    thread_local std::vector<float> results;
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
                }
                else
                {
                    RGB closestColor = getClosestColor(
                        currentPixel, config, labPalette, cache, results,
                        config.quantLevel > 0 ? &lookup : nullptr);
                    result.set(x, y, closestColor);
                }
            }
        }
    }

    return result;
}

GIF palettify(GIF &gif, Config &config)
{
    GIF result = gif;

    for (size_t frameIndex = 0; frameIndex < result.frameCount(); ++frameIndex)
    {
        result.setPalette(frameIndex, config.palette);
    }

    const size_t palette_size = config.palette.size();
    std::vector<Lab> labPalette(palette_size);

#pragma omp parallel for schedule(static)
    for (size_t i = 0; i < palette_size; ++i)
    {
        labPalette[i] = config.palette[i].toLab();
    }

    RGBCache cache;
    std::vector<uint8_t> lookup;

    if (config.quantLevel > 0)
    {
        lookup = lookup_deltaE(config, labPalette);
    }

    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
    {
        const auto &sourceFrame = gif.getFrame(frameIndex);
        const size_t height = sourceFrame.image.height();
        const size_t width = sourceFrame.image.width();

        thread_local std::vector<float> results;
#pragma omp parallel
        {
            results.resize(palette_size);

#pragma omp for collapse(2) schedule(dynamic)
            for (size_t y = 0; y < height; ++y)
            {
                for (size_t x = 0; x < width; ++x)
                {
                    RGBA currentPixel = sourceFrame.image.get(x, y);

                    if (currentPixel.alpha() < config.transparencyThreshold)
                    {
                        result.setPixel(frameIndex, x, y, RGBA(0, 0, 0, 0));
                    }
                    else
                    {
                        RGB closestColor = getClosestColor(
                            currentPixel, config, labPalette, cache, results,
                            config.quantLevel > 0 ? &lookup : nullptr);
                        result.setPixel(frameIndex, x, y, closestColor);
                    }
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
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            const RGBA currentPixel = image.get(x, y);

            if (currentPixel.alpha() < config.transparencyThreshold)
                continue;
            bool foundMatch = false;
            for (const auto &color : config.palette)
            {
                if (currentPixel.red() == color.red() &&
                    currentPixel.green() == color.green() &&
                    currentPixel.blue() == color.blue())
                    foundMatch = true;
            }
            if (!foundMatch)
                return false;
        }
    }
    return true;
}
}  // namespace palettum
