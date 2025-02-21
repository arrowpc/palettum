#pragma once

#include <simde/arm/neon.h>
#include <simde/arm/neon/types.h>
#include <cmath>

enum class precision { high, low };
constexpr precision default_precision = precision::low;

template <precision P = default_precision>
struct math {
    static inline float sin(float x)
    {
        switch (P)
        {
            case precision::high:
                return std::sin(x);
            case precision::low:
                return std::sin(x);
            default:
                return std::sin(x);
        }
    }

    static inline float cos(float x)
    {
        switch (P)
        {
            case precision::high:
                return std::cos(x);
            case precision::low:
                return std::cos(x);
            default:
                return std::cos(x);
        }
    }

    static inline float exp(float x)
    {
        switch (P)
        {
            case precision::high:
                return std::exp(x);
            case precision::low:
                return std::exp(x);
            default:
                return std::exp(x);
        }
    }

    static inline float atan(float x)
    {
        switch (P)
        {
            case precision::high:
                return std::atan(x);
            case precision::low:
                return std::atan(x);
            default:
                return std::atan(x);
        }
    }

    static inline float atan2(float y, float x)
    {
        switch (P)
        {
            case precision::high:
                return std::atan2(y, x);
            case precision::low:
                return std::atan2(y, x);
            default:
                return std::atan2(y, x);
        }
    }

