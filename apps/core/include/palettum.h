#pragma once

#include <omp.h>
#include <unordered_map>
#include <vector>
#include "color_difference.h"
#include "config.h"
#include "image/gif.h"
#include "image/image.h"

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
