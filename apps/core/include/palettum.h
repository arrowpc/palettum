#ifndef PALETTUM_CORE_PALETTUM_H
#define PALETTUM_CORE_PALETTUM_H

#include <omp.h>
#include <unordered_map>
#include <vector>
#include "color_difference.h"
#include "image/gif.h"
#include "image/image.h"

class Palettum
{
private:
    Image m_image;
    std::vector<RGB> m_palette;

public:
    Palettum() = default;
    static Image convertToPalette(Image &image, std::vector<RGB> &palette,
                                  int transparent_threshold = 0);
    static GIF convertToPalette(GIF &gif, std::vector<RGB> &palette,
                                int transparent_threshold = 0);
    static bool validateImageColors(Image &image, std::vector<RGB> &palette);
};

#endif  //PALETTUM_CORE_PALETTUM_H
