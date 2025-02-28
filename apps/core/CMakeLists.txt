cmake_minimum_required(VERSION 3.22)

project(Palettum_Core 
        VERSION 0.3.0
        DESCRIPTION "Core library for Palettum"
        LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra")
    
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0")
    else()
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3")
    endif()
elseif(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4 /openmp:experimental")
    
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2")
    endif()
endif()

find_package(OpenMP REQUIRED)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")

find_package(GIF REQUIRED)
find_package(pybind11 CONFIG REQUIRED)
find_package(Stb REQUIRED)


file(GLOB_RECURSE SRC_FILES "${CMAKE_SOURCE_DIR}/src/*.cpp")
list(REMOVE_ITEM SRC_FILES "${CMAKE_SOURCE_DIR}/src/bindings.cpp")
add_subdirectory(src)

option(BUILD_TESTS "Build the tests" ON)

if(BUILD_TESTS)
    find_package(GTest CONFIG REQUIRED)

    if(CMAKE_PROJECT_NAME STREQUAL "Palettum_Core")
        enable_testing()
        include(CTest)
        add_subdirectory(tests/cpp)
    endif()
endif()
