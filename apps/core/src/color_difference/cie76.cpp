#include "color_difference.h"

float CIE76::calculate(const Lab &color1, const Lab &color2)
{
    float deltaL = color1.L() - color2.L();
    float deltaA = color1.a() - color2.a();
    float deltaB = color1.b() - color2.b();

    return std::sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

#if !HAS_NEON
void CIE76::calculate_neon(const Lab &reference, const Lab *colors,
                           float *results)
{
    simde_float32x4_t ref_L = simde_vdupq_n_f32(reference.L());
    simde_float32x4_t ref_a = simde_vdupq_n_f32(reference.a());
    simde_float32x4_t ref_b = simde_vdupq_n_f32(reference.b());

    simde_float32x4x3_t comp_lab =
        simde_vld3q_f32(reinterpret_cast<const float *>(colors));
    simde_float32x4_t comp_L = comp_lab.val[0];
    simde_float32x4_t comp_a = comp_lab.val[1];
    simde_float32x4_t comp_b = comp_lab.val[2];

    simde_float32x4_t deltaL = simde_vsubq_f32(ref_L, comp_L);
    simde_float32x4_t deltaA = simde_vsubq_f32(ref_a, comp_a);
    simde_float32x4_t deltaB = simde_vsubq_f32(ref_b, comp_b);

    simde_float32x4_t deltaL_sq = simde_vmulq_f32(deltaL, deltaL);
    simde_float32x4_t deltaA_sq = simde_vmulq_f32(deltaA, deltaA);
    simde_float32x4_t deltaB_sq = simde_vmulq_f32(deltaB, deltaB);

    simde_float32x4_t sum_sq =
        simde_vaddq_f32(simde_vaddq_f32(deltaL_sq, deltaA_sq), deltaB_sq);

    simde_float32x4_t deltaE76 = simde_vsqrtq_f32(sum_sq);

    simde_vst1q_f32(results, deltaE76);
}
#endif

#if HAS_NEON
void CIE76::calculate_neon(const Lab &reference, const Lab *colors,
                           float *results)
{
    simde_float16x8_t ref_L = simde_vdupq_n_f16(reference.L());
    simde_float16x8_t ref_a = simde_vdupq_n_f16(reference.a());
    simde_float16x8_t ref_b = simde_vdupq_n_f16(reference.b());

    simde_float16x8x3_t comp_lab =
        simde_vld3q_f16(reinterpret_cast<const simde_float16_t *>(colors));
    simde_float16x8_t comp_L = comp_lab.val[0];
    simde_float16x8_t comp_a = comp_lab.val[1];
    simde_float16x8_t comp_b = comp_lab.val[2];

    simde_float16x8_t deltaL = simde_vsubq_f16(ref_L, comp_L);
    simde_float16x8_t deltaA = simde_vsubq_f16(ref_a, comp_a);
    simde_float16x8_t deltaB = simde_vsubq_f16(ref_b, comp_b);

    simde_float16x8_t deltaL_sq = simde_vmulq_f16(deltaL, deltaL);
    simde_float16x8_t deltaA_sq = simde_vmulq_f16(deltaA, deltaA);
    simde_float16x8_t deltaB_sq = simde_vmulq_f16(deltaB, deltaB);

    simde_float16x8_t sum_sq =
        simde_vaddq_f16(simde_vaddq_f16(deltaL_sq, deltaA_sq), deltaB_sq);

    simde_float16x8_t deltaE76 = simde_vsqrtq_f16(sum_sq);

    simde_float32x4_t result_low =
        simde_vcvt_f32_f16(simde_vget_low_f16(deltaE76));
    simde_float32x4_t result_high =
        simde_vcvt_f32_f16(simde_vget_high_f16(deltaE76));
    simde_vst1q_f32(results, result_low);
    simde_vst1q_f32(results + 4, result_high);
}
#endif

void CIE76::calculate_avx2(const Lab &reference, const Lab *colors,
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

    simde__m256 deltaL = simde_mm256_sub_ps(ref_L, comp_L);
    simde__m256 deltaA = simde_mm256_sub_ps(ref_a, comp_a);
    simde__m256 deltaB = simde_mm256_sub_ps(ref_b, comp_b);

    simde__m256 deltaL_sq = simde_mm256_mul_ps(deltaL, deltaL);
    simde__m256 deltaA_sq = simde_mm256_mul_ps(deltaA, deltaA);
    simde__m256 deltaB_sq = simde_mm256_mul_ps(deltaB, deltaB);

    simde__m256 sum_sq =
        simde_mm256_add_ps(simde_mm256_add_ps(deltaL_sq, deltaA_sq), deltaB_sq);

    simde__m256 deltaE76 = simde_mm256_sqrt_ps(sum_sq);

    simde_mm256_storeu_ps(results, deltaE76);
}
