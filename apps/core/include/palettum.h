#ifndef PALETTUM_CORE_PALETTUM_H
#define PALETTUM_CORE_PALETTUM_H

#include <omp.h>
#include <unordered_map>
#include <vector>
#include "image.h"

class Palettum
{
private:
    Image m_image;
    std::vector<RGB> m_palette;

public:
    Palettum() = default;
    static Image convertToPalette(Image &image, std::vector<RGB> &palette);

    static GIF convertToPalette(GIF &gif, std::vector<RGB> &palette);
    static bool validateImageColors(Image &image, std::vector<RGB> &palette);
};

#endif  //PALETTUM_CORE_PALETTUM_H
