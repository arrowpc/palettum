cmake_minimum_required(VERSION 3.23)

project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)

if(CMAKE_OSX_ARCHITECTURES)
    set(ARCH_DIR ${CMAKE_OSX_ARCHITECTURES})
    set(OpenCV_DIR "$ENV{OpenCV_DIR_${ARCH_DIR}}")
elseif(CMAKE_HOST_SYSTEM_PROCESSOR STREQUAL "arm64")
    set(ARCH_DIR "arm64")
    set(OpenCV_DIR "$ENV{OpenCV_DIR_arm64}")
elseif(CMAKE_HOST_SYSTEM_PROCESSOR STREQUAL "x86_64")
    set(ARCH_DIR "x86_64")
    set(OpenCV_DIR "$ENV{OpenCV_DIR_x86_64}")
else()
    message(FATAL_ERROR "Unsupported architecture")
endif()

FIND_PACKAGE(OpenCV REQUIRED)
INCLUDE_DIRECTORIES(${OpenCV_INCLUDE_DIRS})

add_subdirectory(external/pybind11)
add_subdirectory(src)

option(BUILD_TESTS "Build the tests" ON)

if (BUILD_TESTS)
    add_subdirectory(external/googletest)
    if (CMAKE_PROJECT_NAME STREQUAL "Palettum_Core")
        enable_testing()
        add_subdirectory(tests/cpp)
    endif ()
endif()
