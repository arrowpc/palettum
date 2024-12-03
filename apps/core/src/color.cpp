#include "color.h"

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

static inline void compute_g_C(float *cBar, float *g, float *onePlusG, int len)
{
#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        // Compute cBar^7 using the efficient power method from before
        float result = cBar[i];
        float x2 = result * result;      // x²
        float x4 = x2 * x2;              // x⁴
        float cBar7 = x4 * x2 * result;  // x⁷

        // Compute g in one go
        float sqrt_val = std::sqrt(cBar7 / (cBar7 + pow25_7));
        g[i] = 0.5f * (1.0f - sqrt_val);
        onePlusG[i] = 1.0f + g[i];  // Compute onePlusG in the same loop
    }
}

static inline void compute_T_C(float *hBarPrime, float *T, int len)
{
#pragma omp simd
    for (int i = 0; i < len; i++)
    {
        const float h = hBarPrime[i];
        T[i] = 1.0f - (0.17f * cosf((h - 30.0f) * DEG_TO_RAD)) +
               (0.24f * cosf((2.0f * h) * DEG_TO_RAD)) +
               (0.32f * cosf((3.0f * h + 6.0f) * DEG_TO_RAD)) -
               (0.20f * cosf((4.0f * h - 63.0f) * DEG_TO_RAD));
    }
}

