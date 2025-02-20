#include "color.h"
#include "simd_utils.h"

Lab::Lab(float L, float a, float b) noexcept
    : m_L(L)
    , m_a(a)
    , m_b(b)
{
}

RGB Lab::toRGB() const noexcept
{
    float y = (m_L + 16.0f) / 116.0f;
    float x = m_a / 500.0f + y;
    float z = y - m_b / 200.0f;

    XYZ xyz;
    float x3 = x * x * x;
    float z3 = z * z * z;

    xyz.X =
        XYZ::WHITE_X * (x3 > XYZ::EPSILON ? x3 : (x - 16.0f / 116.0f) / 7.787f);
    xyz.Y = XYZ::WHITE_Y * (m_L > (XYZ::KAPPA * XYZ::EPSILON)
                                ? std::pow((m_L + 16.0f) / 116.0f, 3.0f)
                                : m_L / XYZ::KAPPA);
    xyz.Z =
        XYZ::WHITE_Z * (z3 > XYZ::EPSILON ? z3 : (z - 16.0f / 116.0f) / 7.787f);

    xyz.X /= 100.0f;
    xyz.Y /= 100.0f;
    xyz.Z /= 100.0f;

    float r = xyz.X * 3.2404542f - xyz.Y * 1.5371385f - xyz.Z * 0.4985314f;
    float g = xyz.X * -0.9692660f + xyz.Y * 1.8760108f + xyz.Z * 0.0415560f;
    float b = xyz.X * 0.0556434f - xyz.Y * 0.2040259f + xyz.Z * 1.0572252f;

    r = (r > 0.0031308f) ? 1.055f * std::pow(r, 1 / 2.4f) - 0.055f : 12.92f * r;
    g = (g > 0.0031308f) ? 1.055f * std::pow(g, 1 / 2.4f) - 0.055f : 12.92f * g;
    b = (b > 0.0031308f) ? 1.055f * std::pow(b, 1 / 2.4f) - 0.055f : 12.92f * b;

    r = std::clamp(r, 0.0f, 1.0f) * 255.0f;
    g = std::clamp(g, 0.0f, 1.0f) * 255.0f;
    b = std::clamp(b, 0.0f, 1.0f) * 255.0f;

    return RGB(static_cast<unsigned char>(std::round(r)),
               static_cast<unsigned char>(std::round(g)),
               static_cast<unsigned char>(std::round(b)));
}

float Lab::L() const noexcept
{
    return m_L;
}
float Lab::a() const noexcept
{
    return m_a;
}
float Lab::b() const noexcept
{
    return m_b;
}

static inline void atan2cf_C(float value, float *src, float *dst, int len)
{
#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        dst[i] = atan2f(value, src[i]);
    }
}

static inline void muladdccf_C(float *_a, float _b, float _c, float *dst,
                               int len)
{
#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        dst[i] = _a[i] * _b + _c;
    }
}

static inline void addmulcf_C(const float *src, const float value1,
                              float value2, float *dst, int len)
{
#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        dst[i] = (src[i] + value1) * value2;
    }
}

static inline void hypotf_C(float *a, float *b, float *dst, int len)
{
#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        dst[i] = sqrtf(a[i] * a[i] + b[i] * b[i]);
    }
};

