cmake_minimum_required(VERSION 3.23)
project(Palettum_Core)

set(CMAKE_CXX_STANDARD 17)

set(SOURCE_FILES main.cpp)
add_library(Palettum_Core library.cpp)
