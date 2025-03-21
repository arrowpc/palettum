#include "color_difference.h"

float CIE94::calculate(const Lab &color1, const Lab &color2)
{
    // These constants are actually adjustable variables in the main formula
    // https://en.wikipedia.org/wiki/Color_difference#CIE94
    float K1 = 0.045f;
    float K2 = 0.015f;
    float kL = 1.0f;

    float deltaL = color1.L() - color2.L();

    float C1 = std::sqrt(color1.a() * color1.a() + color1.b() * color1.b());
    float C2 = std::sqrt(color2.a() * color2.a() + color2.b() * color2.b());

    float deltaC = C1 - C2;

    float deltaA = color1.a() - color2.a();
    float deltaB = color1.b() - color2.b();

    float deltaH_sq = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
    float deltaH = (deltaH_sq > 0.0f) ? std::sqrt(deltaH_sq) : 0.0f;

    float S_L = 1.0f;
    float S_C = 1.0f + K1 * C1;
    float S_H = 1.0f + K2 * C1;

    float termL = deltaL / (kL * S_L);
    float termC = deltaC / S_C;
    float termH = deltaH / S_H;

    return std::sqrt(termL * termL + termC * termC + termH * termH);
}

#if !HAS_NEON
void CIE94::calculate_neon(const Lab &reference, const Lab *colors,
                           float *results)
{
    simde_float32x4_t v_kL = simde_vdupq_n_f32(1.0f);
    simde_float32x4_t v_K1 = simde_vdupq_n_f32(0.045f);
    simde_float32x4_t v_K2 = simde_vdupq_n_f32(0.015f);
    simde_float32x4_t v_one = simde_vdupq_n_f32(1.0f);
    simde_float32x4_t v_zero = simde_vdupq_n_f32(0.0f);

    simde_float32x4_t ref_L = simde_vdupq_n_f32(reference.L());
    simde_float32x4_t ref_a = simde_vdupq_n_f32(reference.a());
    simde_float32x4_t ref_b = simde_vdupq_n_f32(reference.b());

    simde_float32x4x3_t comp_lab =
        simde_vld3q_f32(reinterpret_cast<const float *>(colors));
    simde_float32x4_t comp_L = comp_lab.val[0];
    simde_float32x4_t comp_a = comp_lab.val[1];
    simde_float32x4_t comp_b = comp_lab.val[2];

    simde_float32x4_t deltaL = simde_vsubq_f32(ref_L, comp_L);

    // C1* = sqrt(a1² + b1²)
    simde_float32x4_t ref_a_sq = simde_vmulq_f32(ref_a, ref_a);
    simde_float32x4_t ref_b_sq = simde_vmulq_f32(ref_b, ref_b);
    simde_float32x4_t C1_sq = simde_vaddq_f32(ref_a_sq, ref_b_sq);
    simde_float32x4_t C1 = simde_vsqrtq_f32(C1_sq);

    // C2* = sqrt(a2² + b2²)
    simde_float32x4_t comp_a_sq = simde_vmulq_f32(comp_a, comp_a);
    simde_float32x4_t comp_b_sq = simde_vmulq_f32(comp_b, comp_b);
    simde_float32x4_t C2_sq = simde_vaddq_f32(comp_a_sq, comp_b_sq);
    simde_float32x4_t C2 = simde_vsqrtq_f32(C2_sq);

    // ΔC* = C₁* − C₂*
    simde_float32x4_t deltaC = simde_vsubq_f32(C1, C2);

    // 3. Compute the differences in a* and b*.
    simde_float32x4_t deltaA = simde_vsubq_f32(ref_a, comp_a);
    simde_float32x4_t deltaB = simde_vsubq_f32(ref_b, comp_b);

    // Compute (Δa)² + (Δb)²
    simde_float32x4_t deltaA_sq = simde_vmulq_f32(deltaA, deltaA);
    simde_float32x4_t deltaB_sq = simde_vmulq_f32(deltaB, deltaB);
    simde_float32x4_t sum_ab_sq = simde_vaddq_f32(deltaA_sq, deltaB_sq);

    // Compute (ΔC)² = (deltaC)².
    simde_float32x4_t deltaC_sq = simde_vmulq_f32(deltaC, deltaC);

    // Compute ΔH² = (Δa² + Δb²) − (ΔC²) then ΔH = sqrt(ΔH²)
    simde_float32x4_t deltaH_sq = simde_vsubq_f32(sum_ab_sq, deltaC_sq);
    // Clamp negative values to zero (due to floating-point precision).
    simde_float32x4_t deltaH_sq_clamped = simde_vmaxq_f32(deltaH_sq, v_zero);
    simde_float32x4_t deltaH = simde_vsqrtq_f32(deltaH_sq_clamped);

    // Define the weighting functions:
    // S_L = 1,  S_C = 1 + K1 * C1*,  S_H = 1 + K2 * C1*
    simde_float32x4_t S_L = v_one;
    simde_float32x4_t S_C = simde_vfmaq_f32(v_one, C1, v_K1);
    simde_float32x4_t S_H = simde_vfmaq_f32(v_one, C1, v_K2);

    // Compute the three terms:
    // termL = ΔL / (kL · S_L)
    simde_float32x4_t termL =
        simde_vdivq_f32(deltaL, simde_vmulq_f32(v_kL, S_L));
    // termC = ΔC / S_C   (here kC is taken as 1)
    simde_float32x4_t termC = simde_vdivq_f32(deltaC, S_C);
    // termH = ΔH / S_H   (here kH is taken as 1)
    simde_float32x4_t termH = simde_vdivq_f32(deltaH, S_H);

    // Compute ΔE94* = sqrt(termL² + termC² + termH²)
    simde_float32x4_t termL_sq = simde_vmulq_f32(termL, termL);
    simde_float32x4_t termC_sq = simde_vmulq_f32(termC, termC);
    simde_float32x4_t termH_sq = simde_vmulq_f32(termH, termH);
    simde_float32x4_t sum_sq =
        simde_vaddq_f32(simde_vaddq_f32(termL_sq, termC_sq), termH_sq);
    simde_float32x4_t deltaE94 = simde_vsqrtq_f32(sum_sq);

    simde_vst1q_f32(results, deltaE94);
}

