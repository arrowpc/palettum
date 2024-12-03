cmake_minimum_required(VERSION 3.22)

project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3")
endif()

include_directories(
  ${CMAKE_SOURCE_DIR}/external/simd_utils
  ${CMAKE_SOURCE_DIR}/external/stb
)

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
