#pragma once

#include <simde/arm/neon.h>
#include <simde/x86/avx2.h>
#include <vector>
#include "color/lab.h"
#include "simd_math.h"

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

enum class Architecture { SCALAR, NEON, AVX2 };

#if HAS_NEON
constexpr Architecture best_architecture = Architecture::NEON;
#elif HAS_AVX2
constexpr Architecture best_architecture = Architecture::AVX2;
#else
constexpr Architecture best_architecture = Architecture::SCALAR;
#endif

constexpr int get_lane_width(Architecture arch)
{
    switch (arch)
    {
        case Architecture::NEON:
        case Architecture::AVX2:
            return 8;
        case Architecture::SCALAR:
        default:
            return 1;
    }
}

// Forward declarations for formula structs
struct EUCLIDEAN;
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

struct EUCLIDEAN : BaseFormula<EUCLIDEAN> {
    static float calculate(const Lab &color1, const Lab &color2);
    static void calculate_neon(const Lab &reference, const Lab *colors,
                               float *results);
    static void calculate_avx2(const Lab &reference, const Lab *colors,
                               float *results);
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

// Type traits to detect if a type is a formula or architecture
template <typename T>
struct is_formula : std::false_type {
};

template <>
struct is_formula<EUCLIDEAN> : std::true_type {
};
template <>
struct is_formula<CIE76> : std::true_type {
};
template <>
struct is_formula<CIE94> : std::true_type {
};
template <>
struct is_formula<CIEDE2000> : std::true_type {
};

template <typename T>
struct is_architecture : std::false_type {
};

template <>
struct is_architecture<
    std::integral_constant<Architecture, Architecture::SCALAR>>
    : std::true_type {
};
template <>
struct is_architecture<std::integral_constant<Architecture, Architecture::NEON>>
    : std::true_type {
};
template <>
struct is_architecture<std::integral_constant<Architecture, Architecture::AVX2>>
    : std::true_type {
};

// Primary deltaE template for batch processing
template <typename T1 = CIEDE2000,
          typename T2 = std::integral_constant<Architecture, best_architecture>>
std::vector<float> deltaE(const Lab &reference, const std::vector<Lab> &colors)
{
    // If T1 is a formula and T2 is an architecture, use them directly
    if constexpr (is_formula<T1>::value && is_architecture<T2>::value)
    {
        return T1::calculate_vectorized(reference, colors, T2::value);
    }
    // If T1 is an architecture and T2 is a formula, swap them
    else if constexpr (is_architecture<T1>::value && is_formula<T2>::value)
    {
        return T2::calculate_vectorized(reference, colors, T1::value);
    }
    // If T1 is a formula but T2 is not an architecture, use best_architecture
    else if constexpr (is_formula<T1>::value)
    {
        return T1::calculate_vectorized(reference, colors, best_architecture);
    }
    // If T1 is an architecture but T2 is not a formula, use CIEDE2000
    else if constexpr (is_architecture<T1>::value)
    {
        return CIEDE2000::calculate_vectorized(reference, colors, T1::value);
    }
    // Default case: use CIEDE2000 and best_architecture
    else
    {
        return CIEDE2000::calculate_vectorized(reference, colors,
                                               best_architecture);
    }
}

// Overload that takes explicit architecture enum
inline std::vector<float> deltaE(const Lab &reference,
                                 const std::vector<Lab> &colors,
                                 Architecture arch)
{
    return CIEDE2000::calculate_vectorized(reference, colors, arch);
}

// Template specialization for explicit architecture constants
template <Architecture Arch>
using ArchType = std::integral_constant<Architecture, Arch>;

template <Architecture Arch>
std::vector<float> deltaE(const Lab &reference, const std::vector<Lab> &colors)
{
    return deltaE<ArchType<Arch>>(reference, colors);
}

// Helper template for formula + architecture combinations
template <typename FormulaT, Architecture Arch>
std::vector<float> deltaE(const Lab &reference, const std::vector<Lab> &colors)
{
    return FormulaT::calculate_vectorized(reference, colors, Arch);
}
