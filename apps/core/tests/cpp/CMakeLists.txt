add_executable(palettum_tests 
  palettum_test.cpp 
  ${SRC_FILES}
)

target_link_libraries(palettum_tests PUBLIC 
  GTest::gtest_main 
  GTest::gmock_main 
  pybind11::embed 
  OpenMP::OpenMP_CXX 
  GIF::GIF
)

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

add_custom_target(run-tests
  COMMAND ${CMAKE_CTEST_COMMAND} --output-on-failure
  DEPENDS palettum_tests
  COMMENT "Building and running all tests"
)
