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

inline simde_float32x4_t atan_approx(simde_float32x4_t x)
{
    const simde_float32x4_t a1 = simde_vdupq_n_f32(0.99997726f);
    const simde_float32x4_t a3 = simde_vdupq_n_f32(-0.33262347f);
    const simde_float32x4_t a5 = simde_vdupq_n_f32(0.19354346f);
    const simde_float32x4_t a7 = simde_vdupq_n_f32(-0.11643287f);
    const simde_float32x4_t a9 = simde_vdupq_n_f32(0.05265332f);
    const simde_float32x4_t a11 = simde_vdupq_n_f32(-0.01172120f);

    const simde_float32x4_t xSq = simde_vmulq_f32(x, x);

    simde_float32x4_t res = a11;
    res = simde_vmlsq_f32(a9, xSq, res);
    res = simde_vmlsq_f32(a7, xSq, res);
    res = simde_vmlsq_f32(a5, xSq, res);
    res = simde_vmlsq_f32(a3, xSq, res);
    res = simde_vmlsq_f32(a1, xSq, res);
    res = simde_vmulq_f32(x, res);

    return res;
}

// Heavily inspired from {https://mazzo.li/posts/vectorized-atan2.html,
// https://gist.github.com/bitonic/d0f5a0a44e37d4f0be03d34d47acb6cf}
// Great read !
inline simde_float32x4_t atan2_approx(simde_float32x4_t y, simde_float32x4_t x)
{
    const simde_float32x4_t pi = simde_vdupq_n_f32(M_PI);
    const simde_float32x4_t pi_2 = simde_vdupq_n_f32(M_PI_2);
    const simde_float32x4_t epsilon = simde_vdupq_n_f32(1e-6f);
    const simde_float32x4_t zero = simde_vdupq_n_f32(0.0f);

    // Create masks for absolute value and sign bit
    const simde_uint32x4_t abs_mask = simde_vdupq_n_u32(0x7FFFFFFF);
    const simde_uint32x4_t sign_mask = simde_vdupq_n_u32(0x80000000);

    // Get absolute values
    simde_uint32x4_t y_bits = simde_vreinterpretq_u32_f32(y);
    simde_uint32x4_t x_bits = simde_vreinterpretq_u32_f32(x);
    simde_uint32x4_t abs_y_bits = simde_vandq_u32(y_bits, abs_mask);
    simde_uint32x4_t abs_x_bits = simde_vandq_u32(x_bits, abs_mask);
    simde_float32x4_t abs_y = simde_vreinterpretq_f32_u32(abs_y_bits);
    simde_float32x4_t abs_x = simde_vreinterpretq_f32_u32(abs_x_bits);

    // Check for zero or near-zero cases
    simde_uint32x4_t x_near_zero = simde_vcltq_f32(abs_x, epsilon);
    simde_uint32x4_t y_near_zero = simde_vcltq_f32(abs_y, epsilon);

    // Handle special cases
    simde_uint32x4_t both_near_zero = simde_vandq_u32(x_near_zero, y_near_zero);
    simde_uint32x4_t x_zero_mask =
        simde_vandq_u32(x_near_zero, simde_vmvnq_u32(y_near_zero));

    // Compute regular atan2 for non-special cases
    simde_uint32x4_t swap_mask = simde_vcgtq_f32(abs_y, abs_x);
    simde_float32x4_t num = simde_vbslq_f32(swap_mask, x, y);
    simde_float32x4_t den = simde_vbslq_f32(swap_mask, y, x);

    // Add epsilon to denominator to avoid division by zero
    den = simde_vaddq_f32(
        den, simde_vreinterpretq_f32_u32(simde_vandq_u32(
                 simde_vreinterpretq_u32_f32(epsilon), x_near_zero)));

    simde_float32x4_t atan_input = simde_vdivq_f32(num, den);
    simde_float32x4_t result = atan_approx(atan_input);

    // Adjust result if we swapped inputs
    simde_uint32x4_t atan_input_bits = simde_vreinterpretq_u32_f32(atan_input);
    simde_uint32x4_t pi_2_sign_bits =
        simde_vandq_u32(atan_input_bits, sign_mask);
    simde_float32x4_t pi_2_adj = simde_vreinterpretq_f32_u32(
        simde_vorrq_u32(simde_vreinterpretq_u32_f32(pi_2), pi_2_sign_bits));

    simde_float32x4_t swap_result = simde_vsubq_f32(pi_2_adj, result);
    result = simde_vbslq_f32(swap_mask, swap_result, result);

    // Handle x = 0 cases
    simde_float32x4_t y_sign =
        simde_vreinterpretq_f32_u32(simde_vandq_u32(y_bits, sign_mask));
    simde_float32x4_t x_zero_result = simde_vbslq_f32(
        simde_vreinterpretq_u32_f32(y_sign), simde_vnegq_f32(pi_2), pi_2);

    // Adjust for quadrant based on signs of x and y
    simde_uint32x4_t x_sign_mask = simde_vcltq_f32(x, zero);
    simde_uint32x4_t y_sign_bits =
        simde_vandq_u32(simde_vreinterpretq_u32_f32(y), sign_mask);
    simde_float32x4_t pi_adj = simde_vreinterpretq_f32_u32(
        simde_veorq_u32(simde_vreinterpretq_u32_f32(pi), y_sign_bits));
    simde_float32x4_t quad_adj = simde_vreinterpretq_f32_u32(
        simde_vandq_u32(simde_vreinterpretq_u32_f32(pi_adj), x_sign_mask));

    result = simde_vaddq_f32(quad_adj, result);

    // Select between special cases and regular result
    result = simde_vbslq_f32(x_zero_mask, x_zero_result, result);
    result = simde_vbslq_f32(both_near_zero, zero, result);

    return result;
}

