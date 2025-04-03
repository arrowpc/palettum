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
            sumR += weight * static_cast<double>(config.palette[i].red());
            sumG += weight * static_cast<double>(config.palette[i].green());
            sumB += weight * static_cast<double>(config.palette[i].blue());
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

RGB computeMappedColor(const RGB &target, const Config &config,
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

    Lab targetLab = target.toLab();

    switch (config.mapping)
    {
        case Mapping::PALETTIZED:
            return findClosestPaletteColor(targetLab, labPalette, config);
        case Mapping::SMOOTHED:
            return computeAnisotropicWeightedAverage(targetLab, config,
                                                     labPalette);
        case Mapping::SMOOTHED_PALETTIZED: {
            RGB smoothedColor = computeAnisotropicWeightedAverage(
                targetLab, config, labPalette);
            Lab smoothedLab = smoothedColor.toLab();
            return findClosestPaletteColor(smoothedLab, labPalette, config);
        }
        default:
            // Juuust in case
            std::cerr << "Warning: Unsupported mapping type encountered ("
                      << static_cast<int>(config.mapping)
                      << "). Falling back to PALETTIZED." << std::endl;
            return findClosestPaletteColor(targetLab, labPalette, config);
    }
}

std::vector<RGB> generateLookupTable(const Config &config,
                                     const std::vector<Lab> &labPalette)
{
    const uint8_t q = config.quantLevel;
    const uint8_t max_q = 5;
    if (q == 0)
    {
        return {};  // No LUT needed if no quantization
    }
    if (q >= max_q)
    {
        std::cerr << "Warning: Quantization level " << static_cast<int>(q)
                  << " is too high (>=" << static_cast<int>(max_q)
                  << "). LUT generation skipped." << std::endl;
        return {};
    }

    // Calculate the number of bins per channel after quantization
    const uint8_t bins = 256 >> q;
    const size_t table_size = static_cast<size_t>(bins) * bins * bins;
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
                // Left-shift approximates multiplication by 2^q
                // Add rounding offset to get the center of the quantization bin
                uint8_t r_val = static_cast<uint8_t>(
                    std::min(255, (r_bin << q) + rounding));
                uint8_t g_val = static_cast<uint8_t>(
                    std::min(255, (g_bin << q) + rounding));
                uint8_t b_val = static_cast<uint8_t>(
                    std::min(255, (b_bin << q) + rounding));

                RGB target{r_val, g_val, b_val};

                RGB result = computeMappedColor(target, config, labPalette);

                size_t index =
                    (static_cast<size_t>(r_bin) * bins + g_bin) * bins + b_bin;
                lookup[index] = result;
            }
        }
    }
    return lookup;
}

RGB getMappedColorForPixel(const RGBA &pixel, const Config &config,
                           const std::vector<Lab> &labPalette, RGBCache &cache,
                           const std::vector<RGB> *lookup)
{
    if (lookup && !lookup->empty() && config.quantLevel > 0 &&
        config.quantLevel < 8)
    {
        const uint8_t q = config.quantLevel;
        const uint8_t binsPerChannel = 256 >> q;
        uint8_t r_q = pixel.red() >> q;
        uint8_t g_q = pixel.green() >> q;
        uint8_t b_q = pixel.blue() >> q;

        // Calculate the 1D index into the LUT
        size_t index =
            (static_cast<size_t>(r_q) * binsPerChannel + g_q) * binsPerChannel +
            b_q;

        if (index < lookup->size())
            return (*lookup)[index];
        else
            std::cerr << "Warning: LUT index out of bounds (" << index
                      << " vs size " << lookup->size() << ")!" << std::endl;
    }

    RGB target{pixel.red(), pixel.green(), pixel.blue()};
    auto cachedColor = cache.get(target);
    if (cachedColor)
        return *cachedColor;

    RGB result = computeMappedColor(target, config, labPalette);
    cache.set(target, result);
    return result;
}

void processPixels(const Image &source, Image &target, const Config &config,
                   const std::vector<Lab> &labPalette, RGBCache &cache,
                   const std::vector<RGB> *lookup)
{
    const int width = source.width();
    const int height = source.height();

    if (width != target.width() || height != target.height())
        throw std::runtime_error(
            "Source and target image dimensions must match in processPixels.");

#pragma omp parallel for collapse(2) schedule(dynamic)
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            RGBA currentPixel = source.get(x, y);

            if (source.hasAlpha() &&
                currentPixel.alpha() < config.transparencyThreshold)
                target.set(x, y, RGBA(0, 0, 0, 0));
            else
            {
                RGB mappedColor = getMappedColorForPixel(
                    currentPixel, config, labPalette, cache, lookup);
                target.set(x, y, mappedColor);
            }
        }
    }
}

