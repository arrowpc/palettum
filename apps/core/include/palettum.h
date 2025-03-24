#pragma once

#include <omp.h>
#include <unordered_map>
#include <vector>
#include "color_difference.h"
#include "image/gif.h"
#include "image/image.h"

enum class MappingMethod { CLOSEST, RBF_PALETTIZED, RBF_INTERPOLATED };

struct Config {
    std::vector<RGB> palette = {{255, 0, 0}, {0, 255, 0}, {0, 0, 255}};
    size_t transparencyThreshold = 0;
    Formula formula = DEFAULT_FORMULA;
    Architecture architecture = DEFAULT_ARCH;
    uint8_t quantLevel = 2;  // (0 to disable)
    MappingMethod mappingMethod = MappingMethod::CLOSEST;
    double sigma = 50.0;
};

namespace palettum {
Image palettify(Image &image, Config &config);
GIF palettify(GIF &gif, Config &config);
bool validate(Image &image, Config &config);

RGB computeMappedColor(const RGB &target, const Config &config,
                       const std::vector<Lab> &labPalette);
RGB findClosestPaletteColor(const Lab &lab, const std::vector<Lab> &labPalette,
                            const Config &config);
void processPixels(const Image &source, Image &target, const Config &config,
                   const std::vector<Lab> &labPalette, RGBCache &cache,
                   const std::vector<RGB> *lookup);
std::vector<RGB> generateLookupTable(const Config &config,
                                     const std::vector<Lab> &labPalette);
RGB rbfInterpolation(const RGB &target, const std::vector<RGB> &palette,
                     double sigma);
};  // namespace palettum
