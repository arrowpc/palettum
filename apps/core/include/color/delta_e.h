#pragma once
#include <simde/arm/neon.h>
#include <simde/x86/avx2.h>
#include <vector>
#include "color/lab.h"
#include "color/simd_detect.h"
#include "math.hpp"

namespace delta {

struct CIE76 {
    static constexpr int id = 0;
    static const char *name()
    {
        return "CIE76";
    }

    static float calculate(const Lab &color1, const Lab &color2);
    static std::vector<float> calculate(const Lab &reference,
                                        const std::vector<Lab> &colors);
};

struct CIE94 {
    static constexpr int id = 1;
    static const char *name()
    {
        return "CIE94";
    }

    static float calculate(const Lab &color1, const Lab &color2);
    static std::vector<float> calculate(const Lab &reference,
                                        const std::vector<Lab> &colors);
};

struct CIEDE2000 {
    static constexpr int id = 2;
    static const char *name()
    {
        return "CIEDE2000";
    }

    static float calculate(const Lab &color1, const Lab &color2);
    static std::vector<float> calculate(const Lab &reference,
                                        const std::vector<Lab> &colors);

    // Architecture-specific batch implementations
    static std::vector<float> calculate_scalar(const Lab &reference,
                                               const std::vector<Lab> &colors);

    static void calculate_neon_batch(const Lab &reference, const Lab *colors,
                                     float *results);
    static std::vector<float> calculate_neon(const Lab &reference,
                                             const std::vector<Lab> &colors);

    static std::vector<float> calculate_avx2(const Lab &reference,
                                             const std::vector<Lab> &colors);
    static void calculate_avx2_batch(const Lab &reference, const Lab *colors,
                                     float *results);
};

}  // namespace delta

template <typename FormulaT = delta::CIEDE2000>
float deltaE(const Lab &color1, const Lab &color2)
{
    return FormulaT::calculate(color1, color2);
}

template <typename FormulaT = delta::CIEDE2000>
std::vector<float> deltaE(const Lab &reference, const std::vector<Lab> &colors)
{
    return FormulaT::calculate(reference, colors);
}

template <typename FormulaT = delta::CIEDE2000>
std::vector<float> deltaE(const Lab &reference, const std::vector<Lab> &colors,
                          simd::Architecture arch)
{
    if constexpr (std::is_same_v<FormulaT, delta::CIEDE2000>)
    {
        switch (arch)
        {
            case simd::Architecture::NEON:
                return delta::CIEDE2000::calculate_neon(reference, colors);
            case simd::Architecture::AVX2:
                return delta::CIEDE2000::calculate_avx2(reference, colors);
            case simd::Architecture::SCALAR:
            default:
                return delta::CIEDE2000::calculate_scalar(reference, colors);
        }
    }
    else
    {
        return FormulaT::calculate(reference, colors);
    }
}

template <simd::Architecture Arch, typename FormulaT = delta::CIEDE2000>
std::vector<float> deltaE(const Lab &reference, const std::vector<Lab> &colors)
{
    if constexpr (std::is_same_v<FormulaT, delta::CIEDE2000>)
    {
        if constexpr (Arch == simd::Architecture::NEON)
        {
            return delta::CIEDE2000::calculate_neon(reference, colors);
        }
        else if constexpr (Arch == simd::Architecture::AVX2)
        {
            return delta::CIEDE2000::calculate_avx2(reference, colors);
        }
        else
        {
            return delta::CIEDE2000::calculate_scalar(reference, colors);
        }
    }
    else
    {
        return FormulaT::calculate(reference, colors);
    }
}
