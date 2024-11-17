cmake_minimum_required(VERSION 3.22)

project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)

if (APPLE)
    if (CMAKE_SYSTEM_PROCESSOR STREQUAL "arm64")
        set(HOMEBREW_PREFIX "/opt/homebrew")
    else ()
        set(HOMEBREW_PREFIX "/usr/local")
    endif ()

    if (CMAKE_CXX_COMPILER_ID MATCHES "Clang")
        set(OpenMP_CXX_FLAGS "-Xpreprocessor -fopenmp")
        set(OpenMP_CXX_LIB_NAMES "omp")

        if (EXISTS "${HOMEBREW_PREFIX}/opt/libomp/")
            set(OpenMP_omp_LIBRARY "${HOMEBREW_PREFIX}/opt/libomp/lib/libomp.dylib")
            set(OpenMP_CXX_INCLUDE_DIR "${HOMEBREW_PREFIX}/opt/libomp/include")
        else ()
            set(OpenMP_omp_LIBRARY "$ENV{MPLIB}")
            set(OpenMP_CXX_INCLUDE_DIR "$ENV{MPINC}")
        endif ()
    endif ()
endif ()

find_package(OpenMP REQUIRED)

add_subdirectory(external/pybind11)
add_subdirectory(src)

option(BUILD_TESTS "Build the tests" ON)

if (BUILD_TESTS)
    add_subdirectory(external/googletest)
    if (CMAKE_PROJECT_NAME STREQUAL "Palettum_Core")
        enable_testing()
        add_subdirectory(tests/cpp)
    endif ()
endif ()
