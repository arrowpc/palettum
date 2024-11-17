#ifndef PALETTUM_CORE_PALETTUM_H
#define PALETTUM_CORE_PALETTUM_H

#include <omp.h>
#include <cmath>
#include <vector>
#include "processor.h"

using namespace std;

class Palettum
{
private:
    Image m_image;
    vector<RGB> m_palette;

public:
    Palettum() = default;
    static Image convertToPalette(Image &image, vector<RGB> &palette);
    static bool validateImageColors(Image &image, vector<RGB> &palette);
};

#endif  //PALETTUM_CORE_PALETTUM_H