void Lab::deltaE(const Lab &ref, const Lab *comp, float *results, int len)
{
    const size_t totalFloats = len * 19;

    thread_local std::vector<float> workspace;
    if (workspace.size() < totalFloats)
    {
        workspace.resize(totalFloats);
    }

    float *comp_L = workspace.data();
    float *comp_a = comp_L + len;
    float *comp_b = comp_a + len;
    float *lBarPrime = comp_b + len;
    float *c2 = lBarPrime + len;
    float *cBar = c2 + len;
    float *a1Prime = cBar + len;
    float *a2Prime = a1Prime + len;
    float *c1Prime = a2Prime + len;
    float *c2Prime = c1Prime + len;
    float *cBarPrime = c2Prime + len;
    float *h1Prime = cBarPrime + len;
    float *h2Prime = h1Prime + len;
    float *deltaLPrime = h2Prime + len;
    float *deltaCPrime = deltaLPrime + len;
    float *deltahPrime = deltaCPrime + len;
    float *deltaHPrime = deltahPrime + len;
    float *hBarPrime = deltaHPrime + len;
    float *T = hBarPrime + len;

    const float ref_L = ref.L();
    const float ref_a = ref.a();
    const float ref_b = ref.b();

#pragma omp simd
    for (size_t i = 0; i < len; ++i)
    {
        comp_L[i] = comp[i].L();
        comp_a[i] = comp[i].a();
        comp_b[i] = comp[i].b();
        lBarPrime[i] = (comp_L[i] + ref_L) * 0.5f;
    }

    const float c1 = sqrtf(ref_a * ref_a + ref_b * ref_b);

    hypotf_C(comp_a, comp_b, c2, len);

    addmulcf_C(c2, c1, 0.5f, cBar, len);

#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        float cBar7 =
            cBar[i] * cBar[i] * cBar[i] * cBar[i] * cBar[i] * cBar[i] * cBar[i];
        float g = 1.0f + 0.5f * (1.0f - sqrtf(cBar7 / (cBar7 + pow25_7)));
        a1Prime[i] = ref_a * g;
        a2Prime[i] = comp_a[i] * g;
    }

#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        c1Prime[i] = sqrtf(a1Prime[i] * a1Prime[i] + ref_b * ref_b);
        c2Prime[i] = sqrtf(a2Prime[i] * a2Prime[i] + comp_b[i] * comp_b[i]);
    }

    addf_c(c1Prime, c2Prime, cBarPrime, len);
    mulcf_C(cBarPrime, 0.5f, cBarPrime, len);

    atan2cf_C(ref_b, a1Prime, h1Prime, len);
    muladdccf_C(h1Prime, RAD_TO_DEG, 360, h1Prime, len);

    atan2f_C(comp_b, a2Prime, h2Prime, len);
    muladdccf_C(h2Prime, RAD_TO_DEG, 360, h2Prime, len);

    addcf_C(comp_L, -ref_L, deltaLPrime, len);
    subf_c(c2Prime, c1Prime, deltaCPrime, len);
    subf_c(h2Prime, h1Prime, deltahPrime, len);

#pragma omp simd
    for (size_t i = 0; i < len; ++i)
    {
        if (std::abs(h1Prime[i] - h2Prime[i]) <= 180)
        {
            continue;
        }
        else if (h2Prime[i] <= h1Prime[i])
        {
            deltahPrime[i] += 360;
        }
        else
        {
            deltahPrime[i] -= 360;
        }
    }

#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        deltaHPrime[i] = 2.0f * sqrtf(c1Prime[i] * c2Prime[i]) *
                         sinf(deltahPrime[i] * HALF_DEG_TO_RAD);
    }

#pragma omp simd
    for (int i = 0; i < len; ++i)
    {
        if (std::abs(h1Prime[i] - h2Prime[i]) <= 180)
        {
            hBarPrime[i] = (h1Prime[i] + h2Prime[i]) / 2;
        }
        else if (h1Prime[i] + h2Prime[i] < 360)
        {
            hBarPrime[i] = (h1Prime[i] + h2Prime[i] + 360) / 2;
        }
        else
        {
            hBarPrime[i] = (h1Prime[i] + h2Prime[i] - 360) / 2;
        }
    }

#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        T[i] = 1.0f - (0.17f * cosf((hBarPrime[i] - 30.0f) * DEG_TO_RAD)) +
               (0.24f * cosf((2.0f * hBarPrime[i]) * DEG_TO_RAD)) +
               (0.32f * cosf((3.0f * hBarPrime[i] + 6.0f) * DEG_TO_RAD)) -
               (0.20f * cosf((4.0f * hBarPrime[i] - 63.0f) * DEG_TO_RAD));
    }

