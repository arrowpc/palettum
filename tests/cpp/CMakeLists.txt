add_executable(palettum_tests palettum_test.cpp ${CMAKE_SOURCE_DIR}/src/palettum.cpp)
target_link_libraries(palettum_tests PUBLIC gtest_main pybind11::embed ${OpenCV_LIBS})

target_include_directories(palettum_tests PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_SOURCE_DIR}/src
        ${CMAKE_SOURCE_DIR}/include
        )

file(COPY ${CMAKE_SOURCE_DIR}/tests/test_images/
        DESTINATION ${CMAKE_BINARY_DIR}/test_images/)

add_test(NAME PalettumTest COMMAND palettum_tests)
