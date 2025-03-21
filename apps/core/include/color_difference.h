#pragma once

#include <simde/arm/neon.h>
#include <simde/x86/avx2.h>
#include <simde/x86/fma.h>
#include <vector>
#include "color/lab.h"
#include "simd_math.h"

enum class Architecture { SCALAR, NEON, AVX2 };

#if HAS_NEON
constexpr Architecture DEFAULT_ARCH = Architecture::NEON;
#elif HAS_AVX2
constexpr Architecture DEFAULT_ARCH = Architecture::AVX2;
#else
constexpr Architecture DEFAULT_ARCH = Architecture::SCALAR;
#endif

enum class Formula { CIE76, CIE94, CIEDE2000 };
constexpr Formula DEFAULT_FORMULA = Formula::CIEDE2000;

constexpr int get_lane_width(Architecture arch)
{
    switch (arch)
    {
        case Architecture::NEON:
#if HAS_NEON
            return 8;
#else
            return 4;
#endif
        case Architecture::AVX2:
            return 8;
        case Architecture::SCALAR:
        default:
            return 1;
    }
}

// Forward declarations for formula structs
struct CIE76;
struct CIE94;
struct CIEDE2000;

// Generic batch processing function
template <typename FormulaT, Architecture Arch, typename BatchFn>
std::vector<float> process(const Lab &reference, const std::vector<Lab> &colors,
                           BatchFn batch_fn, size_t lane_width)
{
    const size_t numFullChunks = colors.size() / lane_width;
    const size_t remainder = colors.size() % lane_width;
    std::vector<float> results(colors.size());

    for (size_t i = 0; i < numFullChunks; ++i)
    {
        batch_fn(reference, &colors[i * lane_width], &results[i * lane_width]);
    }

    if (remainder > 0)
    {
        std::vector<Lab> tempLabs(lane_width);
        for (size_t i = 0; i < remainder; ++i)
        {
            tempLabs[i] = colors[numFullChunks * lane_width + i];
        }
        for (size_t i = remainder; i < lane_width; ++i)
        {
            tempLabs[i] = colors[colors.size() - 1];  // Pad with last element
        }

        std::vector<float> tempResults(lane_width);
        batch_fn(reference, tempLabs.data(), tempResults.data());

        for (size_t i = 0; i < remainder; ++i)
        {
            results[numFullChunks * lane_width + i] = tempResults[i];
        }
    }

    return results;
}

template <typename Derived>
struct BaseFormula {
    static std::vector<float> calculate_vectorized(
        const Lab &reference, const std::vector<Lab> &colors, Architecture arch)
    {
        if (arch == Architecture::NEON)
        {
            return process<Derived, Architecture::NEON>(
                reference, colors, Derived::calculate_neon,
                get_lane_width(Architecture::NEON));
        }
        else if (arch == Architecture::AVX2)
        {
            return process<Derived, Architecture::AVX2>(
                reference, colors, Derived::calculate_avx2,
                get_lane_width(Architecture::AVX2));
        }
        else
        {
            // Scalar fallback
            std::vector<float> results(colors.size());
            for (size_t i = 0; i < colors.size(); ++i)
            {
                results[i] = Derived::calculate(reference, colors[i]);
            }
            return results;
        }
    }
};

struct CIE76 : BaseFormula<CIE76> {
    static float calculate(const Lab &color1, const Lab &color2);
    static void calculate_neon(const Lab &reference, const Lab *colors,
                               float *results);
    static void calculate_avx2(const Lab &reference, const Lab *colors,
                               float *results);
};

struct CIE94 : BaseFormula<CIE94> {
    static float calculate(const Lab &color1, const Lab &color2);
    static void calculate_neon(const Lab &reference, const Lab *colors,
                               float *results);
    static void calculate_avx2(const Lab &reference, const Lab *colors,
                               float *results);
};

struct CIEDE2000 : BaseFormula<CIEDE2000> {
    static float calculate(const Lab &color1, const Lab &color2);
    static void calculate_neon(const Lab &reference, const Lab *colors,
                               float *results);
    static void calculate_avx2(const Lab &reference, const Lab *colors,
                               float *results);
};

// Single-pair deltaE function (scalar only)
inline float deltaE(const Lab &color1, const Lab &color2)
{
    return CIEDE2000::calculate(color1, color2);
}

// Batch deltaE with runtime formula and architecture selection
inline std::vector<float> deltaE(const Lab &reference,
                                 const std::vector<Lab> &colors,
                                 Formula formula = DEFAULT_FORMULA,
                                 Architecture arch = DEFAULT_ARCH)
{
    switch (formula)
    {
        case Formula::CIE76:
            return CIE76::calculate_vectorized(reference, colors, arch);
        case Formula::CIE94:
            return CIE94::calculate_vectorized(reference, colors, arch);
        case Formula::CIEDE2000:
            return CIEDE2000::calculate_vectorized(reference, colors, arch);
        default:
            return CIEDE2000::calculate_vectorized(reference, colors,
                                                   arch);  // Fallback
    }
}

// Traits to map Formula enum to formula struct
template <Formula F>
struct FormulaType;

template <>
struct FormulaType<Formula::CIE76> {
    using type = CIE76;
};

template <>
struct FormulaType<Formula::CIE94> {
    using type = CIE94;
};

template <>
struct FormulaType<Formula::CIEDE2000> {
    using type = CIEDE2000;
};

template <Formula F = DEFAULT_FORMULA, Architecture A = DEFAULT_ARCH>
std::vector<float> deltaE(const Lab &reference, const std::vector<Lab> &colors)
{
    using FormulaT = typename FormulaType<F>::type;
    return FormulaT::calculate_vectorized(reference, colors, A);
}

inline std::vector<float> deltaE(const Lab &reference,
                                 const std::vector<Lab> &colors,
                                 Architecture arch)
{
    return CIEDE2000::calculate_vectorized(reference, colors, arch);
}
