#include "palettum.h"

namespace palettum {

size_t findClosestPaletteColorIndex(const Lab &lab,
                                    const std::vector<Lab> &labPalette,
                                    const Config &config)
{
    if (labPalette.empty())
        throw std::runtime_error(
            "Palette cannot be empty for finding closest color.");

    std::vector<float> results =
        deltaE(lab, labPalette, config.palettized_formula, config.architecture);

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
    return closest_idx;
}

RGB findClosestPaletteColor(const Lab &lab, const std::vector<Lab> &labPalette,
                            const Config &config)
{
    size_t index = findClosestPaletteColorIndex(lab, labPalette, config);
    return config.palette[index];
}

inline double computeWeight(double distance, const Config &config)
{
    constexpr double epsilon = 1e-9;  // Avoid division by zero or log(0)

    switch (config.anisotropic_kernel)
    {
        case WeightingKernelType::GAUSSIAN: {
            double shape = std::max(epsilon, config.anisotropic_shapeParameter);
            // Clamp exponent input to avoid potential overflow/underflow issues
            double exponent = -std::pow(shape * distance, 2.0);
            return std::exp(std::max(-700.0, exponent));  // exp(-700) is near 0
        }
        case WeightingKernelType::INVERSE_DISTANCE_POWER: {
            double power = std::max(0.0, config.anisotropic_powerParameter);
            return 1.0 / (std::pow(distance, power) + epsilon);
        }
        default:
            return 1.0;
    }
}

RGB computeAnisotropicWeightedAverage(const Lab &targetLab,
                                      const Config &config,
                                      const std::vector<Lab> &labPalette)
{
    if (config.palette.empty())
        throw std::runtime_error(
            "Cannot compute weighted average with empty palette.");

    if (config.palette.size() != labPalette.size())
        throw std::logic_error(
            "RGB palette and Lab palette size mismatch in weighted average.");

    double totalWeight = 0.0;
    double sumR = 0.0, sumG = 0.0, sumB = 0.0;

    const double scaleL = config.anisotropic_labScales[0];
    const double scaleA = config.anisotropic_labScales[1];
    const double scaleB = config.anisotropic_labScales[2];

    for (size_t i = 0; i < config.palette.size(); ++i)
    {
        // Calculate anisotropic distance squared in Lab space
        double dL = static_cast<double>(targetLab.L() - labPalette[i].L());
        double da = static_cast<double>(targetLab.a() - labPalette[i].a());
        double db = static_cast<double>(targetLab.b() - labPalette[i].b());
        double anisotropic_dist_sq =
            (scaleL * dL * dL) + (scaleA * da * da) + (scaleB * db * db);

        double anisotropic_dist = std::sqrt(std::max(0.0, anisotropic_dist_sq));

        double weight = computeWeight(anisotropic_dist, config);

        constexpr double weight_threshold = 1e-9;
        if (weight > weight_threshold)
        {
            totalWeight += weight;
            // Use the original RGB palette color for averaging
            sumR += weight * static_cast<double>(config.palette[i].r);
            sumG += weight * static_cast<double>(config.palette[i].g);
            sumB += weight * static_cast<double>(config.palette[i].b);
        }
    }

    // Avoid division by zero if total weight is negligible
    constexpr double total_weight_threshold = 1e-9;
    if (totalWeight > total_weight_threshold)
    {
        // Calculate the weighted average and clamp to valid RGB range
        uint8_t r = static_cast<uint8_t>(
            std::round(std::clamp(sumR / totalWeight, 0.0, 255.0)));
        uint8_t g = static_cast<uint8_t>(
            std::round(std::clamp(sumG / totalWeight, 0.0, 255.0)));
        uint8_t b = static_cast<uint8_t>(
            std::round(std::clamp(sumB / totalWeight, 0.0, 255.0)));
        return RGB{r, g, b};
    }
    else
    {
        // Fallback: If all weights are near zero (e.g., target color is extremely
        // far from all palette colors in the anisotropic space), return the
        // closest palette color using standard deltaE
        return findClosestPaletteColor(targetLab, labPalette, config);
    }
}

RGBA computeMappedColor(const RGBA &target, const Config &config,
                        const std::vector<Lab> &labPalette)
{
    if (config.mapping == Mapping::UNTOUCHED)
    {
        return target;
    }

    if (config.palette.empty())
    {
        std::cerr << "Warning: computeMappedColor called with empty palette "
                     "for mapping type "
                  << static_cast<int>(config.mapping) << ". Returning target."
                  << std::endl;
        return target;
    }

    RGB targetRGB{target.r, target.g, target.b};
    Lab targetLab = targetRGB.toLab();

    switch (config.mapping)
    {
        case Mapping::PALETTIZED: {
            RGB palettizedColor =
                findClosestPaletteColor(targetLab, labPalette, config);
            return RGBA{palettizedColor.r, palettizedColor.g,
                        palettizedColor.b};
        }
        case Mapping::SMOOTHED: {
            RGB smoothedColor = computeAnisotropicWeightedAverage(
                targetLab, config, labPalette);
            return RGBA{smoothedColor.r, smoothedColor.g, smoothedColor.b};
        }
        case Mapping::SMOOTHED_PALETTIZED: {
            RGB smoothedColor = computeAnisotropicWeightedAverage(
                targetLab, config, labPalette);
            Lab smoothedLab = smoothedColor.toLab();
            RGB palettizedColor =
                findClosestPaletteColor(smoothedLab, labPalette, config);
            return RGBA{palettizedColor.r, palettizedColor.g,
                        palettizedColor.b};
        }
        default:
            std::cerr << "Warning: Unsupported mapping type encountered ("
                      << static_cast<int>(config.mapping)
                      << "). Falling back to PALETTIZED." << std::endl;
            RGB palettizedColor =
                findClosestPaletteColor(targetLab, labPalette, config);
            return RGBA{palettizedColor.r, palettizedColor.g,
                        palettizedColor.b};
    }
}

std::vector<RGB> generateLookupTable(const Config &config,
                                     const std::vector<Lab> &labPalette,
                                     int imageSize = 0)
{
    const uint8_t q = config.quantLevel;
    const uint8_t max_q = 5;

    // Skip LUT generation if quantization is disabled or too high
    if (q == 0 || q >= max_q)
    {
        return {};
    }

    // Only use lookup table for images large enough to benefit from it
    // A reasonable threshold is when the LUT size is smaller than the image size
    const uint8_t bins = 256 >> q;
    const size_t table_size = static_cast<size_t>(bins) * bins * bins;

    // If image is small or quantization level would create a LUT larger than
    // what's beneficial, skip LUT generation
    if (imageSize > 0 && table_size > static_cast<size_t>(imageSize / 4))
    {
        return {};
    }

    std::vector<RGB> lookup(table_size);

    // Determine the center offset for rounding quantized values
    const int rounding = (q > 0) ? (1 << (q - 1)) : 0;

#pragma omp parallel for collapse(3) schedule(dynamic)
    for (int r_bin = 0; r_bin < bins; ++r_bin)
    {
        for (int g_bin = 0; g_bin < bins; ++g_bin)
        {
            for (int b_bin = 0; b_bin < bins; ++b_bin)
            {
                // Reconstruct the representative RGB color for this bin
                uint8_t r_val = static_cast<uint8_t>(
                    std::min(255, (r_bin << q) + rounding));
                uint8_t g_val = static_cast<uint8_t>(
                    std::min(255, (g_bin << q) + rounding));
                uint8_t b_val = static_cast<uint8_t>(
                    std::min(255, (b_bin << q) + rounding));

                RGBA target{r_val, g_val, b_val};
                RGBA result = computeMappedColor(target, config, labPalette);

                size_t index =
                    (static_cast<size_t>(r_bin) * bins + g_bin) * bins + b_bin;
                lookup[index] = RGB{result.r, result.g, result.b};
            }
        }
    }
    return lookup;
}

RGBA getMappedColorForPixel(const RGBA &pixel, const Config &config,
                            const std::vector<Lab> &labPalette,
                            ThreadLocalCache &cache,
                            const std::vector<RGB> *lookup)
{
    // Use lookup table if provided and applicable
    if (lookup && !lookup->empty())
    {
        const uint8_t q = config.quantLevel;
        const uint8_t binsPerChannel = 256 >> q;
        uint8_t r_q = pixel.r >> q;
        uint8_t g_q = pixel.g >> q;
        uint8_t b_q = pixel.b >> q;

        // Calculate the 1D index into the LUT
        size_t index =
            (static_cast<size_t>(r_q) * binsPerChannel + g_q) * binsPerChannel +
            b_q;

        if (index < lookup->size())
        {
            RGB rgb = (*lookup)[index];
            return RGBA{rgb.r, rgb.g, rgb.b};
        }
    }

    // Check the cache
    auto cachedColor = cache.get(pixel);
    if (cachedColor)
    {
        return *cachedColor;
    }

    // Compute the color and cache it
    RGBA result = computeMappedColor(pixel, config, labPalette);
    cache.set(pixel, result);
    return result;
}

void processPixels(Image &image, const Config &config,
                   const std::vector<Lab> &labPalette,
                   const std::vector<RGB> *lookup)
{
    const int width = image.width();
    const int height = image.height();

#pragma omp parallel
    {
        ThreadLocalCache thread_cache;
#pragma omp parallel for collapse(2) schedule(dynamic)
        for (int y = 0; y < height; ++y)
        {
            for (int x = 0; x < width; ++x)
            {
                RGBA currentPixel = image.get(x, y);

                if (image.hasAlpha() &&
                    currentPixel.a < config.transparencyThreshold)
                {
                    image.set(x, y, RGBA(0, 0, 0, 0));
                }
                else
                {
                    RGBA mappedColor = getMappedColorForPixel(
                        currentPixel, config, labPalette, thread_cache, lookup);

                    image.set(x, y, mappedColor);
                }
            }
        }
    }
}

void palettify(Image &image, const Config &config)
{
    bool outputIsPalettized = (config.mapping == Mapping::PALETTIZED ||
                               config.mapping == Mapping::SMOOTHED_PALETTIZED);

    image.setMapping(config.mapping);
    if (outputIsPalettized && !config.palette.empty())
        image.setPalette(config.palette);

    std::vector<Lab> labPalette;
    if (config.mapping != Mapping::UNTOUCHED)
    {
        if (config.palette.empty())
            throw std::runtime_error(
                "Cannot palettify image with an empty palette.");
        else
        {
            labPalette.resize(config.palette.size());
            for (size_t i = 0; i < config.palette.size(); ++i)
                labPalette[i] = config.palette[i].toLab();
        }
    }

    std::vector<RGB> lookup;
    if (config.quantLevel > 0)
    {
        int imageSize = image.width() * image.height();
        lookup = generateLookupTable(config, labPalette, imageSize);
    }

    processPixels(image, config, labPalette,
                  (!lookup.empty()) ? &lookup : nullptr);
}

void palettify(GIF &gif, const Config &config)
{
    bool outputIsPalettized = (config.mapping == Mapping::PALETTIZED ||
                               config.mapping == Mapping::SMOOTHED_PALETTIZED);

    if (!outputIsPalettized)
    {
        throw std::runtime_error(
            "Selected mapping does not produce palettized output, which is "
            "required for GIF format. Use PALETTIZED or "
            "SMOOTHED_PALETTIZED.");
    }
    if (config.palette.empty())
    {
        throw std::runtime_error("Cannot palettify GIF with an empty palette.");
    }
    if (config.palette.size() > 256)
    {
        throw std::runtime_error(
            "GIF palette size cannot exceed 256 colors. Provided palette has " +
            std::to_string(config.palette.size()) + " colors.");
    }

    // Set palettes for all frames
    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
        gif.setPalette(frameIndex, config.palette);

    const size_t palette_size = config.palette.size();
    std::vector<Lab> labPalette(palette_size);
    for (size_t i = 0; i < palette_size; ++i)
        labPalette[i] = config.palette[i].toLab();

    // Calculate average frame size to determine if lookup table is beneficial
    size_t totalPixels = 0;
    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
    {
        const auto &frame = gif.getFrame(frameIndex);
        totalPixels += frame.image.width() * frame.image.height();
    }
    int avgFrameSize = totalPixels / gif.frameCount();

    std::vector<RGB> lookup;
    if (config.quantLevel > 0)
        lookup = generateLookupTable(config, labPalette, avgFrameSize);

    std::unordered_map<RGB, GifByteType> colorToIndexMap;
    for (size_t i = 0; i < config.palette.size(); ++i)
        colorToIndexMap[config.palette[i]] = static_cast<GifByteType>(i);

    // Random constant to represent an invalid or unused transparent index
    constexpr GifByteType NO_TRANSPARENT_INDEX = 255;

    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
    {
        auto &frame = gif.getFrame(frameIndex);

        const size_t width = frame.image.width();
        const size_t height = frame.image.height();

        GifByteType currentFrameTransparentIndex = frame.transparent_index;
        bool currentFrameHasTransparency =
            (currentFrameTransparentIndex != NO_TRANSPARENT_INDEX);

#pragma omp parallel
        {
            ThreadLocalCache thread_cache;
#pragma omp parallel for collapse(2) schedule(dynamic)
            for (size_t y = 0; y < height; ++y)
            {
                for (size_t x = 0; x < width; ++x)
                {
                    RGBA currentPixel = frame.image.get(x, y);

                    if (currentFrameHasTransparency &&
                        currentPixel.a < config.transparencyThreshold)
                    {
                        frame.setPixel(x, y, RGBA(0, 0, 0, 0),
                                       currentFrameTransparentIndex);
                    }
                    else
                    {
                        RGBA mappedColor = getMappedColorForPixel(
                            currentPixel, config, labPalette, thread_cache,
                            (!lookup.empty()) ? &lookup : nullptr);

                        auto it = colorToIndexMap.find(
                            RGB{mappedColor.r, mappedColor.g, mappedColor.b});
                        GifByteType index = it->second;

                        frame.setPixel(x, y, mappedColor, index);
                    }
                }
            }
        }
    }
}

bool validate(const Image &image, const Config &config)
{
    bool shouldBePalettized = (config.mapping == Mapping::PALETTIZED ||
                               config.mapping == Mapping::SMOOTHED_PALETTIZED);

    if (!shouldBePalettized)
        throw std::runtime_error("Can't validate non-palettized images.");

    if (config.palette.empty())
        throw std::runtime_error(
            "Image should be palettized, but config palette is empty.");

    std::unordered_map<RGB, bool> paletteLookup;
    for (const auto &color : config.palette)
        paletteLookup[color] = true;

    const size_t height = image.height();
    const size_t width = image.width();

    for (size_t y = 0; y < height; ++y)
    {
        for (size_t x = 0; x < width; ++x)
        {
            const RGBA currentPixel = image.get(x, y);

            if (currentPixel.a < config.transparencyThreshold)
                continue;

            RGB pixelRgb{currentPixel.r, currentPixel.g, currentPixel.b};
            if (paletteLookup.find(pixelRgb) == paletteLookup.end())
            {
                std::cerr << "Pixel at (" << x << "," << y << ") has color RGB("
                          << static_cast<int>(pixelRgb.r) << ","
                          << static_cast<int>(pixelRgb.g) << ","
                          << static_cast<int>(pixelRgb.b)
                          << ") which is not in the configured palette."
                          << std::endl;
                return false;
            }
        }
    }

    return true;
}
}  // namespace palettum
