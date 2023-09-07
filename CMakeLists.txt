cmake_minimum_required(VERSION 3.23)

project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)

add_subdirectory(external/googletest)

add_subdirectory(src)

if(CMAKE_PROJECT_NAME STREQUAL "Palettum_Core")
    enable_testing()
    add_subdirectory(tests)
endif()
