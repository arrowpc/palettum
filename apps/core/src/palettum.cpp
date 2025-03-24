#include "palettum.h"

namespace palettum {

RGB rbfInterpolation(const RGB &target, const std::vector<RGB> &palette,
                     double sigma)
{
    double numeratorR = 0.0, numeratorG = 0.0, numeratorB = 0.0,
           denominator = 0.0;

    for (const auto &pColor : palette)
    {
        double dr = static_cast<double>(target.red()) -
                    static_cast<double>(pColor.red());
        double dg = static_cast<double>(target.green()) -
                    static_cast<double>(pColor.green());
        double db = static_cast<double>(target.blue()) -
                    static_cast<double>(pColor.blue());
        double distance = std::sqrt(dr * dr + dg * dg + db * db);
        double weight = std::exp(-distance * distance / (2 * sigma * sigma));

        numeratorR += static_cast<double>(pColor.red()) * weight;
        numeratorG += static_cast<double>(pColor.green()) * weight;
        numeratorB += static_cast<double>(pColor.blue()) * weight;
        denominator += weight;
    }

    if (denominator > 0)
    {
        return RGB{static_cast<uint8_t>(std::round(numeratorR / denominator)),
                   static_cast<uint8_t>(std::round(numeratorG / denominator)),
                   static_cast<uint8_t>(std::round(numeratorB / denominator))};
    }
    return RGB{0, 0, 0};  // Fallback
}

RGB findClosestPaletteColor(const Lab &lab, const std::vector<Lab> &labPalette,
                            const Config &config)
{
    std::vector<float> results =
        deltaE(lab, labPalette, config.formula, config.architecture);
    float min_de = std::numeric_limits<float>::max();
    size_t closest_idx = 0;
    for (size_t i = 0; i < labPalette.size(); ++i)
    {
        if (results[i] < min_de)
        {
            min_de = results[i];
            closest_idx = i;
        }
    }
    return config.palette[closest_idx];
}

RGB computeMappedColor(const RGB &target, const Config &config,
                       const std::vector<Lab> &labPalette)
{
    if (config.mapping == Mapping::CIEDE_PALETTIZED)
    {
        Lab lab = target.toLab();
        return findClosestPaletteColor(lab, labPalette, config);
    }
    else if (config.mapping == Mapping::RBF_PALETTIZED)
    {
        RGB interpolated =
            rbfInterpolation(target, config.palette, config.sigma);
        Lab lab = interpolated.toLab();
        return findClosestPaletteColor(lab, labPalette, config);
    }
    else if (config.mapping == Mapping::RBF_INTERPOLATED)
    {
        return rbfInterpolation(target, config.palette, config.sigma);
    }
}

std::vector<RGB> generateLookupTable(const Config &config,
                                     const std::vector<Lab> &labPalette)
{
    const uint8_t q = config.quantLevel;
    const uint8_t bins = 256 >> q;
    const size_t table_size = static_cast<size_t>(bins) * bins * bins;
    std::vector<RGB> lookup(table_size);

#pragma omp parallel for collapse(3) schedule(dynamic)
    for (int r = 0; r < bins; ++r)
    {
        for (int g = 0; g < bins; ++g)
        {
            for (int b = 0; b < bins; ++b)
            {
                int rounding = (q > 0) ? (1 << (q - 1)) : 0;
                uint8_t r_val = ((r << q) + rounding);
                uint8_t g_val = ((g << q) + rounding);
                uint8_t b_val = ((b << q) + rounding);
                RGB target{r_val, g_val, b_val};
                RGB result = computeMappedColor(target, config, labPalette);
                size_t index = (static_cast<size_t>(r) * bins + g) * bins + b;
                lookup[index] = result;
            }
        }
    }
    return lookup;
}

RGB getClosestColor(const RGBA &pixel, const Config &config,
                    const std::vector<Lab> &labPalette, RGBCache &cache,
                    const std::vector<RGB> *lookup)
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
        return (*lookup)[index];
    }

    RGB target{pixel.red(), pixel.green(), pixel.blue()};
    auto cachedColor = cache.get(target);
    if (cachedColor)
    {
        return *cachedColor;
    }

    RGB result = computeMappedColor(target, config, labPalette);
    cache.set(target, result);
    return result;
}

void processPixels(const Image &source, Image &target, const Config &config,
                   const std::vector<Lab> &labPalette, RGBCache &cache,
                   const std::vector<RGB> *lookup)
{
    const size_t width = source.width();
    const size_t height = source.height();

#pragma omp parallel for collapse(2) schedule(dynamic)
    for (size_t y = 0; y < height; ++y)
    {
        for (size_t x = 0; x < width; ++x)
        {
            RGBA currentPixel = source.get(x, y);
            if (currentPixel.alpha() < config.transparencyThreshold)
            {
                target.set(x, y, RGBA(0, 0, 0, 0));
            }
            else
            {
                RGB closestColor = getClosestColor(currentPixel, config,
                                                   labPalette, cache, lookup);
                target.set(x, y, closestColor);
            }
        }
    }
}

Image palettify(Image &image, Config &config)
{
    const size_t width = image.width();
    const size_t height = image.height();
    Image result(width, height, image.hasAlpha());
    result.setMapping(config.mapping);

    if (config.mapping == Mapping::RBF_PALETTIZED ||
        config.mapping == Mapping::CIEDE_PALETTIZED)
    {
        result.setPalette(config.palette);
    }

    const size_t palette_size = config.palette.size();
    std::vector<Lab> labPalette(palette_size);

#pragma omp parallel for schedule(static)
    for (size_t i = 0; i < palette_size; ++i)
    {
        labPalette[i] = config.palette[i].toLab();
    }

    RGBCache cache;
    std::vector<RGB> lookup;
    if (config.quantLevel > 0)
    {
        lookup = generateLookupTable(config, labPalette);
    }

    processPixels(image, result, config, labPalette, cache,
                  config.quantLevel > 0 ? &lookup : nullptr);
    return result;
}

GIF palettify(GIF &gif, Config &config)
{
    if (config.mapping == Mapping::UNTOUCHED ||
        config.mapping == Mapping::RBF_INTERPOLATED)
    {
        throw std::runtime_error(
            "GIFs are inherently palettized, can't use interpolation.");
    }

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
    std::vector<RGB> lookup;
    if (config.quantLevel > 0)
    {
        lookup = generateLookupTable(config, labPalette);
    }

    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
    {
        const auto &sourceFrame = gif.getFrame(frameIndex);
        auto &targetFrame = result.getFrame(frameIndex);
        processPixels(sourceFrame.image, targetFrame.image, config, labPalette,
                      cache, config.quantLevel > 0 ? &lookup : nullptr);
    }

    return result;
}

bool validate(Image &image, Config &config)
{
    if (config.mapping == Mapping::RBF_INTERPOLATED)
    {
        return true;  // Skip validation as output is not palettized
    }

    const int height = image.height();
    const int width = image.width();
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            const RGBA currentPixel = image.get(x, y);
            if (currentPixel.alpha() < config.transparencyThreshold)
            {
                continue;
            }
            bool foundMatch = false;
            for (const auto &color : config.palette)
            {
                if (currentPixel.red() == color.red() &&
                    currentPixel.green() == color.green() &&
                    currentPixel.blue() == color.blue())
                {
                    foundMatch = true;
                    break;
                }
            }
            if (!foundMatch)
            {
                return false;
            }
        }
    }
    return true;
}
}  // namespace palettum