    static inline simde_float32x4_t sin(simde_float32x4_t x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[4];
                simde_vst1q_f32(vals, x);
                for (int i = 0; i < 4; ++i)
                {
                    vals[i] = math<P>::sin(vals[i]);
                }
                return simde_vld1q_f32(vals);
            }
            case precision::low: {
                simde_float32x4_t x2 = simde_vmulq_f32(x, x);
                simde_float32x4_t term = simde_vmulq_n_f32(x2, 1.0f / 6.0f);
                simde_float32x4_t factor =
                    simde_vsubq_f32(simde_vdupq_n_f32(1.0f), term);
                return simde_vmulq_f32(x, factor);
            }
            default:
                return simde_vdupq_n_f32(0.0f);
        }
    }

    static inline simde_float32x4_t cos(simde_float32x4_t x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[4];
                simde_vst1q_f32(vals, x);
                for (int i = 0; i < 4; ++i)
                {
                    vals[i] = math<P>::cos(vals[i]);
                }
                return simde_vld1q_f32(vals);
            }
            case precision::low: {
                const simde_float32x4_t tp =
                    simde_vdupq_n_f32(1.0f / (2.0f * M_PI));
                const simde_float32x4_t quarter = simde_vdupq_n_f32(0.25f);
                const simde_float32x4_t sixteen = simde_vdupq_n_f32(16.0f);
                const simde_float32x4_t half = simde_vdupq_n_f32(0.5f);

                x = simde_vmulq_f32(x, tp);
                simde_float32x4_t x_plus_quarter = simde_vaddq_f32(x, quarter);
                simde_float32x4_t floor_val = simde_vrndmq_f32(x_plus_quarter);
                x = simde_vsubq_f32(x, simde_vaddq_f32(quarter, floor_val));
                simde_float32x4_t abs_x = simde_vabsq_f32(x);
                simde_float32x4_t abs_x_minus_half =
                    simde_vsubq_f32(abs_x, half);
                simde_float32x4_t factor =
                    simde_vmulq_f32(sixteen, abs_x_minus_half);

                return simde_vmulq_f32(x, factor);
            }
            default:
                return simde_vdupq_n_f32(0.0f);
        }
    }

    static inline simde_float32x4_t exp(simde_float32x4_t x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[4];
                simde_vst1q_f32(vals, x);
                for (int i = 0; i < 4; ++i)
                {
                    vals[i] = math<P>::exp(vals[i]);
                }
                return simde_vld1q_f32(vals);
            }
            case precision::low: {
                simde_float32x4_t a =
                    simde_vdupq_n_f32(12102203.0f);  // (1 << 23) / log(2)
                simde_int32x4_t b = simde_vdupq_n_s32(127 * (1 << 23) - 298765);

                simde_int32x4_t t = simde_vaddq_s32(
                    simde_vcvtq_s32_f32(simde_vmulq_f32(a, x)), b);

                return simde_vreinterpretq_f32_s32(t);
            }
            default:
                return simde_vdupq_n_f32(0.0f);
        }
    }

    static inline simde_float32x4_t atan(simde_float32x4_t x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[4];
                simde_vst1q_f32(vals, x);
                for (int i = 0; i < 4; ++i)
                {
                    vals[i] = math<P>::atan(vals[i]);
                }
                return simde_vld1q_f32(vals);
            }
            case precision::low: {
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
            default:
                return simde_vdupq_n_f32(0.0f);
        }
    }

    // Heavily inspired from {https://mazzo.li/posts/vectorized-atan2.html,
    // https://gist.github.com/bitonic/d0f5a0a44e37d4f0be03d34d47acb6cf}
    // Great read !
    static inline simde_float32x4_t atan2(simde_float32x4_t y,
                                          simde_float32x4_t x)
    {
        switch (P)
        {
            case precision::high: {
                float y_vals[4], x_vals[4];
                simde_vst1q_f32(y_vals, y);
                simde_vst1q_f32(x_vals, x);
                for (int i = 0; i < 4; ++i)
                {
                    y_vals[i] = math<P>::atan2(y_vals[i], x_vals[i]);
                }
                return simde_vld1q_f32(y_vals);
            }
            case precision::low: {
                const simde_float32x4_t pi = simde_vdupq_n_f32(M_PI);
                const simde_float32x4_t pi_2 = simde_vdupq_n_f32(M_PI_2);
                const simde_float32x4_t epsilon = simde_vdupq_n_f32(1e-6f);
                const simde_float32x4_t zero = simde_vdupq_n_f32(0.0f);

                // Create masks for absolute value and sign bit
                const simde_uint32x4_t abs_mask = simde_vdupq_n_u32(0x7FFFFFFF);
                const simde_uint32x4_t sign_mask =
                    simde_vdupq_n_u32(0x80000000);

                // Get absolute values
                simde_uint32x4_t y_bits = simde_vreinterpretq_u32_f32(y);
                simde_uint32x4_t x_bits = simde_vreinterpretq_u32_f32(x);
                simde_uint32x4_t abs_y_bits = simde_vandq_u32(y_bits, abs_mask);
                simde_uint32x4_t abs_x_bits = simde_vandq_u32(x_bits, abs_mask);
                simde_float32x4_t abs_y =
                    simde_vreinterpretq_f32_u32(abs_y_bits);
                simde_float32x4_t abs_x =
                    simde_vreinterpretq_f32_u32(abs_x_bits);

                // Check for zero or near-zero cases
                simde_uint32x4_t x_near_zero = simde_vcltq_f32(abs_x, epsilon);
                simde_uint32x4_t y_near_zero = simde_vcltq_f32(abs_y, epsilon);

                // Handle special cases
                simde_uint32x4_t both_near_zero =
                    simde_vandq_u32(x_near_zero, y_near_zero);
                simde_uint32x4_t x_zero_mask =
                    simde_vandq_u32(x_near_zero, simde_vmvnq_u32(y_near_zero));

                // Compute regular atan2 for non-special cases
                simde_uint32x4_t swap_mask = simde_vcgtq_f32(abs_y, abs_x);
                simde_float32x4_t num = simde_vbslq_f32(swap_mask, x, y);
                simde_float32x4_t den = simde_vbslq_f32(swap_mask, y, x);

                // Add epsilon to denominator to avoid division by zero
                den = simde_vaddq_f32(
                    den,
                    simde_vreinterpretq_f32_u32(simde_vandq_u32(
                        simde_vreinterpretq_u32_f32(epsilon), x_near_zero)));

                simde_float32x4_t atan_input = simde_vdivq_f32(num, den);
                simde_float32x4_t result = math<P>::atan(atan_input);

                // Adjust result if we swapped inputs
                simde_uint32x4_t atan_input_bits =
                    simde_vreinterpretq_u32_f32(atan_input);
                simde_uint32x4_t pi_2_sign_bits =
                    simde_vandq_u32(atan_input_bits, sign_mask);
                simde_float32x4_t pi_2_adj =
                    simde_vreinterpretq_f32_u32(simde_vorrq_u32(
                        simde_vreinterpretq_u32_f32(pi_2), pi_2_sign_bits));

                simde_float32x4_t swap_result =
                    simde_vsubq_f32(pi_2_adj, result);
                result = simde_vbslq_f32(swap_mask, swap_result, result);

                // Handle x = 0 cases
                simde_float32x4_t y_sign = simde_vreinterpretq_f32_u32(
                    simde_vandq_u32(y_bits, sign_mask));
                simde_float32x4_t x_zero_result =
                    simde_vbslq_f32(simde_vreinterpretq_u32_f32(y_sign),
                                    simde_vnegq_f32(pi_2), pi_2);

                // Adjust for quadrant based on signs of x and y
                simde_uint32x4_t x_sign_mask = simde_vcltq_f32(x, zero);
                simde_uint32x4_t y_sign_bits =
                    simde_vandq_u32(simde_vreinterpretq_u32_f32(y), sign_mask);
                simde_float32x4_t pi_adj =
                    simde_vreinterpretq_f32_u32(simde_veorq_u32(
                        simde_vreinterpretq_u32_f32(pi), y_sign_bits));
                simde_float32x4_t quad_adj =
                    simde_vreinterpretq_f32_u32(simde_vandq_u32(
                        simde_vreinterpretq_u32_f32(pi_adj), x_sign_mask));

                result = simde_vaddq_f32(quad_adj, result);

                // Select between special cases and regular result
                result = simde_vbslq_f32(x_zero_mask, x_zero_result, result);
                result = simde_vbslq_f32(both_near_zero, zero, result);

                return result;
            }
            default:
                return simde_vdupq_n_f32(0.0f);
        }
    }
};
