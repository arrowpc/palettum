cmake_minimum_required(VERSION 3.23)

project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)

set(ARCH_DIR "${CMAKE_HOST_SYSTEM_PROCESSOR}")
if (EXISTS "${CMAKE_SOURCE_DIR}/opencv_build/${ARCH_DIR}")
    set(OpenCV_DIR "${CMAKE_SOURCE_DIR}/opencv_build/${ARCH_DIR}")
else ()
    set(OpenCV_DIR "$ENV{OpenCV_DIR_${ARCH_DIR}}")
endif ()

find_package(OpenCV REQUIRED)

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
