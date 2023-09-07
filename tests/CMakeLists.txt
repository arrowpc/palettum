add_executable(palettum_tests palettum_test.cpp)
target_link_libraries(palettum_tests PUBLIC gtest_main palettum_core)

target_include_directories(palettum_tests PRIVATE ${CMAKE_BINARY_DIR}/test_images)

add_test(NAME PalettumTest COMMAND palettum_tests)