Image palettify(const Image &image, const Config &config)
{
    const size_t width = image.width();
    const size_t height = image.height();
    Image result(width, height, image.hasAlpha());

    bool outputIsPalettized = (config.mapping == Mapping::PALETTIZED ||
                               config.mapping == Mapping::SMOOTHED_PALETTIZED);

    result.setMapping(config.mapping);
    if (outputIsPalettized && !config.palette.empty())
        result.setPalette(config.palette);

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

    RGBCache cache;
    std::vector<RGB> lookup;
    if (config.quantLevel > 0)
        lookup = generateLookupTable(config, labPalette);

    processPixels(image, result, config, labPalette, cache,
                  (!lookup.empty()) ? &lookup : nullptr);

    return result;
}

GIF palettify(const GIF &gif, const Config &config)
{
    bool outputIsPalettized = (config.mapping == Mapping::PALETTIZED ||
                               config.mapping == Mapping::SMOOTHED_PALETTIZED);

    //TODO: Create a config validation function instead of rewriting this for Image
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
        // GIF standard allows max 256 colors per frame palette
        throw std::runtime_error(
            "GIF palette size cannot exceed 256 colors. Provided palette has " +
            std::to_string(config.palette.size()) + " colors.");
    }

    GIF result = gif;

    for (size_t frameIndex = 0; frameIndex < result.frameCount(); ++frameIndex)
        result.setPalette(frameIndex, config.palette);

    const size_t palette_size = config.palette.size();
    std::vector<Lab> labPalette(palette_size);
    for (size_t i = 0; i < palette_size; ++i)
        labPalette[i] = config.palette[i].toLab();

    RGBCache cache;
    std::vector<RGB> lookup;
    if (config.quantLevel > 0)
        lookup = generateLookupTable(config, labPalette);

    std::unordered_map<RGB, GifByteType> colorToIndexMap;
    for (size_t i = 0; i < config.palette.size(); ++i)
        colorToIndexMap[config.palette[i]] = static_cast<GifByteType>(i);

    // Random constant to represent an invalid or unused transparent index
    constexpr GifByteType NO_TRANSPARENT_INDEX = 255;

    for (size_t frameIndex = 0; frameIndex < gif.frameCount(); ++frameIndex)
    {
        const auto &sourceFrame = gif.getFrame(frameIndex);
        auto &targetFrame = result.getFrame(frameIndex);

        const size_t width = sourceFrame.image.width();
        const size_t height = sourceFrame.image.height();

        GifByteType currentFrameTransparentIndex =
            targetFrame.transparent_index;
        bool currentFrameHasTransparency =
            (currentFrameTransparentIndex != NO_TRANSPARENT_INDEX);

#pragma omp parallel for collapse(2) schedule(dynamic)
        for (size_t y = 0; y < height; ++y)
        {
            for (size_t x = 0; x < width; ++x)
            {
                RGBA currentPixel = sourceFrame.image.get(x, y);

                if (currentFrameHasTransparency &&
                    currentPixel.alpha() < config.transparencyThreshold)
                {
                    targetFrame.setPixel(x, y, RGBA(0, 0, 0, 0),
                                         currentFrameTransparentIndex);
                }
                else
                {
                    RGB mappedColor = getMappedColorForPixel(
                        currentPixel, config, labPalette, cache,
                        (!lookup.empty()) ? &lookup : nullptr);

                    auto it = colorToIndexMap.find(mappedColor);
                    GifByteType index;
                    if (it != colorToIndexMap.end())
                        index = it->second;

                    targetFrame.setPixel(x, y, mappedColor, index);
                }
            }
        }
    }

    return result;
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

            if (currentPixel.alpha() < config.transparencyThreshold)
                continue;

            RGB pixelRgb{currentPixel.red(), currentPixel.green(),
                         currentPixel.blue()};
            if (paletteLookup.find(pixelRgb) == paletteLookup.end())
            {
                std::cerr << "Pixel at (" << x << "," << y << ") has color RGB("
                          << static_cast<int>(pixelRgb.red()) << ","
                          << static_cast<int>(pixelRgb.green()) << ","
                          << static_cast<int>(pixelRgb.blue())
                          << ") which is not in the configured palette."
                          << std::endl;
                return false;
            }
        }
    }

    return true;
}
}  // namespace palettum
