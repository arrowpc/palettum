#pragma once
#include <simde/simde-features.h>

namespace simd {

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
            return 8;
        case Architecture::AVX2:
            return 8;
        case Architecture::SCALAR:
        default:
            return 1;
    }
}

}  // namespace simd
