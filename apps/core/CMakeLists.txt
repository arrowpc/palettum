cmake_minimum_required(VERSION 3.22)

project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MSVC)
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2")
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /openmp:experimental")
    else()
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3")
    endif()
endif()

include_directories(
  ${CMAKE_SOURCE_DIR}/external/simd_utils
  ${CMAKE_SOURCE_DIR}/external/stb
)

find_package(OpenMP REQUIRED)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")

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
