#pragma once

#include <omp.h>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>
#include "color_difference.h"
#include "config.h"
#include "image/gif.h"
#include "image/image.h"

namespace palettum {
Image palettify(const Image &image, const Config &config);
GIF palettify(const GIF &gif, const Config &config);
bool validate(const Image &image, const Config &config);
};  // namespace palettum
