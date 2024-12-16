if(NOT DEFINED CMAKE_TOOLCHAIN_FILE)
    set(VCPKG_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/external/vcpkg")
    
    if(WIN32)
        if(NOT EXISTS "${VCPKG_ROOT}/vcpkg.exe")
            execute_process(
                COMMAND ${CMAKE_COMMAND} -E chdir ${VCPKG_ROOT} bootstrap-vcpkg.bat -disableMetrics
                RESULT_VARIABLE VCPKG_BOOTSTRAP_RESULT)
        endif()
    else()
        if(NOT EXISTS "${VCPKG_ROOT}/vcpkg")
            execute_process(
                COMMAND ${CMAKE_COMMAND} -E chdir ${VCPKG_ROOT} ./bootstrap-vcpkg.sh -disableMetrics
                RESULT_VARIABLE VCPKG_BOOTSTRAP_RESULT)
        endif()
    endif()
    
    set(CMAKE_TOOLCHAIN_FILE "${VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
        CACHE STRING "Vcpkg toolchain file")
endif()

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
)

find_package(OpenMP REQUIRED)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")

find_package(GIF REQUIRED)
find_package(Python COMPONENTS Interpreter Development)
find_package(pybind11 CONFIG REQUIRED)
find_package(Stb REQUIRED)

add_subdirectory(src)

option(BUILD_TESTS "Build the tests" ON)

if (BUILD_TESTS)
    find_package(GTest CONFIG REQUIRED)
    if (CMAKE_PROJECT_NAME STREQUAL "Palettum_Core")
        enable_testing()
        add_subdirectory(tests/cpp)
    endif ()
endif ()
