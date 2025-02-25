add_executable(palettum_tests palettum_test.cpp 
  ${CMAKE_SOURCE_DIR}/src/palettum.cpp 
  ${CMAKE_SOURCE_DIR}/src/image.cpp 
  ${CMAKE_SOURCE_DIR}/src/color/delta_e.cpp 
  ${CMAKE_SOURCE_DIR}/src/color/rgb.cpp
  ${CMAKE_SOURCE_DIR}/src/color/lab.cpp
)
target_link_libraries(palettum_tests PUBLIC GTest::gtest GTest::gtest_main GTest::gmock GTest::gmock_main pybind11::embed OpenMP::OpenMP_CXX GIF::GIF)

target_include_directories(palettum_tests PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_SOURCE_DIR}/src
        ${CMAKE_SOURCE_DIR}/include
        ${OpenMP_CXX_INCLUDE_DIR}
        ${Stb_INCLUDE_DIR}
)

file(COPY ${CMAKE_SOURCE_DIR}/tests/test_images/
        DESTINATION ${CMAKE_BINARY_DIR}/test_images/)

add_test(NAME PalettumTest COMMAND palettum_tests)