inline simde_float32x4_t cos_approx(simde_float32x4_t x)
{
    const simde_float32x4_t tp = simde_vdupq_n_f32(1.0f / (2.0f * M_PI));
    const simde_float32x4_t quarter = simde_vdupq_n_f32(0.25f);
    const simde_float32x4_t sixteen = simde_vdupq_n_f32(16.0f);
    const simde_float32x4_t half = simde_vdupq_n_f32(0.5f);

    x = simde_vmulq_f32(x, tp);
    simde_float32x4_t x_plus_quarter = simde_vaddq_f32(x, quarter);
    simde_float32x4_t floor_val = vrndmq_f32(x_plus_quarter);
    x = simde_vsubq_f32(x, simde_vaddq_f32(quarter, floor_val));
    simde_float32x4_t abs_x = simde_vabsq_f32(x);
    simde_float32x4_t abs_x_minus_half = simde_vsubq_f32(abs_x, half);
    simde_float32x4_t factor = simde_vmulq_f32(sixteen, abs_x_minus_half);

    return simde_vmulq_f32(x, factor);
}

inline simde_float32x4_t sin_approx(simde_float32x4_t x)
{
    const simde_float32x4_t B = simde_vdupq_n_f32(4.0f / M_PI);
    const simde_float32x4_t C = simde_vdupq_n_f32(-4.0f / (M_PI * M_PI));

    simde_float32x4_t y = simde_vmulq_f32(B, x);
    simde_float32x4_t ax = simde_vabsq_f32(x);
    simde_float32x4_t term = simde_vmulq_f32(C, simde_vmulq_f32(x, ax));
    y = simde_vaddq_f32(y, term);

    return y;
}

inline simde_float32x4_t exp_approx(simde_float32x4_t x)
{
    simde_float32x4_t a = simde_vdupq_n_f32(12102203.0f);  // (1 << 23) / log(2)
    simde_int32x4_t b = simde_vdupq_n_s32(127 * (1 << 23) - 298765);

    simde_int32x4_t t =
        simde_vaddq_s32(simde_vcvtq_s32_f32(simde_vmulq_f32(a, x)), b);

    return simde_vreinterpretq_f32_s32(t);
}

