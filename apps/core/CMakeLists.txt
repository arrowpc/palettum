cmake_minimum_required(VERSION 3.22)


project(Palettum_Core 
        VERSION 0.3.0
        DESCRIPTION "Core library for Palettum"
        LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(CheckCXXCompilerFlag)

execute_process(
  COMMAND ${CMAKE_COMMAND} -E create_symlink
  ${CMAKE_BINARY_DIR}/compile_commands.json
  ${CMAKE_SOURCE_DIR}/build/compile_commands.json
)

find_package(OpenMP REQUIRED)
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")
    
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0")
    else()
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3")
    endif()
elseif(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4 /openmp:llvm /openmp:experimental")
    
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2")
    endif()
endif()


if(APPLE)
  execute_process(
    COMMAND uname -m
    OUTPUT_VARIABLE ARCH
    OUTPUT_STRIP_TRAILING_WHITESPACE
  )
  
  message(STATUS "macOS architecture: ${ARCH}")
  
  if(ARCH STREQUAL "arm64")
    check_cxx_compiler_flag("-march=armv8-a+simd" COMPILER_SUPPORTS_NEON)
    if(COMPILER_SUPPORTS_NEON)
      add_definitions(-DHAS_NEON)
      set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -march=armv8-a+simd")
    endif()
  elseif(ARCH STREQUAL "x86_64")
    check_cxx_compiler_flag("-march=x86-64-v3" COMPILER_SUPPORTS_X86_64_V3)
    if(COMPILER_SUPPORTS_X86_64_V3)
      add_definitions(-DHAS_AVX2)
      set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -march=x86-64-v3")
    endif()
  endif()
elseif(WIN32)
  if(CMAKE_CXX_COMPILER_ID MATCHES "MSVC")
    if(CMAKE_SYSTEM_PROCESSOR MATCHES "AMD64|x86_64")
      check_cxx_compiler_flag("/arch:AVX2" COMPILER_SUPPORTS_AVX2)
      if(COMPILER_SUPPORTS_AVX2)
        add_definitions(-DHAS_AVX2)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /arch:AVX2")
      endif()
    elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "ARM64")
      check_cxx_compiler_flag("/arch:armv8.2" COMPILER_SUPPORTS_NEON)
      if(COMPILER_SUPPORTS_NEON)
        add_definitions(-DHAS_NEON)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /arch:armv8.2")
      endif()
    endif()
  elseif(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    if(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
      check_cxx_compiler_flag("-march=x86-64-v3" COMPILER_SUPPORTS_X86_64_V3)
      if(COMPILER_SUPPORTS_X86_64_V3)
        add_definitions(-DHAS_AVX2)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -march=x86-64-v3")
      endif()
    elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|ARM64")
      check_cxx_compiler_flag("-march=armv8-a+simd" COMPILER_SUPPORTS_NEON)
      if(COMPILER_SUPPORTS_NEON)
        add_definitions(-DHAS_NEON)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -march=armv8-a+simd")
      endif()
    endif()
  endif()
else()
  if(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
    check_cxx_compiler_flag("-march=x86-64-v3" COMPILER_SUPPORTS_X86_64_V3)
    if(COMPILER_SUPPORTS_X86_64_V3)
      add_definitions(-DHAS_AVX2)
      set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -march=x86-64-v3")
    endif()
  elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64")
    check_cxx_compiler_flag("-march=armv8-a+simd" COMPILER_SUPPORTS_NEON)
    if(COMPILER_SUPPORTS_NEON)
      add_definitions(-DHAS_NEON)
      set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -march=armv8-a+simd")
    endif()
  endif()
endif()

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