#endif

#if HAS_NEON
void CIE94::calculate_neon(const Lab &reference, const Lab *colors,
                           float *results)
{
    const simde_float16_t kL_val = 1.0f;
    const simde_float16_t K1_val = 0.045f;
    const simde_float16_t K2_val = 0.015f;

    simde_float16x8_t v_kL = simde_vdupq_n_f16(kL_val);
    simde_float16x8_t v_K1 = simde_vdupq_n_f16(K1_val);
    simde_float16x8_t v_K2 = simde_vdupq_n_f16(K2_val);

    simde_float16x8_t v_one = simde_vdupq_n_f16(1.0f);
    simde_float16x8_t v_zero = simde_vdupq_n_f16(0.0f);

    simde_float16x8_t ref_L = simde_vdupq_n_f16(reference.L());
    simde_float16x8_t ref_a = simde_vdupq_n_f16(reference.a());
    simde_float16x8_t ref_b = simde_vdupq_n_f16(reference.b());

    simde_float16x8x3_t comp_lab =
        simde_vld3q_f16(reinterpret_cast<const simde_float16_t *>(colors));
    simde_float16x8_t comp_L = comp_lab.val[0];
    simde_float16x8_t comp_a = comp_lab.val[1];
    simde_float16x8_t comp_b = comp_lab.val[2];

    // Compute ΔL* = L₁* - L₂*.
    simde_float16x8_t deltaL = simde_vsubq_f16(ref_L, comp_L);

    // Compute the chroma for the reference color: C₁* = sqrt(a₁*² + b₁*²).
    simde_float16x8_t ref_a_sq = simde_vmulq_f16(ref_a, ref_a);
    simde_float16x8_t ref_b_sq = simde_vmulq_f16(ref_b, ref_b);
    simde_float16x8_t C1_sq = simde_vaddq_f16(ref_a_sq, ref_b_sq);
    simde_float16x8_t C1 = simde_vsqrtq_f16(C1_sq);

    // Compute the chroma for the candidate colors: C₂*.
    simde_float16x8_t comp_a_sq = simde_vmulq_f16(comp_a, comp_a);
    simde_float16x8_t comp_b_sq = simde_vmulq_f16(comp_b, comp_b);
    simde_float16x8_t C2_sq = simde_vaddq_f16(comp_a_sq, comp_b_sq);
    simde_float16x8_t C2 = simde_vsqrtq_f16(C2_sq);

    // Compute ΔC* = C₁* - C₂*.
    simde_float16x8_t deltaC = simde_vsubq_f16(C1, C2);

    // Compute the differences in a and b.
    simde_float16x8_t deltaA = simde_vsubq_f16(ref_a, comp_a);
    simde_float16x8_t deltaB = simde_vsubq_f16(ref_b, comp_b);

    // Compute ΔH² = (Δa² + Δb²) – (ΔC²).
    simde_float16x8_t deltaA_sq = simde_vmulq_f16(deltaA, deltaA);
    simde_float16x8_t deltaB_sq = simde_vmulq_f16(deltaB, deltaB);
    simde_float16x8_t sum_ab_sq = simde_vaddq_f16(deltaA_sq, deltaB_sq);
    simde_float16x8_t deltaC_sq = simde_vmulq_f16(deltaC, deltaC);
    simde_float16x8_t deltaH_sq = simde_vsubq_f16(sum_ab_sq, deltaC_sq);
    // Clamp any potential negative values (due to numerical precision)
    simde_float16x8_t deltaH_sq_clamped = simde_vmaxq_f16(deltaH_sq, v_zero);
    simde_float16x8_t deltaH = simde_vsqrtq_f16(deltaH_sq_clamped);

    // Weighting functions:
    // S_L is always defined as 1.
    simde_float16x8_t S_L = v_one;
    // S_C = 1 + K₁ · C₁*.
    simde_float16x8_t S_C = simde_vfmaq_f16(v_one, C1, v_K1);
    // S_H = 1 + K₂ · C₁*.
    simde_float16x8_t S_H = simde_vfmaq_f16(v_one, C1, v_K2);

    // Compute each term in the ΔE formula.
    // termL = ΔL / (kL · S_L)  [here kL is 1.0]
    simde_float16x8_t termL =
        simde_vdivq_f16(deltaL, simde_vmulq_f16(v_kL, S_L));
    // termC = ΔC / (1 · S_C); note that kC is assumed 1.
    simde_float16x8_t termC = simde_vdivq_f16(deltaC, S_C);
    // termH = ΔH / (1 · S_H); note that kH is assumed 1.
    simde_float16x8_t termH = simde_vdivq_f16(deltaH, S_H);

    // Square the terms.
    simde_float16x8_t termL_sq = simde_vmulq_f16(termL, termL);
    simde_float16x8_t termC_sq = simde_vmulq_f16(termC, termC);
    simde_float16x8_t termH_sq = simde_vmulq_f16(termH, termH);

    // Sum up the squares.
    simde_float16x8_t sum =
        simde_vaddq_f16(simde_vaddq_f16(termL_sq, termC_sq), termH_sq);

    // ΔE₉₄* = sqrt(termL² + termC² + termH²).
    simde_float16x8_t deltaE94 = simde_vsqrtq_f16(sum);

    // Convert the 16-bit results to 32-bit and store eight floats
    // by splitting the 16x8 vector into low and high halves.
    simde_float32x4_t result_low =
        simde_vcvt_f32_f16(simde_vget_low_f16(deltaE94));
    simde_float32x4_t result_high =
        simde_vcvt_f32_f16(simde_vget_high_f16(deltaE94));
    simde_vst1q_f32(results, result_low);
    simde_vst1q_f32(results + 4, result_high);
}
#endif