void Lab::deltaE(const Lab &ref, const Lab *comp, float *results, int len)
{
    const float ref_L = ref.L();
    const float ref_a = ref.a();
    const float ref_b = ref.b();

    float comp_L[len], comp_a[len], comp_b[len];
    for (size_t i{}; i < len; ++i)
    {
        comp_L[i] = comp[i].L();
        comp_a[i] = comp[i].a();
        comp_b[i] = comp[i].b();
    }

    float lBarPrime[len];
    addmulcf_C(comp_L, ref_L, 0.5f, lBarPrime, len);

    const float c1 = sqrtf(ref_a * ref_a + ref_b * ref_b);

    float c2[len];
    hypotf_C(comp_a, comp_b, c2, len);

    float cBar[len];
    addmulcf_C(c2, c1, 0.5f, cBar, len);

    float g[len], onePlusG[len];
    compute_g_C(cBar, g, onePlusG, len);

    float a1Prime[len];
    mulcf_C(onePlusG, ref_a, a1Prime, len);

    float a2Prime[len];
    mulf_C(comp_a, onePlusG, a2Prime, len);

    float c1Prime[len];
    float a1PrimeSq[len];
    mulf_C(a1Prime, a1Prime, a1PrimeSq, len);
    float bSq = ref_b * ref_b;
    addcf_C(a1PrimeSq, bSq, c1Prime, len);
    sqrtf_C(c1Prime, c1Prime, len);

    float c2Prime[len];
    float a2PrimeSq[len];
    mulf_C(a2Prime, a2Prime, a2PrimeSq, len);
    float b2Sq[len];
    mulf_C(comp_b, comp_b, b2Sq, len);
    addf_c(a2PrimeSq, b2Sq, c2Prime, len);
    sqrtf_C(c2Prime, c2Prime, len);

    float cBarPrime[len];
    addf_c(c1Prime, c2Prime, cBarPrime, len);
    mulcf_C(cBarPrime, 0.5f, cBarPrime, len);

    float h1Prime[len];
    atan2cf_C(ref_b, a1Prime, h1Prime, len);
    muladdccf_C(h1Prime, RAD_TO_DEG, 360, h1Prime, len);

    float h2Prime[len];
    atan2f_C(comp_b, a2Prime, h2Prime, len);
    muladdccf_C(h2Prime, RAD_TO_DEG, 360, h2Prime, len);

    float deltaLPrime[len];
    addcf_C(comp_L, -ref_L, deltaLPrime, len);

    float deltaCPrime[len];
    subf_c(c2Prime, c1Prime, deltaCPrime, len);

    float deltahPrime[len];
    subf_c(h2Prime, h1Prime, deltahPrime, len);

    for (size_t i = 0; i < len; ++i)
    {
        if (std::abs(h1Prime[i] - h2Prime[i]) <= 180)
        {
            continue;
        }
        else if (h2Prime[i] <= h1Prime[i])
        {
            deltahPrime[i] += 360;  // h2Prime - h1Prime + 360
        }
        else
        {
            deltahPrime[i] -= 360;  // h2Prime - h1Prime - 360
        }
    }

    float c1Primec2Prime[len];
    mulf_C(c1Prime, c2Prime, c1Primec2Prime, len);
    sqrtf_C(c1Primec2Prime, c1Primec2Prime, len);

    float sinDeltahPrime[len];
    mulcf_C(deltahPrime, HALF_DEG_TO_RAD, sinDeltahPrime, len);
    sinf_C(sinDeltahPrime, sinDeltahPrime, len);

    float deltaHPrime[len];
    mulf_C(c1Primec2Prime, sinDeltahPrime, deltaHPrime, len);
    mulcf_C(deltaHPrime, 2, deltaHPrime, len);

    float lBarMinus50[len];
    addcf_C(lBarPrime, -50.0f, lBarMinus50, len);

    float lBarMinus50Sq[len];
    mulf_C(lBarMinus50, lBarMinus50, lBarMinus50Sq, len);

    float denominator[len];
    addcf_C(lBarMinus50Sq, 20.0f, denominator, len);
    sqrtf_C(denominator, denominator, len);

    float numerator[len];
    mulcf_C(lBarMinus50Sq, 0.015f, numerator, len);

    float fraction[len];
    divf_C(numerator, denominator, fraction, len);

    float sL[len];
    addcf_C(fraction, 1.0f, sL, len);

    float sC[len];
    muladdccf_C(cBarPrime, 0.045f, 1, sC, len);

    // First calculate h1Prime + h2Prime
    float hSum[len];
    addf_c(h1Prime, h2Prime, hSum, len);

    // Calculate absolute difference |h1Prime - h2Prime|
    float hDiff[len];
    subf_c(h1Prime, h2Prime, hDiff, len);
    for (float &f : hDiff)
    {
        f = std::abs(f);
    }

    float hBarPrime[len];
    for (int i = 0; i < len; ++i)
    {
        if (hDiff[i] <= 180)
        {
            hBarPrime[i] = hSum[i] / 2;
        }
        else if (hSum[i] < 360)
        {
            hBarPrime[i] = (hSum[i] + 360) / 2;
        }
        else
        {
            hBarPrime[i] = (hSum[i] - 360) / 2;
        }
    }

    float t[len];
    compute_T_C(hBarPrime, t, len);

    float sH[len];
    mulcf_C(cBarPrime, 0.015f, sH, len);
    muladdcf_C(sH, t, 1, sH, len);

    // First calculate (cBarPrime^7)
    float cBar7[len];
    //    copyf_C(cBarPrime, cBar7, len);
    copyf_C(cBarPrime, cBar7, len);
    mulf_C(cBar7, cBar7, cBar7, len);      // cBar^2
    mulf_C(cBar7, cBar7, cBar7, len);      // cBar^4
    mulf_C(cBar7, cBarPrime, cBar7, len);  // cBar^5
    mulf_C(cBar7, cBarPrime, cBar7, len);  // cBar^6
    mulf_C(cBar7, cBarPrime, cBar7, len);  // cBar^7

    // Calculate sqrt(cBar^7 / (cBar^7 + 25^7))
    float division[len];
    addcf_C(cBar7, pow25_7, denominator, len);  // cBar^7 + 25^7
    divf_C(cBar7, denominator, division, len);  // cBar^7 / (cBar^7 + 25^7)
    sqrtf_C(division, division, len);           // sqrt(...)

    // Calculate (hBarPrime - 275) / 25
    float expTerm[len];
    addcf_C(hBarPrime, -275.0f, expTerm, len);
    mulcf_C(expTerm, 1 / 25.0f, expTerm, len);

    // Calculate -(expTerm^2)
    float negExpTerm[len];
    mulf_C(expTerm, expTerm, negExpTerm, len);
    mulcf_C(negExpTerm, -1.0f, negExpTerm, len);

    // Calculate exp(-(expTerm^2))
    expf_C(negExpTerm, negExpTerm, len);

    // Calculate 60 * exp(...) * PI/180
    mulcf_C(negExpTerm, 60.0f, negExpTerm, len);
    mulcf_C(negExpTerm, DEG_TO_RAD, negExpTerm,
            len);  // Convert to radians using your HALF_DEG_TO_RAD

    float sinTerm[len];
    sinf_C(negExpTerm, sinTerm, len);
    float rT[len];
    mulf_C(division, sinTerm, rT, len);
    mulcf_C(rT, -2.0f, rT, len);

    float lightness[len];
    divf_C(deltaLPrime, sL, lightness, len);

    float chroma[len];
    divf_C(deltaCPrime, sC, chroma, len);

    float hue[len];
    divf_C(deltaHPrime, sH, hue, len);

    // First square all the terms
    float lightnessSq[len], chromaSq[len], hueSq[len];
    mulf_C(lightness, lightness, lightnessSq, len);  // lightness^2
    mulf_C(chroma, chroma, chromaSq, len);           // chroma^2
    mulf_C(hue, hue, hueSq, len);                    // hue^2

    // Calculate rT * chroma * hue
    float rTChroma[len];
    mulf_C(rT, chroma, rTChroma, len);
    mulf_C(rTChroma, hue, rTChroma, len);

    // Sum all terms
    float sum[len];
    copyf_C(lightnessSq, sum, len);
    addf_c(sum, chromaSq, sum, len);  // Add chroma^2
    addf_c(sum, hueSq, sum, len);     // Add hue^2
    addf_c(sum, rTChroma, sum, len);  // Add rT*chroma*hue

    // Take square root and store in results
    sqrtf_C(sum, results, len);  // Final deltaE result
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

unsigned char RGB::red() const noexcept
{
    return m_r;
}
unsigned char RGB::green() const noexcept
{
    return m_g;
}
unsigned char RGB::blue() const noexcept
{
    return m_b;
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