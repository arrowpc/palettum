#pragma once

#include <array>
#include <vector>
#include "color_difference.h"

enum class Mapping { UNTOUCHED, PALETTIZED, SMOOTHED, SMOOTHED_PALETTIZED };

enum class WeightingKernelType {
    GAUSSIAN,               // exp(-(shape * distance)^2)
    INVERSE_DISTANCE_POWER  // 1 / (distance^power + epsilon)
};

struct Config {
    std::vector<RGB> palette = {{255, 0, 0}, {0, 255, 0}, {0, 0, 255}};
    size_t transparencyThreshold = 128;
    uint8_t quantLevel = 2;
    Formula palettized_formula = DEFAULT_FORMULA;
    Architecture architecture = DEFAULT_ARCH;

    Mapping mapping = Mapping::PALETTIZED;
    WeightingKernelType anisotropic_kernel =
        WeightingKernelType::INVERSE_DISTANCE_POWER;
    // Scaling factors applied to distance components: [L*, a*, b*].
    std::array<double, 3> anisotropic_labScales = {1.0, 1.0, 1.0};
    double anisotropic_shapeParameter = 0.10;  // For Gaussian
    double anisotropic_powerParameter =
        4.0;  // For Inverse Distance Power kernel
};