#pragma omp simd
    for (int i = 0; i < len; ++i)
    {
        results[i] = sqrtf(
            (deltaLPrime[i] /
             (1.0f +
              (0.015f * ((lBarPrime[i] - 50.0f) * (lBarPrime[i] - 50.0f)) /
               sqrtf((lBarPrime[i] - 50.0f) * (lBarPrime[i] - 50.0f) +
                     20.0f)))) *
                (deltaLPrime[i] /
                 (1.0f +
                  (0.015f * ((lBarPrime[i] - 50.0f) * (lBarPrime[i] - 50.0f)) /
                   sqrtf((lBarPrime[i] - 50.0f) * (lBarPrime[i] - 50.0f) +
                         20.0f)))) +
            (deltaCPrime[i] / (1.0f + 0.045f * cBarPrime[i])) *
                (deltaCPrime[i] / (1.0f + 0.045f * cBarPrime[i])) +
            (deltaHPrime[i] / (1.0f + 0.015f * cBarPrime[i] * T[i])) *
                (deltaHPrime[i] / (1.0f + 0.015f * cBarPrime[i] * T[i])) +
            (-2.0f *
             sqrtf((cBarPrime[i] * cBarPrime[i] * cBarPrime[i] * cBarPrime[i] *
                    cBarPrime[i] * cBarPrime[i] * cBarPrime[i]) /
                   (cBarPrime[i] * cBarPrime[i] * cBarPrime[i] * cBarPrime[i] *
                        cBarPrime[i] * cBarPrime[i] * cBarPrime[i] +
                    pow25_7)) *
             sinf(60.0f *
                  expf(-((hBarPrime[i] - 275.0f) / 25.0f) *
                       ((hBarPrime[i] - 275.0f) / 25.0f)) *
                  DEG_TO_RAD)) *
                (deltaCPrime[i] / (1.0f + 0.045f * cBarPrime[i])) *
                (deltaHPrime[i] / (1.0f + 0.015f * cBarPrime[i] * T[i])));
    }
}

float Lab::deltaE(const Lab &other) const noexcept
{
    const float lBarPrime = (this->L() + other.L()) * 0.5f;
    const float c1 = std::sqrt(this->a() * this->a() + this->b() * this->b());
    const float c2 = std::sqrt(other.a() * other.a() + other.b() * other.b());
    const float cBar = (c1 + c2) * 0.5f;
    const float cBar7 = std::pow(cBar, 7.0f);
    const float pow25_7 = 6103515625.0f;  // std::pow(25.0f, 7.0f) precomputed
    const float g = 0.5f * (1.0f - std::sqrt(cBar7 / (cBar7 + pow25_7)));
    const float a1Prime = this->a() * (1 + g);
    const float a2Prime = other.a() * (1 + g);
    const float c1Prime = std::sqrt(a1Prime * a1Prime + this->b() * this->b());
    const float c2Prime = std::sqrt(a2Prime * a2Prime + other.b() * other.b());
    const float cBarPrime = (c1Prime + c2Prime) * 0.5f;
    const float h1Prime =
        (std::atan2(this->b(), a1Prime) + 2.0f * M_PI) * 180.0f / M_PI;
    const float h2Prime =
        (std::atan2(other.b(), a2Prime) + 2.0f * M_PI) * 180.0f / M_PI;
    float deltaLPrime = other.L() - this->L();
    float deltaCPrime = c2Prime - c1Prime;
    float deltahPrime;
    if (std::abs(h1Prime - h2Prime) <= 180)
    {
        deltahPrime = h2Prime - h1Prime;
    }
    else if (h2Prime <= h1Prime)
    {
        deltahPrime = h2Prime - h1Prime + 360;
    }
    else
    {
        deltahPrime = h2Prime - h1Prime - 360;
    }

    const float deltaHPrime = 2 * std::sqrt(c1Prime * c2Prime) *
                              std::sin(deltahPrime * M_PI / 360.0f);
    const float sL = 1 + (0.015f * std::pow(lBarPrime - 50, 2)) /
                             std::sqrt(20 + std::pow(lBarPrime - 50, 2));
    const float sC = 1 + 0.045f * cBarPrime;
    const float hBarPrime =
        (std::abs(h1Prime - h2Prime) <= 180) ? (h1Prime + h2Prime) / 2
        : (h1Prime + h2Prime < 360)          ? (h1Prime + h2Prime + 360) / 2
                                             : (h1Prime + h2Prime - 360) / 2;
    const float t = 1 - 0.17f * std::cos((hBarPrime - 30) * M_PI / 180.0f) +
                    0.24f * std::cos(2 * hBarPrime * M_PI / 180.0f) +
                    0.32f * std::cos((3 * hBarPrime + 6) * M_PI / 180.0f) -
                    0.20f * std::cos((4 * hBarPrime - 63) * M_PI / 180.0f);
    const float sH = 1 + 0.015f * cBarPrime * t;
    const float rT =
        -2 *
        std::sqrt(std::pow(cBarPrime, 7) /
                  (std::pow(cBarPrime, 7) + std::pow(25.0f, 7))) *
        std::sin(60 * std::exp(-std::pow((hBarPrime - 275) / 25, 2)) * M_PI /
                 180.0f);

    const float lightness = deltaLPrime / sL;
    const float chroma = deltaCPrime / sC;
    const float hue = deltaHPrime / sH;

    return std::sqrt(lightness * lightness + chroma * chroma + hue * hue +
                     rT * chroma * hue);
}