void Lab::deltaE_NEON(const Lab &ref, const Lab *comp, float32_t *results)
{
    simde_float32x4_t ref_L = simde_vdupq_n_f32(ref.L());
    simde_float32x4_t ref_a = simde_vdupq_n_f32(ref.a());
    simde_float32x4_t ref_b = simde_vdupq_n_f32(ref.b());

    simde_float32x4x3_t comp_lab = simde_vld3q_f32((const float32_t *)comp);
    simde_float32x4_t comp_L = comp_lab.val[0];
    simde_float32x4_t comp_a = comp_lab.val[1];
    simde_float32x4_t comp_b = comp_lab.val[2];

    simde_float32x4_t lBarPrime =
        simde_vmulq_n_f32(simde_vaddq_f32(ref_L, comp_L), 0.5f);

    simde_float32x4_t c1 = simde_vsqrtq_f32(simde_vaddq_f32(
        simde_vmulq_f32(ref_a, ref_a), simde_vmulq_f32(ref_b, ref_b)));

    simde_float32x4_t c2 = simde_vsqrtq_f32(simde_vaddq_f32(
        simde_vmulq_f32(comp_a, comp_a), simde_vmulq_f32(comp_b, comp_b)));

    simde_float32x4_t cBar = simde_vmulq_n_f32(simde_vaddq_f32(c1, c2), 0.5f);

    // Calculating cBar^7 with 4 multiplication operations
    // instead of 7 by taking advantage of the fact that
    // 7 = 1 + 2 + 4
    // See for more info: https://en.wikipedia.org/wiki/Exponentiation_by_squaring
    simde_float32x4_t cBar2 = simde_vmulq_f32(cBar, cBar);
    simde_float32x4_t cBar4 = simde_vmulq_f32(cBar2, cBar2);
    simde_float32x4_t cBar3 = simde_vmulq_f32(cBar, cBar2);
    simde_float32x4_t cBar7 = simde_vmulq_f32(cBar3, cBar4);

    simde_float32x4_t pow25_7 = simde_vdupq_n_f32(6103515625.0f);

    // Computing cBar7 / (cBar7 + pow25_7) using reciprocal approximation by
    // approximating the reciprocal of (cBar7 + pow25_7) then multiplying by cBar7
    simde_float32x4_t denom = simde_vaddq_f32(cBar7, pow25_7);

    simde_float32x4_t recip = simde_vrecpeq_f32(denom);

    simde_float32x4_t frac = simde_vmulq_f32(cBar7, recip);
    simde_float32x4_t sqrtFrac = simde_vsqrtq_f32(frac);

    // Since 0.5(1-x) = 0.5 - 0.5 * x
    // 1 + 0.5 - 0.5 * x = 1.5 - 0.5 * x
    simde_float32x4_t gPlusOne =
        simde_vmlsq_n_f32(simde_vdupq_n_f32((1.5)), sqrtFrac, 0.5f);

    simde_float32x4_t a1Prime = simde_vmulq_f32(ref_a, gPlusOne);
    simde_float32x4_t a2Prime = simde_vmulq_f32(comp_a, gPlusOne);

    simde_float32x4_t c1Prime = simde_vsqrtq_f32(simde_vaddq_f32(
        simde_vmulq_f32(a1Prime, a1Prime), simde_vmulq_f32(ref_b, ref_b)));

    simde_float32x4_t c2Prime = simde_vsqrtq_f32(simde_vaddq_f32(
        simde_vmulq_f32(a2Prime, a2Prime), simde_vmulq_f32(comp_b, comp_b)));

    simde_float32x4_t cBarPrime =
        simde_vmulq_n_f32(simde_vaddq_f32(c1Prime, c2Prime), 0.5f);

    simde_float32x4_t deg_factor = simde_vdupq_n_f32(180.0f / M_PI);
    simde_float32x4_t two_pi = simde_vdupq_n_f32(2.0f * M_PI);

    simde_float32x4_t angle_h1 = atan2_approx(ref_b, a1Prime);
    simde_float32x4_t h1Prime = simde_vaddq_f32(angle_h1, two_pi);
    h1Prime = simde_vmulq_f32(h1Prime, deg_factor);

    simde_float32x4_t angle_h2 = atan2_approx(comp_b, a2Prime);
    simde_float32x4_t h2Prime = simde_vaddq_f32(angle_h2, two_pi);
    h2Prime = simde_vmulq_f32(h2Prime, deg_factor);

    // float tmp1[4], tmp2[4];
    // simde_vst1q_f32(tmp1, ref_b);
    // simde_vst1q_f32(tmp2, a1Prime);
    // for (int i = 0; i < 4; ++i)
    // {
    //     tmp1[i] = std::atan2f(tmp1[i], tmp2[i]);
    // }
    // simde_float32x4_t angle_h1 = simde_vld1q_f32(tmp1);
    // simde_float32x4_t h1Prime =
    //     simde_vmulq_f32(simde_vaddq_f32(angle_h1, two_pi), deg_factor);
    //
    // // Do the same for comp_b and a2Prime:
    // simde_vst1q_f32(tmp1, comp_b);
    // simde_vst1q_f32(tmp2, a2Prime);
    // for (int i = 0; i < 4; ++i)
    // {
    //     tmp1[i] = std::atan2f(tmp1[i], tmp2[i]);
    // }
    // simde_float32x4_t angle_h2 = simde_vld1q_f32(tmp1);
    // simde_float32x4_t h2Prime =
    //     simde_vmulq_f32(simde_vaddq_f32(angle_h2, two_pi), deg_factor);

    simde_float32x4_t deltaLPrime = simde_vsubq_f32(comp_L, ref_L);
    simde_float32x4_t deltaCPrime = simde_vsubq_f32(c2Prime, c1Prime);

    // Compute the raw angular difference: deltaH = h2Prime - h1Prime
    simde_float32x4_t deltaH = simde_vsubq_f32(h2Prime, h1Prime);

    // Compute the absolute difference.
    simde_float32x4_t absDelta = simde_vabsq_f32(deltaH);

    // Create a mask for when an adjustment is needed (absolute difference > 180)
    simde_uint32x4_t adjustNeeded =
        simde_vcgtq_f32(absDelta, simde_vdupq_n_f32(180.0f));

    // Create a mask to decide the sign of the adjustment
    // If h2Prime <= h1Prime, then we should add 360 (i.e. +1); otherwise, subtract 360 (i.e. -1)
    simde_uint32x4_t signMask = simde_vcleq_f32(h2Prime, h1Prime);
    simde_float32x4_t sign = simde_vbslq_f32(signMask, simde_vdupq_n_f32(1.0f),
                                             simde_vdupq_n_f32(-1.0f));

    // Multiply the sign by 360 to create the offset
    simde_float32x4_t offset = simde_vmulq_f32(sign, simde_vdupq_n_f32(360.0f));

    // Only apply the offset where the adjustment is needed
    offset = simde_vbslq_f32(adjustNeeded, offset, simde_vdupq_n_f32(0.0f));

    simde_float32x4_t deltahPrime = simde_vaddq_f32(deltaH, offset);

    // Compute the angle in radians: deltahPrime * (M_PI / 360.0f)
    simde_float32x4_t scale = simde_vdupq_n_f32(M_PI / 360.0f);
    simde_float32x4_t angle = simde_vmulq_f32(deltahPrime, scale);

    // Approximate the sine of the angle
    simde_float32x4_t sin_angle = sin_approx(angle);

    // Compute c1Prime * c2Prime and then take the square root
    simde_float32x4_t prod_c1c2 = simde_vmulq_f32(c1Prime, c2Prime);
    simde_float32x4_t sqrt_c1c2 = simde_vsqrtq_f32(prod_c1c2);

    // Multiply: 2 * sqrt(c1Prime * c2Prime) * sin(deltahPrime * M_PI/360.0f)
    simde_float32x4_t deltaHPrime = simde_vmulq_f32(
        simde_vdupq_n_f32(2.0f), simde_vmulq_f32(sqrt_c1c2, sin_angle));

    // Compute (lBarPrime - 50)
    simde_float32x4_t diff =
        simde_vsubq_f32(lBarPrime, simde_vdupq_n_f32(50.0f));

    // Compute squared difference: (lBarPrime - 50)^2
    simde_float32x4_t diffSq = simde_vmulq_f32(diff, diff);

    // Compute numerator: 0.015f * (lBarPrime - 50)^2
    simde_float32x4_t numerator = simde_vmulq_n_f32(diffSq, 0.015f);

    // Compute denominator input: 20 + (lBarPrime - 50)^2
    simde_float32x4_t denom_val =
        simde_vaddq_f32(simde_vdupq_n_f32(20.0f), diffSq);
    // Compute the square root of the denominator
    simde_float32x4_t sqrt_denominator = simde_vsqrtq_f32(denom_val);

    recip = simde_vrecpeq_f32(sqrt_denominator);
    recip = simde_vmulq_f32(simde_vrecpsq_f32(sqrt_denominator, recip), recip);

    // (0.015f * (lBarPrime - 50)^2) / sqrt(20 + (lBarPrime - 50)^2)
    simde_float32x4_t fraction = simde_vmulq_f32(numerator, recip);

    // sL = 1 + fraction
    simde_float32x4_t sL = simde_vaddq_f32(simde_vdupq_n_f32(1.0f), fraction);

    simde_float32x4_t sC =
        simde_vmlaq_n_f32(simde_vdupq_n_f32(1.0f), cBarPrime, 0.045f);

    simde_float32x4_t sum = simde_vaddq_f32(h1Prime, h2Prime);
    diff = simde_vsubq_f32(h1Prime, h2Prime);
    simde_float32x4_t absDiff = simde_vabsq_f32(diff);

    // Condition 1: (absDiff <= 180)
    simde_uint32x4_t cond1 =
        simde_vcleq_f32(absDiff, simde_vdupq_n_f32(180.0f));
    // For diff > 180, test: (sum < 360)
    simde_uint32x4_t cond2 = simde_vcltq_f32(sum, simde_vdupq_n_f32(360.0f));

    // If absDiff <= 180, no offset is needed; otherwise, if (sum < 360) use +360,
    // else use -360.
    simde_float32x4_t offsetForNotCond1 = simde_vbslq_f32(
        cond2, simde_vdupq_n_f32(360.0f), simde_vdupq_n_f32(-360.0f));
    offset = simde_vbslq_f32(cond1, simde_vdupq_n_f32(0.0f), offsetForNotCond1);

    // Compute hBarPrime = (sum + offset) / 2
    simde_float32x4_t hBarPrime =
        simde_vmulq_f32(simde_vaddq_f32(sum, offset), simde_vdupq_n_f32(0.5f));

    const float DEG_TO_RAD = M_PI / 180.0f;

    simde_float32x4_t deg_to_rad = simde_vdupq_n_f32(DEG_TO_RAD);
    simde_float32x4_t hBarPrime2 = simde_vmulq_n_f32(hBarPrime, 2.0f);
    simde_float32x4_t hBarPrime3 = simde_vmulq_n_f32(hBarPrime, 3.0f);
    simde_float32x4_t hBarPrime4 = simde_vmulq_n_f32(hBarPrime, 4.0f);

    simde_float32x4_t rad1 = simde_vmulq_f32(
        simde_vsubq_f32(hBarPrime, simde_vdupq_n_f32(30.0f)), deg_to_rad);
    simde_float32x4_t rad2 = simde_vmulq_f32(hBarPrime2, deg_to_rad);
    simde_float32x4_t rad3 = simde_vmulq_f32(
        simde_vaddq_f32(hBarPrime3, simde_vdupq_n_f32(6.0f)), deg_to_rad);
    simde_float32x4_t rad4 = simde_vmulq_f32(
        simde_vsubq_f32(hBarPrime4, simde_vdupq_n_f32(63.0f)), deg_to_rad);

    simde_float32x4_t cos1 = cos_approx(rad1);
    simde_float32x4_t cos2 = cos_approx(rad2);
    simde_float32x4_t cos3 = cos_approx(rad3);
    simde_float32x4_t cos4 = cos_approx(rad4);

    simde_float32x4_t t = simde_vdupq_n_f32(1.0f);
    t = simde_vmlsq_n_f32(t, cos1, 0.17f);  // t = 1 - 0.17 * cos1
    t = simde_vmlaq_n_f32(t, cos2, 0.24f);  // t += 0.24 * cos2
    t = simde_vmlaq_n_f32(t, cos3, 0.32f);  // t += 0.32 * cos3
    t = simde_vmlsq_n_f32(t, cos4, 0.20f);  // t -= 0.20 * cos4

    simde_float32x4_t sH =
        simde_vmlaq_f32(simde_vdupq_n_f32(1.0f), simde_vmulq_f32(cBarPrime, t),
                        simde_vdupq_n_f32(0.015f));

    simde_float32x4_t cBarPrime2 = simde_vmulq_f32(cBarPrime, cBarPrime);
    simde_float32x4_t cBarPrime4 = simde_vmulq_f32(cBarPrime2, cBarPrime2);
    simde_float32x4_t cBarPrime7 =
        simde_vmulq_f32(cBarPrime4, simde_vmulq_f32(cBarPrime2, cBarPrime));

    simde_float32x4_t denom_rt = simde_vaddq_f32(cBarPrime7, pow25_7);

    simde_float32x4_t rt_sqrt =
        simde_vsqrtq_f32(simde_vdivq_f32(cBarPrime7, denom_rt));

    // (hBarPrime - 275)/25
    simde_float32x4_t h_diff =
        simde_vsubq_f32(hBarPrime, simde_vdupq_n_f32(275.0f));
    simde_float32x4_t h_scaled = simde_vmulq_n_f32(h_diff, 1.0f / 25.0f);

    // -(h_scaled)^2
    simde_float32x4_t h_squared = simde_vmulq_f32(h_scaled, h_scaled);
    simde_float32x4_t neg_h_squared = simde_vnegq_f32(h_squared);

    // exp(-((hBarPrime - 275)/25)^2)
    simde_float32x4_t exp_result = exp_approx(neg_h_squared);

    // 60 * exp_result * π/180
    angle =
        simde_vmulq_n_f32(simde_vmulq_n_f32(exp_result, 60.0f), M_PI / 180.0f);

    simde_float32x4_t sin_result = sin_approx(angle);

    simde_float32x4_t rT =
        simde_vmulq_n_f32(simde_vmulq_f32(rt_sqrt, sin_result), -2.0f);

    simde_float32x4_t lightness = simde_vdivq_f32(deltaLPrime, sL);
    simde_float32x4_t chroma = simde_vdivq_f32(deltaCPrime, sC);
    simde_float32x4_t hue = simde_vdivq_f32(deltaHPrime, sH);

    simde_float32x4_t lightness_sq = simde_vmulq_f32(lightness, lightness);
    simde_float32x4_t chroma_sq = simde_vmulq_f32(chroma, chroma);
    simde_float32x4_t hue_sq = simde_vmulq_f32(hue, hue);

    // rT * chroma * hue
    simde_float32x4_t rt_term =
        simde_vmulq_f32(simde_vmulq_f32(rT, chroma), hue);

    // Sum all terms
    sum = simde_vaddq_f32(
        simde_vaddq_f32(simde_vaddq_f32(lightness_sq, chroma_sq), hue_sq),
        rt_term);

    // Calculate final sqrt
    simde_float32x4_t result = simde_vsqrtq_f32(sum);

    // Store the result
    simde_vst1q_f32(results, result);
}

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
