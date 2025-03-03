#pragma once

#include <omp.h>
#include <unordered_map>
#include <vector>
#include "color_difference.h"
#include "image/gif.h"
#include "image/image.h"

struct Config {
    std::vector<RGB> palette = {{255, 0, 0}, {0, 255, 0}, {0, 0, 255}};
    size_t transparencyThreshold = 0;
    Formula formula = DEFAULT_FORMULA;
    Architecture architecture = DEFAULT_ARCH;
};

namespace palettum {
Image palettify(Image &image, Config &config);
GIF palettify(GIF &gif, Config &config);
bool validate(Image &image, Config &config);
};  // namespace palettum
