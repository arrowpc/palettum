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
    uint8_t quantLevel =
        2;  // Quantization level (q=1: 128 bins, q=2: 64 bins, q=3: 32 bins, etc.)
            // Smaller q = more bins = higher accuracy but larger memory usage
            // 0 to disable quantization
};

namespace palettum {
Image palettify(Image &image, Config &config);
GIF palettify(GIF &gif, Config &config);
bool validate(Image &image, Config &config);
};  // namespace palettum
