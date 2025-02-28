#include "color/delta_e.h"

namespace delta {

//TODO
// --- CIE76 ---
float CIE76::calculate(const Lab &color1, const Lab &color2)
{
    return 1.0f;
}

//TODO
std::vector<float> CIE76::calculate(const Lab &reference,
                                    const std::vector<Lab> &colors)
{
    std::vector<float> results;
    results.reserve(colors.size());
    for (const auto &col : colors)
    {
        results.push_back(calculate(reference, col));
    }
    return results;
}

//TODO
// --- CIE94 ---
float CIE94::calculate(const Lab &color1, const Lab &color2)
{
    return CIE76::calculate(color1, color2);
}

//TODO
std::vector<float> CIE94::calculate(const Lab &reference,
                                    const std::vector<Lab> &colors)
{
    return CIE76::calculate(reference, colors);
}

// --- CIEDE2000 ---
float CIEDE2000::calculate(const Lab &color1, const Lab &color2)
{
    const float lBarPrime = (color1.L() + color2.L()) * 0.5f;
    const float c1 =
        std::sqrt(color1.a() * color1.a() + color1.b() * color1.b());
    const float c2 =
        std::sqrt(color2.a() * color2.a() + color2.b() * color2.b());
    const float cBar = (c1 + c2) * 0.5f;
    const float cBar7 = std::pow(cBar, 7.0f);
    const float pow25_7 = 6103515625.0f;  // std::pow(25.0f, 7.0f) precomputed
    const float g = 0.5f * (1.0f - std::sqrt(cBar7 / (cBar7 + pow25_7)));
    const float a1Prime = color1.a() * (1 + g);
    const float a2Prime = color2.a() * (1 + g);
    const float c1Prime =
        std::sqrt(a1Prime * a1Prime + color1.b() * color1.b());
    const float c2Prime =
        std::sqrt(a2Prime * a2Prime + color2.b() * color2.b());
    const float cBarPrime = (c1Prime + c2Prime) * 0.5f;
    const float h1Prime =
        (std::atan2(color1.b(), a1Prime) + 2.0f * M_PI) * 180.0f / M_PI;
    const float h2Prime =
        (std::atan2(color2.b(), a2Prime) + 2.0f * M_PI) * 180.0f / M_PI;
    float deltaLPrime = color2.L() - color1.L();
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

std::vector<float> CIEDE2000::calculate(const Lab &reference,
                                        const std::vector<Lab> &colors)
{
    switch (simd::best_architecture)
    {
        case simd::Architecture::NEON:
            return calculate_neon(reference, colors);
        case simd::Architecture::AVX2:
            return calculate_avx2(reference, colors);
        case simd::Architecture::SCALAR:
        default:
            return calculate_scalar(reference, colors);
    }
}

std::vector<float> CIEDE2000::calculate_scalar(const Lab &reference,
                                               const std::vector<Lab> &colors)
{
    std::vector<float> results(colors.size());
    for (size_t i = 0; i < colors.size(); ++i)
    {
        results[i] = calculate(reference, colors[i]);
    }
    return results;
}

void CIEDE2000::calculate_neon_batch(const Lab &reference, const Lab *colors,
                                     float *results)
{
    const simde_float16_t half = 0.5f;
    const simde_float16_t one = 1.0f;
    const simde_float16_t two = 2.0f;
    const simde_float16_t neg_one = -1.0f;
    const simde_float16_t twenty = 20.0f;
    const simde_float16_t twenty_five = 25.0f;
    const simde_float16_t fifty = 50.0f;
    const simde_float16_t hundred_eighty = 180.0f;
    const simde_float16_t three_sixty = 360.0f;
    const simde_float16_t one_point_five = 1.5f;
    const simde_float16_t zero_point_zero_one_fifteen = 0.015f;
    const simde_float16_t zero_point_zero_four_five = 0.045f;
    const simde_float16_t thirty = 30.0f;
    const simde_float16_t six = 6.0f;
    const simde_float16_t sixty_three = 63.0f;
    const simde_float16_t zero_point_one_seven = 0.17f;
    const simde_float16_t zero_point_two_four = 0.24f;
    const simde_float16_t zero_point_three_two = 0.32f;
    const simde_float16_t zero_point_two = 0.2f;
    const simde_float16_t two_seventy_five = 275.0f;
    const simde_float16_t inv_twenty_five = 0.04f;
    const simde_float16_t sixty = 60.0f;
    const simde_float16_t deg_to_rad = (simde_float16_t)(M_PI / 180.0f);
    const simde_float16_t deg_factor = (simde_float16_t)(180.0f / M_PI);
    const simde_float16_t rad_scale = (simde_float16_t)(M_PI / 360.0f);
    const simde_float16_t two_pi = (simde_float16_t)(2.0f * M_PI);

    simde_float16x8_t v_half = simde_vdupq_n_f16(half);
    simde_float16x8_t v_one = simde_vdupq_n_f16(one);
    simde_float16x8_t v_two = simde_vdupq_n_f16(two);
    simde_float16x8_t v_twenty = simde_vdupq_n_f16(twenty);
    simde_float16x8_t v_twenty_five = simde_vdupq_n_f16(twenty_five);
    simde_float16x8_t v_fifty = simde_vdupq_n_f16(fifty);
    simde_float16x8_t v_hundred_eighty = simde_vdupq_n_f16(hundred_eighty);
    simde_float16x8_t v_three_sixty = simde_vdupq_n_f16(three_sixty);
    simde_float16x8_t v_one_point_five = simde_vdupq_n_f16(one_point_five);
    simde_float16x8_t v_deg_to_rad = simde_vdupq_n_f16(deg_to_rad);
    simde_float16x8_t v_deg_factor = simde_vdupq_n_f16(deg_factor);
    simde_float16x8_t v_rad_scale = simde_vdupq_n_f16(rad_scale);

    simde_float16x8_t ref_L = simde_vdupq_n_f16(reference.L());
    simde_float16x8_t ref_a = simde_vdupq_n_f16(reference.a());
    simde_float16x8_t ref_b = simde_vdupq_n_f16(reference.b());

    simde_float16x8x3_t comp_lab =
        simde_vld3q_f16((const simde_float16_t *)colors);
    simde_float16x8_t comp_L = comp_lab.val[0];
    simde_float16x8_t comp_a = comp_lab.val[1];
    simde_float16x8_t comp_b = comp_lab.val[2];

    simde_float16x8_t lBarPrime =
        simde_vmulq_f16(simde_vaddq_f16(ref_L, comp_L), v_half);

    // Compute c1 as sqrt(ref_a^2 + ref_b^2)
    simde_float16x8_t ref_a_sq = simde_vmulq_f16(ref_a, ref_a);
    simde_float16x8_t c1_sq = simde_vfmaq_f16(ref_a_sq, ref_b, ref_b);
    simde_float16x8_t c1 = simde_vsqrtq_f16(c1_sq);

    simde_float16x8_t comp_a_sq = simde_vmulq_f16(comp_a, comp_a);
    simde_float16x8_t c2_sq = simde_vfmaq_f16(comp_a_sq, comp_b, comp_b);
    simde_float16x8_t c2 = simde_vsqrtq_f16(c2_sq);
    simde_float16x8_t cBar = simde_vmulq_f16(simde_vaddq_f16(c1, c2), v_half);

    simde_float16x8_t x = simde_vdivq_f16(cBar, v_twenty_five);
    simde_float16x8_t x2 = simde_vmulq_f16(x, x);
    simde_float16x8_t x3 = simde_vmulq_f16(x, x2);
    simde_float16x8_t x4 = simde_vmulq_f16(x2, x2);
    simde_float16x8_t x7 = simde_vmulq_f16(x3, x4);

    // 1.5 - 0.5 * sqrt(x7/(1+x7))
    simde_float16x8_t one_plus_x7 = simde_vaddq_f16(v_one, x7);
    simde_float16x8_t frac = simde_vdivq_f16(x7, one_plus_x7);
    simde_float16x8_t sqrtFrac = simde_vsqrtq_f16(frac);
    simde_float16x8_t gPlusOne =
        simde_vfmsq_f16(v_one_point_five, v_half, sqrtFrac);

    simde_float16x8_t a1Prime = simde_vmulq_f16(ref_a, gPlusOne);
    simde_float16x8_t a2Prime = simde_vmulq_f16(comp_a, gPlusOne);

    // a1Prime*a1Prime + (ref_b * ref_b)
    simde_float16x8_t a1Prime_sq = simde_vmulq_f16(a1Prime, a1Prime);
    simde_float16x8_t c1Prime =
        simde_vsqrtq_f16(simde_vfmaq_f16(a1Prime_sq, ref_b, ref_b));

    // a2Prime*a2Prime + (comp_b * comp_b)
    simde_float16x8_t a2Prime_sq = simde_vmulq_f16(a2Prime, a2Prime);
    simde_float16x8_t c2Prime =
        simde_vsqrtq_f16(simde_vfmaq_f16(a2Prime_sq, comp_b, comp_b));

    simde_float16x8_t cBarPrime =
        simde_vmulq_f16(simde_vaddq_f16(c1Prime, c2Prime), v_half);

    simde_float16x8_t h1Prime = simde_vmulq_f16(
        simde_vaddq_f16(math::atan2(ref_b, a1Prime), simde_vdupq_n_f16(two_pi)),
        v_deg_factor);

    simde_float16x8_t h2Prime =
        simde_vmulq_f16(simde_vaddq_f16(math::atan2(comp_b, a2Prime),
                                        simde_vdupq_n_f16(two_pi)),
                        v_deg_factor);

    simde_float16x8_t deltaLPrime = simde_vsubq_f16(comp_L, ref_L);
    simde_float16x8_t deltaCPrime = simde_vsubq_f16(c2Prime, c1Prime);

    // Handle deltaH with proper angle adjustment
    simde_float16x8_t deltaH = simde_vsubq_f16(h2Prime, h1Prime);
    simde_uint16x8_t adjustNeeded =
        simde_vcgtq_f16(simde_vabsq_f16(deltaH), v_hundred_eighty);
    simde_uint16x8_t signMask = simde_vcleq_f16(h2Prime, h1Prime);

    // Create sign vector (1 or -1)
    simde_float16x8_t sign =
        simde_vbslq_f16(signMask, v_one, simde_vdupq_n_f16(neg_one));

    // Apply offset conditionally
    simde_float16x8_t offset = simde_vmulq_f16(sign, v_three_sixty);
    offset = simde_vbslq_f16(adjustNeeded, offset, simde_vdupq_n_f16(0.0f));
    simde_float16x8_t deltahPrime = simde_vaddq_f16(deltaH, offset);

    simde_float16x8_t angle = simde_vmulq_f16(deltahPrime, v_rad_scale);
    simde_float16x8_t sin_angle = math::sin(angle);

    // sqrt(c1Prime * c2Prime) * sin_angle * two
    simde_float16x8_t c1c2_sqrt =
        simde_vsqrtq_f16(simde_vmulq_f16(c1Prime, c2Prime));
    simde_float16x8_t deltaHPrime =
        simde_vmulq_f16(simde_vmulq_f16(c1c2_sqrt, sin_angle), v_two);

    simde_float16x8_t diff = simde_vsubq_f16(lBarPrime, v_fifty);
    simde_float16x8_t diff_sq = simde_vmulq_f16(diff, diff);

    simde_float16x8_t denom = simde_vaddq_f16(v_twenty, diff_sq);
    simde_float16x8_t inv_sqrt = simde_vrecpeq_f16(simde_vsqrtq_f16(denom));

    simde_float16x8_t term_sL =
        simde_vmulq_n_f16(diff_sq, zero_point_zero_one_fifteen);
    simde_float16x8_t sL = simde_vfmaq_f16(v_one, term_sL, inv_sqrt);

    // Compute sC = 1 + 0.045 * cBarPrime
    simde_float16x8_t sC =
        simde_vfmaq_n_f16(v_one, cBarPrime, zero_point_zero_four_five);

    simde_float16x8_t sum_h = simde_vaddq_f16(h1Prime, h2Prime);
    simde_float16x8_t diff_h = simde_vsubq_f16(h1Prime, h2Prime);
    simde_float16x8_t absDiff_h = simde_vabsq_f16(diff_h);

    simde_uint16x8_t cond1 = simde_vcleq_f16(absDiff_h, v_hundred_eighty);
    simde_uint16x8_t cond2 = simde_vcltq_f16(sum_h, v_three_sixty);

    simde_float16x8_t offset_h =
        simde_vbslq_f16(cond2, v_three_sixty, simde_vnegq_f16(v_three_sixty));

    offset_h = simde_vbslq_f16(cond1, simde_vdupq_n_f16(0.0f), offset_h);
    simde_float16x8_t hBarPrime =
        simde_vmulq_f16(simde_vaddq_f16(sum_h, offset_h), v_half);

    simde_float16x8_t t = v_one;

    // t = t - (cos((hBarPrime - 30)*deg_to_rad) * 0.17)
    {
        simde_float16x8_t angle = simde_vmulq_f16(
            simde_vsubq_f16(hBarPrime, simde_vdupq_n_f16(thirty)),
            v_deg_to_rad);
        t = simde_vfmsq_n_f16(t, math::cos(angle), zero_point_one_seven);
    }

    // t = t + (cos((hBarPrime*2*deg_to_rad)) * 0.24)
    {
        simde_float16x8_t angle =
            simde_vmulq_f16(simde_vmulq_f16(hBarPrime, v_two), v_deg_to_rad);
        t = simde_vfmaq_n_f16(t, math::cos(angle), zero_point_two_four);
    }

    // t = t + (cos(((hBarPrime*3 + 6)*deg_to_rad)) * 0.32)
    {
        // Use FMA: hBarPrime*3 + 6
        simde_float16x8_t inner =
            simde_vfmaq_n_f16(simde_vdupq_n_f16(six), hBarPrime, 3.0f);
        simde_float16x8_t angle = simde_vmulq_f16(inner, v_deg_to_rad);
        t = simde_vfmaq_n_f16(t, math::cos(angle), zero_point_three_two);
    }

    // t = t - (cos(((hBarPrime*4 - 63)*deg_to_rad)) * 0.2)
    {
        simde_float16x8_t inner = simde_vsubq_f16(
            simde_vmulq_n_f16(hBarPrime, 4.0f), simde_vdupq_n_f16(sixty_three));
        simde_float16x8_t angle = simde_vmulq_f16(inner, v_deg_to_rad);
        t = simde_vfmsq_n_f16(t, math::cos(angle), zero_point_two);
    }

    // sH = 1 + 0.015 * cBarPrime * t
    simde_float16x8_t cBarPrime_t = simde_vmulq_f16(cBarPrime, t);
    simde_float16x8_t sH =
        simde_vfmaq_n_f16(v_one, cBarPrime_t, zero_point_zero_one_fifteen);

    simde_float16x8_t x_rt = simde_vdivq_f16(cBarPrime, v_twenty_five);
    simde_float16x8_t x2_rt = simde_vmulq_f16(x_rt, x_rt);
    simde_float16x8_t x3_rt = simde_vmulq_f16(x_rt, x2_rt);
    simde_float16x8_t x4_rt = simde_vmulq_f16(x2_rt, x2_rt);
    simde_float16x8_t x7_rt = simde_vmulq_f16(x3_rt, x4_rt);

    simde_float16x8_t rt_denom = simde_vaddq_f16(v_one, x7_rt);
    simde_float16x8_t rt_sqrt =
        simde_vsqrtq_f16(simde_vdivq_f16(x7_rt, rt_denom));

    // exp(-(hBarPrime-275)²/625)
    simde_float16x8_t h_diff =
        simde_vsubq_f16(hBarPrime, simde_vdupq_n_f16(two_seventy_five));

    simde_float16x8_t h_scaled =
        simde_vmulq_f16(h_diff, simde_vdupq_n_f16(inv_twenty_five));

    simde_float16x8_t exp_term =
        simde_vnegq_f16(simde_vmulq_f16(h_scaled, h_scaled));
    simde_float16x8_t exp_result = math::exp(exp_term);

    // sin(60 * exp_result * deg_to_rad)
    simde_float16x8_t exp_sixty =
        simde_vmulq_f16(exp_result, simde_vdupq_n_f16(sixty));
    simde_float16x8_t sin_angle_rt =
        math::sin(simde_vmulq_f16(exp_sixty, v_deg_to_rad));

    // rT = -2 * rt_sqrt * sin_angle_rt
    simde_float16x8_t rT =
        simde_vmulq_n_f16(simde_vmulq_f16(rt_sqrt, sin_angle_rt), -2.0f);

    simde_float16x8_t lightness = simde_vdivq_f16(deltaLPrime, sL);
    simde_float16x8_t chroma = simde_vdivq_f16(deltaCPrime, sC);
    simde_float16x8_t hue = simde_vdivq_f16(deltaHPrime, sH);

    simde_float16x8_t lightness_sq = simde_vmulq_f16(lightness, lightness);
    simde_float16x8_t chroma_sq = simde_vmulq_f16(chroma, chroma);

    simde_float16x8_t sum12 = simde_vaddq_f16(lightness_sq, chroma_sq);

    simde_float16x8_t hue_sq = simde_vmulq_f16(hue, hue);

    simde_float16x8_t rt_term =
        simde_vmulq_f16(simde_vmulq_f16(rT, chroma), hue);

    simde_float16x8_t sum34 = simde_vaddq_f16(hue_sq, rt_term);

    simde_float16x8_t sum = simde_vaddq_f16(sum12, sum34);

    simde_float16x8_t result = simde_vsqrtq_f16(sum);

    simde_float32x4_t result_low =
        simde_vcvt_f32_f16(simde_vget_low_f16(result));
    simde_float32x4_t result_high =
        simde_vcvt_f32_f16(simde_vget_high_f16(result));

    // Store to output buffer
    simde_vst1q_f32(results, result_low);
    simde_vst1q_f32(results + 4, result_high);

    // simde_vst1q_f16(results, result);
}

std::vector<float> CIEDE2000::calculate_neon(const Lab &reference,
                                             const std::vector<Lab> &colors)
{
    const size_t lane_width = simd::get_lane_width(simd::best_architecture);
    const size_t numFullChunks = colors.size() / lane_width;
    const size_t remainder = colors.size() % lane_width;
    std::vector<float> results(colors.size());

    for (size_t i = 0; i < numFullChunks; ++i)
    {
        calculate_neon_batch(reference, &colors[i * lane_width],
                             &results[i * lane_width]);
    }

    if (remainder > 0)
    {
        Lab tempLabs[lane_width];
        for (size_t i = 0; i < remainder; ++i)
        {
            tempLabs[i] = colors[numFullChunks * lane_width + i];
        }
        for (size_t i = remainder; i < lane_width; ++i)
        {
            tempLabs[i] = colors[colors.size() - 1];
        }

        float tempResults[lane_width];
        calculate_neon_batch(reference, tempLabs, tempResults);

        for (size_t i = 0; i < remainder; ++i)
        {
            results[numFullChunks * lane_width + i] = tempResults[i];
        }
    }

    return results;
}

void CIEDE2000::calculate_avx2_batch(const Lab &reference, const Lab *colors,
                                     float *results)
{
    simde__m256 ref_L = simde_mm256_set1_ps(reference.L());
    simde__m256 ref_a = simde_mm256_set1_ps(reference.a());
    simde__m256 ref_b = simde_mm256_set1_ps(reference.b());

    simde__m256 comp_L = simde_mm256_setr_ps(
        colors[0].L(), colors[1].L(), colors[2].L(), colors[3].L(),
        colors[4].L(), colors[5].L(), colors[6].L(), colors[7].L());
    simde__m256 comp_a = simde_mm256_setr_ps(
        colors[0].a(), colors[1].a(), colors[2].a(), colors[3].a(),
        colors[4].a(), colors[5].a(), colors[6].a(), colors[7].a());
    simde__m256 comp_b = simde_mm256_setr_ps(
        colors[0].b(), colors[1].b(), colors[2].b(), colors[3].b(),
        colors[4].b(), colors[5].b(), colors[6].b(), colors[7].b());

    simde__m256 lBarPrime = simde_mm256_mul_ps(
        simde_mm256_add_ps(ref_L, comp_L), simde_mm256_set1_ps(0.5f));

    simde__m256 c1 = simde_mm256_sqrt_ps(simde_mm256_add_ps(
        simde_mm256_mul_ps(ref_a, ref_a), simde_mm256_mul_ps(ref_b, ref_b)));

    simde__m256 c2 = simde_mm256_sqrt_ps(
        simde_mm256_add_ps(simde_mm256_mul_ps(comp_a, comp_a),
                           simde_mm256_mul_ps(comp_b, comp_b)));

    simde__m256 cBar = simde_mm256_mul_ps(simde_mm256_add_ps(c1, c2),
                                          simde_mm256_set1_ps(0.5f));

    // Calculating cBar^7 with 4 multiplication operations
    // instead of 7 by taking advantage of the fact that
    // 7 = 1 + 2 + 4
    simde__m256 cBar2 = simde_mm256_mul_ps(cBar, cBar);
    simde__m256 cBar4 = simde_mm256_mul_ps(cBar2, cBar2);
    simde__m256 cBar3 = simde_mm256_mul_ps(cBar, cBar2);
    simde__m256 cBar7 = simde_mm256_mul_ps(cBar3, cBar4);

    simde__m256 pow25_7 = simde_mm256_set1_ps(6103515625.0f);

    // Computing cBar7 / (cBar7 + pow25_7)
    simde__m256 denom = simde_mm256_add_ps(cBar7, pow25_7);

    simde__m256 recip = simde_mm256_rcp_ps(denom);
    // Optional: Refine the reciprocal approximation for better accuracy
    recip = simde_mm256_mul_ps(
        recip, simde_mm256_sub_ps(simde_mm256_set1_ps(2.0f),
                                  simde_mm256_mul_ps(denom, recip)));

    simde__m256 frac = simde_mm256_mul_ps(cBar7, recip);
    simde__m256 sqrtFrac = simde_mm256_sqrt_ps(frac);

    // Since 0.5(1-x) = 0.5 - 0.5 * x
    // 1 + 0.5 - 0.5 * x = 1.5 - 0.5 * x
    simde__m256 gPlusOne = simde_mm256_sub_ps(
        simde_mm256_set1_ps(1.5f),
        simde_mm256_mul_ps(sqrtFrac, simde_mm256_set1_ps(0.5f)));

    simde__m256 a1Prime = simde_mm256_mul_ps(ref_a, gPlusOne);
    simde__m256 a2Prime = simde_mm256_mul_ps(comp_a, gPlusOne);

    simde__m256 c1Prime = simde_mm256_sqrt_ps(
        simde_mm256_add_ps(simde_mm256_mul_ps(a1Prime, a1Prime),
                           simde_mm256_mul_ps(ref_b, ref_b)));

    simde__m256 c2Prime = simde_mm256_sqrt_ps(
        simde_mm256_add_ps(simde_mm256_mul_ps(a2Prime, a2Prime),
                           simde_mm256_mul_ps(comp_b, comp_b)));

    simde__m256 cBarPrime = simde_mm256_mul_ps(
        simde_mm256_add_ps(c1Prime, c2Prime), simde_mm256_set1_ps(0.5f));

    simde__m256 deg_factor = simde_mm256_set1_ps(180.0f / M_PI);
    simde__m256 two_pi = simde_mm256_set1_ps(2.0f * M_PI);

    simde__m256 angle_h1 = math::atan2(ref_b, a1Prime);
    simde__m256 h1Prime = simde_mm256_add_ps(angle_h1, two_pi);
    h1Prime = simde_mm256_mul_ps(h1Prime, deg_factor);

    simde__m256 angle_h2 = math::atan2(comp_b, a2Prime);
    simde__m256 h2Prime = simde_mm256_add_ps(angle_h2, two_pi);
    h2Prime = simde_mm256_mul_ps(h2Prime, deg_factor);

    simde__m256 deltaLPrime = simde_mm256_sub_ps(comp_L, ref_L);
    simde__m256 deltaCPrime = simde_mm256_sub_ps(c2Prime, c1Prime);

    // Compute the raw angular difference: deltaH = h2Prime - h1Prime
    simde__m256 deltaH = simde_mm256_sub_ps(h2Prime, h1Prime);

    // Compute the absolute difference.
    simde__m256 absDelta = simde_mm256_andnot_ps(
        simde_mm256_set1_ps(-0.0f), deltaH);  // abs using sign bit mask

    // Create a mask for when an adjustment is needed (absolute difference > 180)
    simde__m256 mask180 = simde_mm256_cmp_ps(
        absDelta, simde_mm256_set1_ps(180.0f), SIMDE_CMP_GT_OQ);

    // Create a mask to decide the sign of the adjustment
    simde__m256 signMask =
        simde_mm256_cmp_ps(h2Prime, h1Prime, SIMDE_CMP_LE_OQ);

    // Combine the masks: if adjustment needed AND h2Prime <= h1Prime then +360, else -360
    simde__m256 sign = simde_mm256_or_ps(
        simde_mm256_and_ps(signMask, simde_mm256_set1_ps(1.0f)),
        simde_mm256_andnot_ps(signMask, simde_mm256_set1_ps(-1.0f)));

    // Multiply the sign by 360 to create the offset
    simde__m256 offset = simde_mm256_mul_ps(sign, simde_mm256_set1_ps(360.0f));

    // Only apply the offset where the adjustment is needed
    offset = simde_mm256_and_ps(mask180, offset);

    simde__m256 deltahPrime = simde_mm256_add_ps(deltaH, offset);

    // Compute the angle in radians: deltahPrime * (M_PI / 360.0f)
    simde__m256 scale = simde_mm256_set1_ps(M_PI / 360.0f);
    simde__m256 angle = simde_mm256_mul_ps(deltahPrime, scale);

    // Approximate the sine of the angle
    simde__m256 sin_angle = math::sin(angle);

    // Compute c1Prime * c2Prime and then take the square root
    simde__m256 prod_c1c2 = simde_mm256_mul_ps(c1Prime, c2Prime);
    simde__m256 sqrt_c1c2 = simde_mm256_sqrt_ps(prod_c1c2);

    // Multiply: 2 * sqrt(c1Prime * c2Prime) * sin(deltahPrime * M_PI/360.0f)
    simde__m256 deltaHPrime = simde_mm256_mul_ps(
        simde_mm256_set1_ps(2.0f), simde_mm256_mul_ps(sqrt_c1c2, sin_angle));

    // Compute (lBarPrime - 50)
    simde__m256 diff =
        simde_mm256_sub_ps(lBarPrime, simde_mm256_set1_ps(50.0f));

    // Compute squared difference: (lBarPrime - 50)^2
    simde__m256 diffSq = simde_mm256_mul_ps(diff, diff);

    // Compute numerator: 0.015f * (lBarPrime - 50)^2
    simde__m256 numerator =
        simde_mm256_mul_ps(diffSq, simde_mm256_set1_ps(0.015f));

    // Compute denominator input: 20 + (lBarPrime - 50)^2
    simde__m256 denom_val =
        simde_mm256_add_ps(simde_mm256_set1_ps(20.0f), diffSq);

    // Compute the square root of the denominator
    simde__m256 sqrt_denominator = simde_mm256_sqrt_ps(denom_val);

    // Compute the reciprocal of the square root
    recip = simde_mm256_rcp_ps(sqrt_denominator);
    // Optional: Refine the reciprocal approximation
    recip = simde_mm256_mul_ps(
        recip, simde_mm256_sub_ps(simde_mm256_set1_ps(2.0f),
                                  simde_mm256_mul_ps(sqrt_denominator, recip)));

    // (0.015f * (lBarPrime - 50)^2) / sqrt(20 + (lBarPrime - 50)^2)
    simde__m256 fraction = simde_mm256_mul_ps(numerator, recip);

    // sL = 1 + fraction
    simde__m256 sL = simde_mm256_add_ps(simde_mm256_set1_ps(1.0f), fraction);

    simde__m256 sC = simde_mm256_add_ps(
        simde_mm256_set1_ps(1.0f),
        simde_mm256_mul_ps(cBarPrime, simde_mm256_set1_ps(0.045f)));

    simde__m256 sum = simde_mm256_add_ps(h1Prime, h2Prime);
    diff = simde_mm256_sub_ps(h1Prime, h2Prime);
    simde__m256 absDiff = simde_mm256_andnot_ps(
        simde_mm256_set1_ps(-0.0f), diff);  // abs using sign bit mask

    // Condition 1: (absDiff <= 180)
    simde__m256 cond1 = simde_mm256_cmp_ps(absDiff, simde_mm256_set1_ps(180.0f),
                                           SIMDE_CMP_LE_OQ);

    // For diff > 180, test: (sum < 360)
    simde__m256 cond2 =
        simde_mm256_cmp_ps(sum, simde_mm256_set1_ps(360.0f), SIMDE_CMP_LT_OQ);

    // If absDiff <= 180, no offset is needed; otherwise, if (sum < 360) use +360, else use -360.
    simde__m256 offsetForNotCond1 = simde_mm256_or_ps(
        simde_mm256_and_ps(cond2, simde_mm256_set1_ps(360.0f)),
        simde_mm256_andnot_ps(cond2, simde_mm256_set1_ps(-360.0f)));

    offset =
        simde_mm256_or_ps(simde_mm256_and_ps(cond1, simde_mm256_set1_ps(0.0f)),
                          simde_mm256_andnot_ps(cond1, offsetForNotCond1));

    // Compute hBarPrime = (sum + offset) / 2
    simde__m256 hBarPrime = simde_mm256_mul_ps(simde_mm256_add_ps(sum, offset),
                                               simde_mm256_set1_ps(0.5f));

    const float DEG_TO_RAD = M_PI / 180.0f;

    simde__m256 deg_to_rad = simde_mm256_set1_ps(DEG_TO_RAD);
    simde__m256 hBarPrime2 =
        simde_mm256_mul_ps(hBarPrime, simde_mm256_set1_ps(2.0f));
    simde__m256 hBarPrime3 =
        simde_mm256_mul_ps(hBarPrime, simde_mm256_set1_ps(3.0f));
    simde__m256 hBarPrime4 =
        simde_mm256_mul_ps(hBarPrime, simde_mm256_set1_ps(4.0f));

    simde__m256 rad1 = simde_mm256_mul_ps(
        simde_mm256_sub_ps(hBarPrime, simde_mm256_set1_ps(30.0f)), deg_to_rad);
    simde__m256 rad2 = simde_mm256_mul_ps(hBarPrime2, deg_to_rad);
    simde__m256 rad3 = simde_mm256_mul_ps(
        simde_mm256_add_ps(hBarPrime3, simde_mm256_set1_ps(6.0f)), deg_to_rad);
    simde__m256 rad4 = simde_mm256_mul_ps(
        simde_mm256_sub_ps(hBarPrime4, simde_mm256_set1_ps(63.0f)), deg_to_rad);

    simde__m256 cos1 = math::cos(rad1);
    simde__m256 cos2 = math::cos(rad2);
    simde__m256 cos3 = math::cos(rad3);
    simde__m256 cos4 = math::cos(rad4);

    simde__m256 t = simde_mm256_set1_ps(1.0f);
    t = simde_mm256_sub_ps(
        t, simde_mm256_mul_ps(
               cos1, simde_mm256_set1_ps(0.17f)));  // t = 1 - 0.17 * cos1
    t = simde_mm256_add_ps(
        t, simde_mm256_mul_ps(cos2,
                              simde_mm256_set1_ps(0.24f)));  // t += 0.24 * cos2
    t = simde_mm256_add_ps(
        t, simde_mm256_mul_ps(cos3,
                              simde_mm256_set1_ps(0.32f)));  // t += 0.32 * cos3
    t = simde_mm256_sub_ps(
        t, simde_mm256_mul_ps(cos4,
                              simde_mm256_set1_ps(0.20f)));  // t -= 0.20 * cos4

    simde__m256 sH =
        simde_mm256_add_ps(simde_mm256_set1_ps(1.0f),
                           simde_mm256_mul_ps(simde_mm256_mul_ps(cBarPrime, t),
                                              simde_mm256_set1_ps(0.015f)));

    simde__m256 cBarPrime2 = simde_mm256_mul_ps(cBarPrime, cBarPrime);
    simde__m256 cBarPrime4 = simde_mm256_mul_ps(cBarPrime2, cBarPrime2);
    simde__m256 cBarPrime7 = simde_mm256_mul_ps(
        cBarPrime4, simde_mm256_mul_ps(cBarPrime2, cBarPrime));

    simde__m256 denom_rt = simde_mm256_add_ps(cBarPrime7, pow25_7);

    recip = simde_mm256_rcp_ps(denom_rt);

    simde__m256 rt_sqrt =
        simde_mm256_sqrt_ps(simde_mm256_mul_ps(cBarPrime7, recip));

    // (hBarPrime - 275)/25
    simde__m256 h_diff =
        simde_mm256_sub_ps(hBarPrime, simde_mm256_set1_ps(275.0f));
    simde__m256 h_scaled =
        simde_mm256_mul_ps(h_diff, simde_mm256_set1_ps(1.0f / 25.0f));

    // -(h_scaled)^2
    simde__m256 h_squared = simde_mm256_mul_ps(h_scaled, h_scaled);
    simde__m256 neg_h_squared = simde_mm256_xor_ps(
        h_squared,
        simde_mm256_set1_ps(-0.0f));  // Negate using XOR with sign bit

    // exp(-((hBarPrime - 275)/25)^2)
    simde__m256 exp_result = math::exp(neg_h_squared);

    // 60 * exp_result * π/180
    angle = simde_mm256_mul_ps(
        simde_mm256_mul_ps(exp_result, simde_mm256_set1_ps(60.0f)),
        simde_mm256_set1_ps(M_PI / 180.0f));

    simde__m256 sin_result = math::sin(angle);

    simde__m256 rT = simde_mm256_mul_ps(simde_mm256_mul_ps(rt_sqrt, sin_result),
                                        simde_mm256_set1_ps(-2.0f));

    simde__m256 lightness = simde_mm256_div_ps(deltaLPrime, sL);
    simde__m256 chroma = simde_mm256_div_ps(deltaCPrime, sC);
    simde__m256 hue = simde_mm256_div_ps(deltaHPrime, sH);

    simde__m256 lightness_sq = simde_mm256_mul_ps(lightness, lightness);
    simde__m256 chroma_sq = simde_mm256_mul_ps(chroma, chroma);
    simde__m256 hue_sq = simde_mm256_mul_ps(hue, hue);

    // rT * chroma * hue
    simde__m256 rt_term =
        simde_mm256_mul_ps(simde_mm256_mul_ps(rT, chroma), hue);

    // Sum all terms
    sum = simde_mm256_add_ps(
        simde_mm256_add_ps(simde_mm256_add_ps(lightness_sq, chroma_sq), hue_sq),
        rt_term);

    // Calculate final sqrt
    simde__m256 result = simde_mm256_sqrt_ps(sum);

    // Store the result
    simde_mm256_storeu_ps(results, result);
}

std::vector<float> CIEDE2000::calculate_avx2(const Lab &reference,
                                             const std::vector<Lab> &colors)
{
    const size_t lane_width = simd::get_lane_width(simd::best_architecture);
    const size_t numFullChunks = colors.size() / lane_width;
    const size_t remainder = colors.size() % lane_width;
    std::vector<float> results(colors.size());

    for (size_t i = 0; i < numFullChunks; ++i)
    {
        calculate_avx2_batch(reference, &colors[i * lane_width],
                             &results[i * lane_width]);
    }

    if (remainder > 0)
    {
        Lab tempLabs[lane_width];
        for (size_t i = 0; i < remainder; ++i)
        {
            tempLabs[i] = colors[numFullChunks * lane_width + i];
        }
        for (size_t i = remainder; i < lane_width; ++i)
        {
            tempLabs[i] = colors[colors.size() - 1];
        }

        float tempResults[lane_width];
        calculate_avx2_batch(reference, tempLabs, tempResults);

        for (size_t i = 0; i < remainder; ++i)
        {
            results[numFullChunks * lane_width + i] = tempResults[i];
        }
    }

    return results;
}

}  // namespace delta