void CIE94::calculate_avx2(const Lab &reference, const Lab *colors,
                           float *results)
{
    simde__m256 kL = simde_mm256_set1_ps(1.0f);
    simde__m256 K1 = simde_mm256_set1_ps(0.045f);
    simde__m256 K2 = simde_mm256_set1_ps(0.015f);
    simde__m256 one = simde_mm256_set1_ps(1.0f);
    simde__m256 zero = simde_mm256_setzero_ps();

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

    simde__m256 ref_a_sq = simde_mm256_mul_ps(ref_a, ref_a);
    simde__m256 ref_b_sq = simde_mm256_mul_ps(ref_b, ref_b);
    simde__m256 C1_sq = simde_mm256_add_ps(ref_a_sq, ref_b_sq);
    simde__m256 C1 = simde_mm256_sqrt_ps(C1_sq);

    // Compute chroma for the candidate colors: C₂ = sqrt(a₂² + b₂²).
    simde__m256 comp_a_sq = simde_mm256_mul_ps(comp_a, comp_a);
    simde__m256 comp_b_sq = simde_mm256_mul_ps(comp_b, comp_b);
    simde__m256 C2_sq = simde_mm256_add_ps(comp_a_sq, comp_b_sq);
    simde__m256 C2 = simde_mm256_sqrt_ps(C2_sq);

    // Compute ΔC* = C₁ - C₂.
    simde__m256 deltaC = simde_mm256_sub_ps(C1, C2);

    // Compute differences in a and b.
    simde__m256 deltaA = simde_mm256_sub_ps(ref_a, comp_a);
    simde__m256 deltaB = simde_mm256_sub_ps(ref_b, comp_b);

    // Compute ΔH² = (Δa² + Δb²) – (ΔC²).
    simde__m256 deltaA_sq = simde_mm256_mul_ps(deltaA, deltaA);
    simde__m256 deltaB_sq = simde_mm256_mul_ps(deltaB, deltaB);
    simde__m256 sum_ab_sq = simde_mm256_add_ps(deltaA_sq, deltaB_sq);
    simde__m256 deltaC_sq = simde_mm256_mul_ps(deltaC, deltaC);
    simde__m256 deltaH_sq = simde_mm256_sub_ps(sum_ab_sq, deltaC_sq);

    // Clamp any potential negative values due to numerical precision.
    simde__m256 deltaH_sq_clamped = simde_mm256_max_ps(deltaH_sq, zero);

    // ΔH = sqrt(clamped ΔH²).
    simde__m256 deltaH = simde_mm256_sqrt_ps(deltaH_sq_clamped);

    // Weighting functions.
    // S_L is defined as 1.
    simde__m256 S_L = one;
    // S_C = 1 + K₁ · C₁.
    simde__m256 S_C = simde_mm256_fmadd_ps(K1, C1, one);
    // S_H = 1 + K₂ · C₁.
    simde__m256 S_H = simde_mm256_fmadd_ps(K2, C1, one);

    // Compute each term.
    // termL = ΔL / (kL · S_L). (Since kL is 1 and S_L is 1, termL equals ΔL.)
    simde__m256 termL = simde_mm256_div_ps(deltaL, simde_mm256_mul_ps(kL, S_L));
    // termC = ΔC / S_C.
    simde__m256 termC = simde_mm256_div_ps(deltaC, S_C);
    // termH = ΔH / S_H.
    simde__m256 termH = simde_mm256_div_ps(deltaH, S_H);

    // Square the terms.
    simde__m256 termL_sq = simde_mm256_mul_ps(termL, termL);
    simde__m256 termC_sq = simde_mm256_mul_ps(termC, termC);
    simde__m256 termH_sq = simde_mm256_mul_ps(termH, termH);

    // Sum the squares.
    simde__m256 sum_sq =
        simde_mm256_add_ps(simde_mm256_add_ps(termL_sq, termC_sq), termH_sq);

    // ΔE₉₄ = sqrt(termL² + termC² + termH²).
    simde__m256 deltaE94 = simde_mm256_sqrt_ps(sum_sq);

    simde_mm256_storeu_ps(results, deltaE94);
}
