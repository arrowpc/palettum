#pragma once
#include <color/rgb.h>
#include <simde/arm/neon.h>
#include <simde/x86/avx2.h>
#include <algorithm>
#include <iostream>

class RGB;

class Lab
{
public:
    explicit Lab(simde_float16_t L = 0, simde_float16_t a = 0,
                 simde_float16_t b = 0) noexcept;
    [[nodiscard]] RGB toRGB() const noexcept;
    [[nodiscard]] simde_float16_t L() const noexcept;
    [[nodiscard]] simde_float16_t a() const noexcept;
    [[nodiscard]] simde_float16_t b() const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const Lab &lab);

private:
    simde_float16_t m_L, m_a, m_b;
};
