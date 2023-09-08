cmake_minimum_required(VERSION 3.23)

project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)

FIND_PACKAGE(OpenCV REQUIRED)
INCLUDE_DIRECTORIES(${OpenCV_INCLUDE_DIRS})

add_subdirectory(external/googletest)
add_subdirectory(external/pybind11)
add_subdirectory(src)

if(CMAKE_PROJECT_NAME STREQUAL "Palettum_Core")
    enable_testing()
    add_subdirectory(tests)
endif()
