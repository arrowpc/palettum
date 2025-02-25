#pragma once

#include <simde/arm/neon.h>
#include <simde/arm/neon/reinterpret.h>
#include <simde/arm/neon/types.h>
#include <simde/x86/avx2.h>
#include <cmath>

#ifndef M_PI
#    define M_PI 3.14159265358979323846264338327950288
#endif

const float pow25_7 = 6103515625.0f;
float const RAD_TO_DEG = 180.0f / M_PI;
float const HALF_DEG_TO_RAD = M_PI / 360.0f;
float const DEG_TO_RAD = M_PI / 180.0f;

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
                static const float inv_6 = 0.166666667f;
                simde_float32x4_t x2 = simde_vmulq_f32(x, x);
                return simde_vmulq_f32(
                    x, simde_vsubq_f32(simde_vdupq_n_f32(1.0f),
                                       simde_vmulq_n_f32(x2, inv_6)));
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
                const simde_float32x4_t pi_4 = simde_vdupq_n_f32(M_PI_4);
                const simde_float32x4_t c1 = simde_vdupq_n_f32(0.2447f);
                const simde_float32x4_t c2 = simde_vdupq_n_f32(0.0663f);
                const simde_float32x4_t one = simde_vdupq_n_f32(1.0f);

                simde_float32x4_t abs_x = simde_vabsq_f32(x);        // |x|
                simde_float32x4_t term1 = simde_vmulq_f32(pi_4, x);  // π/4 * x
                simde_float32x4_t term2 =
                    simde_vsubq_f32(abs_x, one);  // |x| - 1
                simde_float32x4_t term3 = simde_vaddq_f32(
                    c1, simde_vmulq_f32(c2, abs_x));  // 0.2447 + 0.0663 * |x|
                simde_float32x4_t result = simde_vsubq_f32(
                    term1,
                    simde_vmulq_f32(
                        x,
                        simde_vmulq_f32(
                            term2,
                            term3)));  // π/4 * x - x * (|x| - 1) * (0.2447 + 0.0663 * |x|)

                return result;
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

    static inline simde_float16x8_t sin(simde_float16x8_t x)
    {
        switch (P)
        {
            case precision::high: {
                simde_float16 vals[8];
                simde_vst1q_f16(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::sin(vals[i]);
                }
                return simde_vld1q_f16(vals);
            }
            case precision::low: {
                static const simde_float16 inv_6 =
                    0.1667f;  // Reduced precision for fp16
                simde_float16x8_t x2 = simde_vmulq_f16(x, x);
                simde_float16x8_t term = simde_vmulq_n_f16(x2, inv_6);
                return simde_vmulq_f16(
                    x, simde_vsubq_f16(simde_vdupq_n_f16(1.0f), term));
            }
            default:
                return simde_vdupq_n_f16(0.0f);
        }
    }

    static inline simde_float16x8_t cos(simde_float16x8_t x)
    {
        switch (P)
        {
            case precision::high: {
                simde_float16 vals[8];
                simde_vst1q_f16(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::cos(vals[i]);
                }
                return simde_vld1q_f16(vals);
            }
            case precision::low: {
                const simde_float16x8_t tp =
                    simde_vdupq_n_f16(0.1592f);  // 1/(2*PI) in fp16
                const simde_float16x8_t quarter = simde_vdupq_n_f16(0.25f);
                const simde_float16x8_t sixteen = simde_vdupq_n_f16(16.0f);
                const simde_float16x8_t half = simde_vdupq_n_f16(0.5f);

                x = simde_vmulq_f16(x, tp);
                simde_float16x8_t x_plus_quarter = simde_vaddq_f16(x, quarter);
                simde_float16x8_t floor_val = simde_vrndmq_f16(x_plus_quarter);
                simde_float16x8_t temp = simde_vaddq_f16(quarter, floor_val);
                x = simde_vsubq_f16(x, temp);
                simde_float16x8_t abs_x = simde_vabsq_f16(x);
                simde_float16x8_t abs_x_minus_half =
                    simde_vsubq_f16(abs_x, half);
                simde_float16x8_t factor =
                    simde_vmulq_f16(sixteen, abs_x_minus_half);

                return simde_vmulq_f16(x, factor);
            }
            default:
                return simde_vdupq_n_f16(0.0f);
        }
    }

    static inline simde_float16x8_t exp(simde_float16x8_t x)
    {
        switch (P)
        {
            case precision::high: {
                simde_float16 vals[8];
                simde_vst1q_f16(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::exp(vals[i]);
                }
                return simde_vld1q_f16(vals);
            }
            case precision::low: {
                simde_float32x4_t x_low =
                    simde_vcvt_f32_f16(simde_vget_low_f16(x));
                simde_float32x4_t x_high =
                    simde_vcvt_f32_f16(simde_vget_high_f16(x));

                simde_float32x4_t a = simde_vdupq_n_f32(12102203.0f);
                simde_int32x4_t b = simde_vdupq_n_s32(127 * (1 << 23) - 298765);

                simde_int32x4_t t_low = simde_vaddq_s32(
                    simde_vcvtq_s32_f32(simde_vmulq_f32(a, x_low)), b);
                simde_int32x4_t t_high = simde_vaddq_s32(
                    simde_vcvtq_s32_f32(simde_vmulq_f32(a, x_high)), b);

                simde_float32x4_t result_low =
                    simde_vreinterpretq_f32_s32(t_low);
                simde_float32x4_t result_high =
                    simde_vreinterpretq_f32_s32(t_high);

                return simde_vcombine_f16(simde_vcvt_f16_f32(result_low),
                                          simde_vcvt_f16_f32(result_high));
            }
            default:
                return simde_vdupq_n_f16(0.0f);
        }
    }

    static inline simde_float16x8_t atan(simde_float16x8_t x)
    {
        switch (P)
        {
            case precision::high: {
                simde_float16 vals[8];
                simde_vst1q_f16(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::atan(vals[i]);
                }
                return simde_vld1q_f16(vals);
            }
            case precision::low: {
                const simde_float16x8_t pi_4 =
                    simde_vdupq_n_f16(0.7854f);  // π/4 in fp16
                const simde_float16x8_t c1 = simde_vdupq_n_f16(0.2447f);
                const simde_float16x8_t c2 = simde_vdupq_n_f16(0.0663f);
                const simde_float16x8_t one = simde_vdupq_n_f16(1.0f);

                simde_float16x8_t abs_x = simde_vabsq_f16(x);        // |x|
                simde_float16x8_t term1 = simde_vmulq_f16(pi_4, x);  // π/4 * x
                simde_float16x8_t term2 =
                    simde_vsubq_f16(abs_x, one);  // |x| - 1
                simde_float16x8_t term3 = simde_vaddq_f16(
                    c1, simde_vmulq_f16(c2, abs_x));  // 0.2447 + 0.0663 * |x|
                simde_float16x8_t temp = simde_vmulq_f16(term2, term3);
                simde_float16x8_t result = simde_vsubq_f16(
                    term1,
                    simde_vmulq_f16(
                        x,
                        temp));  // π/4 * x - x * (|x| - 1) * (0.2447 + 0.0663 * |x|)

                return result;
            }
            default:
                return simde_vdupq_n_f16(0.0f);
        }
    }

    // Heavily inspired from {https://mazzo.li/posts/vectorized-atan2.html,
    // https://gist.github.com/bitonic/d0f5a0a44e37d4f0be03d34d47acb6cf}
    // Great read !
    static inline simde_float16x8_t atan2(simde_float16x8_t y,
                                          simde_float16x8_t x)
    {
        switch (P)
        {
            case precision::high: {
                simde_float16 y_vals[8], x_vals[8];
                simde_vst1q_f16(y_vals, y);
                simde_vst1q_f16(x_vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    y_vals[i] = math<P>::atan2(y_vals[i], x_vals[i]);
                }
                return simde_vld1q_f16(y_vals);
            }
            case precision::low: {
                const simde_float16x8_t pi = simde_vdupq_n_f16(3.1416f);
                const simde_float16x8_t pi_2 = simde_vdupq_n_f16(1.5708f);
                const simde_float16x8_t epsilon =
                    simde_vdupq_n_f16(0.0001f);  // Adjusted for fp16
                const simde_float16x8_t zero = simde_vdupq_n_f16(0.0f);

                // Create masks for absolute value and sign bit
                const simde_uint16x8_t abs_mask = simde_vdupq_n_u16(0x7FFF);
                const simde_uint16x8_t sign_mask = simde_vdupq_n_u16(0x8000);

                // Get absolute values
                simde_uint16x8_t y_bits = simde_vreinterpretq_u16_f16(y);
                simde_uint16x8_t x_bits = simde_vreinterpretq_u16_f16(x);
                simde_uint16x8_t abs_y_bits = simde_vandq_u16(y_bits, abs_mask);
                simde_uint16x8_t abs_x_bits = simde_vandq_u16(x_bits, abs_mask);
                simde_float16x8_t abs_y =
                    simde_vreinterpretq_f16_u16(abs_y_bits);
                simde_float16x8_t abs_x =
                    simde_vreinterpretq_f16_u16(abs_x_bits);

                // Check for zero or near-zero cases
                simde_uint16x8_t x_near_zero = simde_vcltq_f16(abs_x, epsilon);
                simde_uint16x8_t y_near_zero = simde_vcltq_f16(abs_y, epsilon);

                // Handle special cases
                simde_uint16x8_t both_near_zero =
                    simde_vandq_u16(x_near_zero, y_near_zero);
                simde_uint16x8_t x_zero_mask =
                    simde_vandq_u16(x_near_zero, simde_vmvnq_u16(y_near_zero));

                // Compute regular atan2 for non-special cases
                simde_uint16x8_t swap_mask = simde_vcgtq_f16(abs_y, abs_x);
                simde_float16x8_t num = simde_vbslq_f16(swap_mask, x, y);
                simde_float16x8_t den = simde_vbslq_f16(swap_mask, y, x);

                // Add epsilon to denominator to avoid division by zero
                simde_float16x8_t epsilon_term = simde_vandq_u16(
                    simde_vreinterpretq_u16_f16(epsilon), x_near_zero);
                den = simde_vaddq_f16(
                    den, simde_vreinterpretq_f16_u16(epsilon_term));

                simde_float16x8_t atan_input = simde_vdivq_f16(num, den);
                simde_float16x8_t result = math<P>::atan(atan_input);

                // Adjust result if we swapped inputs
                simde_uint16x8_t atan_input_bits =
                    simde_vreinterpretq_u16_f16(atan_input);
                simde_uint16x8_t pi_2_sign_bits =
                    simde_vandq_u16(atan_input_bits, sign_mask);
                simde_float16x8_t pi_2_adj =
                    simde_vreinterpretq_f16_u16(simde_vorrq_u16(
                        simde_vreinterpretq_u16_f16(pi_2), pi_2_sign_bits));

                simde_float16x8_t swap_result =
                    simde_vsubq_f16(pi_2_adj, result);
                result = simde_vbslq_f16(swap_mask, swap_result, result);

                // Handle x = 0 cases
                simde_float16x8_t y_sign = simde_vreinterpretq_f16_u16(
                    simde_vandq_u16(y_bits, sign_mask));
                simde_float16x8_t x_zero_result =
                    simde_vbslq_f16(simde_vreinterpretq_u16_f16(y_sign),
                                    simde_vnegq_f16(pi_2), pi_2);

                // Adjust for quadrant based on signs of x and y
                simde_uint16x8_t x_sign_mask = simde_vcltq_f16(x, zero);
                simde_uint16x8_t y_sign_bits =
                    simde_vandq_u16(simde_vreinterpretq_u16_f16(y), sign_mask);
                simde_float16x8_t pi_adj =
                    simde_vreinterpretq_f16_u16(simde_veorq_u16(
                        simde_vreinterpretq_u16_f16(pi), y_sign_bits));
                simde_float16x8_t quad_adj =
                    simde_vreinterpretq_f16_u16(simde_vandq_u16(
                        simde_vreinterpretq_u16_f16(pi_adj), x_sign_mask));

                result = simde_vaddq_f16(quad_adj, result);

                // Select between special cases and regular result
                result = simde_vbslq_f16(x_zero_mask, x_zero_result, result);
                result = simde_vbslq_f16(both_near_zero, zero, result);

                return result;
            }
            default:
                return simde_vdupq_n_f16(0.0f);
        }
    }

    static inline simde__m256 sin(simde__m256 x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[8];
                simde_mm256_storeu_ps(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::sin(vals[i]);
                }
                return simde_mm256_loadu_ps(vals);
            }
            case precision::low: {
                static const float inv_6 = 0.1667f;
                simde__m256 x2 = simde_mm256_mul_ps(x, x);
                simde__m256 term =
                    simde_mm256_mul_ps(x2, simde_mm256_set1_ps(inv_6));
                return simde_mm256_mul_ps(
                    x, simde_mm256_sub_ps(simde_mm256_set1_ps(1.0f), term));
            }
            default:
                return simde_mm256_setzero_ps();
        }
    }

    static inline simde__m256 cos(simde__m256 x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[8];
                simde_mm256_storeu_ps(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::cos(vals[i]);
                }
                return simde_mm256_loadu_ps(vals);
            }
            case precision::low: {
                const simde__m256 tp =
                    simde_mm256_set1_ps(0.1592f);  // 1/(2*PI) in fp32
                const simde__m256 quarter = simde_mm256_set1_ps(0.25f);
                const simde__m256 sixteen = simde_mm256_set1_ps(16.0f);
                const simde__m256 half = simde_mm256_set1_ps(0.5f);

                simde__m256 x_mul = simde_mm256_mul_ps(x, tp);
                simde__m256 x_plus_quarter = simde_mm256_add_ps(x_mul, quarter);
                simde__m256 floor_val = simde_mm256_floor_ps(x_plus_quarter);
                simde__m256 temp = simde_mm256_add_ps(quarter, floor_val);
                x = simde_mm256_sub_ps(x_mul, temp);
                simde__m256 abs_x =
                    simde_mm256_andnot_ps(simde_mm256_set1_ps(-0.0f), x);
                simde__m256 abs_x_minus_half = simde_mm256_sub_ps(abs_x, half);
                simde__m256 factor =
                    simde_mm256_mul_ps(sixteen, abs_x_minus_half);

                return simde_mm256_mul_ps(x, factor);
            }
            default:
                return simde_mm256_setzero_ps();
        }
    }

    static inline simde__m256 exp(simde__m256 x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[8];
                simde_mm256_storeu_ps(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::exp(vals[i]);
                }
                return simde_mm256_loadu_ps(vals);
            }
            case precision::low: {
                simde__m256 a = simde_mm256_set1_ps(12102203.0f);
                simde__m256i b =
                    simde_mm256_set1_epi32(127 * (1 << 23) - 298765);

                simde__m256 ax = simde_mm256_mul_ps(a, x);
                simde__m256i t =
                    simde_mm256_add_epi32(simde_mm256_cvtps_epi32(ax), b);

                return simde_mm256_castsi256_ps(t);
            }
            default:
                return simde_mm256_setzero_ps();
        }
    }

    static inline simde__m256 atan(simde__m256 x)
    {
        switch (P)
        {
            case precision::high: {
                float vals[8];
                simde_mm256_storeu_ps(vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    vals[i] = math<P>::atan(vals[i]);
                }
                return simde_mm256_loadu_ps(vals);
            }
            case precision::low: {
                const simde__m256 pi_4 =
                    simde_mm256_set1_ps(0.7854f);  // π/4 in fp32
                const simde__m256 c1 = simde_mm256_set1_ps(0.2447f);
                const simde__m256 c2 = simde_mm256_set1_ps(0.0663f);
                const simde__m256 one = simde_mm256_set1_ps(1.0f);

                simde__m256 abs_x = simde_mm256_andnot_ps(
                    simde_mm256_set1_ps(-0.0f), x);                  // |x|
                simde__m256 term1 = simde_mm256_mul_ps(pi_4, x);     // π/4 * x
                simde__m256 term2 = simde_mm256_sub_ps(abs_x, one);  // |x| - 1
                simde__m256 term3 = simde_mm256_add_ps(
                    c1,
                    simde_mm256_mul_ps(c2, abs_x));  // 0.2447 + 0.0663 * |x|
                simde__m256 temp = simde_mm256_mul_ps(term2, term3);
                simde__m256 result = simde_mm256_sub_ps(
                    term1,
                    simde_mm256_mul_ps(
                        x,
                        temp));  // π/4 * x - x * (|x| - 1) * (0.2447 + 0.0663 * |x|)

                return result;
            }
            default:
                return simde_mm256_setzero_ps();
        }
    }

    static inline simde__m256 atan2(simde__m256 y, simde__m256 x)
    {
        switch (P)
        {
            case precision::high: {
                float y_vals[8], x_vals[8];
                simde_mm256_storeu_ps(y_vals, y);
                simde_mm256_storeu_ps(x_vals, x);
                for (int i = 0; i < 8; ++i)
                {
                    y_vals[i] = math<P>::atan2(y_vals[i], x_vals[i]);
                }
                return simde_mm256_loadu_ps(y_vals);
            }
            case precision::low: {
                const simde__m256 pi = simde_mm256_set1_ps(3.1416f);
                const simde__m256 pi_2 = simde_mm256_set1_ps(1.5708f);
                const simde__m256 epsilon = simde_mm256_set1_ps(0.0001f);
                const simde__m256 zero = simde_mm256_setzero_ps();

                // Get absolute values
                simde__m256 abs_y =
                    simde_mm256_andnot_ps(simde_mm256_set1_ps(-0.0f), y);
                simde__m256 abs_x =
                    simde_mm256_andnot_ps(simde_mm256_set1_ps(-0.0f), x);

                // Check for zero or near-zero cases
                simde__m256 x_near_zero =
                    simde_mm256_cmp_ps(abs_x, epsilon, SIMDE_CMP_LT_OQ);
                simde__m256 y_near_zero =
                    simde_mm256_cmp_ps(abs_y, epsilon, SIMDE_CMP_LT_OQ);

                // Handle special cases
                simde__m256 both_near_zero =
                    simde_mm256_and_ps(x_near_zero, y_near_zero);
                simde__m256 x_zero_mask =
                    simde_mm256_andnot_ps(y_near_zero, x_near_zero);

                // Compute regular atan2 for non-special cases
                simde__m256 swap_mask =
                    simde_mm256_cmp_ps(abs_y, abs_x, SIMDE_CMP_GT_OQ);
                simde__m256 num = simde_mm256_blendv_ps(y, x, swap_mask);
                simde__m256 den = simde_mm256_blendv_ps(x, y, swap_mask);

                // Add epsilon to denominator to avoid division by zero
                simde__m256 epsilon_term =
                    simde_mm256_and_ps(epsilon, x_near_zero);
                den = simde_mm256_add_ps(den, epsilon_term);

                simde__m256 atan_input = simde_mm256_div_ps(num, den);
                simde__m256 result = math<P>::atan(atan_input);

                // Adjust result if we swapped inputs
                simde__m256 sign_mask =
                    simde_mm256_and_ps(atan_input, simde_mm256_set1_ps(-0.0f));
                simde__m256 pi_2_adj = simde_mm256_or_ps(pi_2, sign_mask);
                simde__m256 swap_result = simde_mm256_sub_ps(pi_2_adj, result);
                result = simde_mm256_blendv_ps(result, swap_result, swap_mask);

                // Handle x = 0 cases
                simde__m256 y_sign =
                    simde_mm256_and_ps(y, simde_mm256_set1_ps(-0.0f));
                simde__m256 neg_pi_2 =
                    simde_mm256_xor_ps(pi_2, simde_mm256_set1_ps(-0.0f));
                simde__m256 x_zero_result = simde_mm256_blendv_ps(
                    pi_2, neg_pi_2,
                    simde_mm256_cmp_ps(y, zero, SIMDE_CMP_LT_OQ));

                // Adjust for quadrant based on signs of x and y
                simde__m256 x_sign_mask =
                    simde_mm256_cmp_ps(x, zero, SIMDE_CMP_LT_OQ);
                simde__m256 y_sign_bits =
                    simde_mm256_and_ps(y, simde_mm256_set1_ps(-0.0f));
                simde__m256 pi_adj = simde_mm256_xor_ps(pi, y_sign_bits);
                simde__m256 quad_adj = simde_mm256_and_ps(pi_adj, x_sign_mask);

                result = simde_mm256_add_ps(quad_adj, result);

                // Select between special cases and regular result
                result =
                    simde_mm256_blendv_ps(result, x_zero_result, x_zero_mask);
                result = simde_mm256_blendv_ps(result, zero, both_near_zero);

                return result;
            }
            default:
                return simde_mm256_setzero_ps();
        }
    }
};
