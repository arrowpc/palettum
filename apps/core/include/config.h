#pragma once

#include <vector>
#include "color_difference.h"

enum class Mapping {
    UNTOUCHED,
    CIEDE_PALETTIZED,
    RBF_PALETTIZED,
    RBF_INTERPOLATED
};

struct Config {
    std::vector<RGB> palette = {{255, 0, 0}, {0, 255, 0}, {0, 0, 255}};
    size_t transparencyThreshold = 0;
    Formula formula = DEFAULT_FORMULA;
    Architecture architecture = DEFAULT_ARCH;
    uint8_t quantLevel = 2;  // (0 to disable)
    Mapping mapping = Mapping::CIEDE_PALETTIZED;
    double sigma = 50.0;
};
