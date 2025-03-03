#pragma once
#include <simde/arm/neon.h>
#include <simde/x86/avx2.h>
#include <algorithm>
#include <iostream>
#include "color/rgb.h"

#if defined(SIMDE_ARCH_X86_AVX2)
#    define HAS_AVX2 1
#else
#    define HAS_AVX2 0
#endif

#if defined(SIMDE_ARCH_ARM_NEON)
#    define HAS_NEON 1
#else
#    define HAS_NEON 0
#endif
// --------------------------------
#if HAS_NEON
using lab_float_t = simde_float16_t;
#else
using lab_float_t = float;
#endif

class RGB;

class Lab
{
public:
    explicit Lab(lab_float_t L = 0, lab_float_t a = 0,
                 lab_float_t b = 0) noexcept;
    [[nodiscard]] RGB toRGB() const noexcept;
    [[nodiscard]] lab_float_t L() const noexcept;
    [[nodiscard]] lab_float_t a() const noexcept;
    [[nodiscard]] lab_float_t b() const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const Lab &lab);

private:
    lab_float_t m_L, m_a, m_b;
};