std::ostream &operator<<(std::ostream &os, const Lab &lab)
{
    return os << "Lab(" << lab.m_L << ", " << lab.m_a << ", " << lab.m_b << ")";
}

RGB::RGB(unsigned char r, unsigned char g, unsigned char b) noexcept
    : m_r(r)
    , m_g(g)
    , m_b(b)
{
}

Lab RGB::toLab() const noexcept
{
    float r = m_r / 255.0f;
    float g = m_g / 255.0f;
    float b = m_b / 255.0f;

    r = (r > 0.04045f) ? std::pow((r + 0.055f) / 1.055f, 2.4f) : r / 12.92f;
    g = (g > 0.04045f) ? std::pow((g + 0.055f) / 1.055f, 2.4f) : g / 12.92f;
    b = (b > 0.04045f) ? std::pow((b + 0.055f) / 1.055f, 2.4f) : b / 12.92f;
    XYZ xyz;
    xyz.X = r * 0.4124564f + g * 0.3575761f + b * 0.1804375f;
    xyz.Y = r * 0.2126729f + g * 0.7151522f + b * 0.0721750f;
    xyz.Z = r * 0.0193339f + g * 0.1191920f + b * 0.9503041f;

    xyz.X = xyz.X * 100.0f;
    xyz.Y = xyz.Y * 100.0f;
    xyz.Z = xyz.Z * 100.0f;

    float xr = xyz.X / XYZ::WHITE_X;
    float yr = xyz.Y / XYZ::WHITE_Y;
    float zr = xyz.Z / XYZ::WHITE_Z;

    xr = pivotXYZ(xr);
    yr = pivotXYZ(yr);
    zr = pivotXYZ(zr);

    float L = std::max<float>(0.0f, 116.0f * yr - 16.0f);
    float a = 500.0f * (xr - yr);
    b = 200.0f * (yr - zr);

    return Lab(L, a, b);
}

float RGB::pivotXYZ(float n) noexcept
{
    return n > XYZ::EPSILON ? std::cbrt(n) : (XYZ::KAPPA * n + 16.0f) / 116.0f;
}

bool RGB::operator==(const RGB &rhs) const noexcept
{
    return m_r == rhs.m_r && m_g == rhs.m_g && m_b == rhs.m_b;
}

bool RGB::operator!=(const RGB &rhs) const noexcept
{
    return !(*this == rhs);
}

std::ostream &operator<<(std::ostream &os, const RGB &RGB)
{
    return os << "RGB(" << static_cast<int>(RGB.m_r) << ", "
              << static_cast<int>(RGB.m_g) << ", " << static_cast<int>(RGB.m_b)
              << ")";
}

RGBA::RGBA(unsigned char r, unsigned char g, unsigned char b,
           unsigned char a) noexcept
    : RGB(r, g, b)
    , m_a(a)
{
}
