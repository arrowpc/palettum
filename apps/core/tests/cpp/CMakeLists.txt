add_executable(palettum_tests 
  palettum_test.cpp 
  ${SRC_FILES}
)

target_link_libraries(palettum_tests PUBLIC 
  GTest::gtest
  GTest::gtest_main 
  GTest::gmock
  GTest::gmock_main 
  pybind11::embed 
  OpenMP::OpenMP_CXX 
  GIF::GIF
  mtpng_lib
  $<IF:$<TARGET_EXISTS:spng::spng>,spng::spng,spng::spng_static>
  $<IF:$<TARGET_EXISTS:libjpeg-turbo::turbojpeg>,libjpeg-turbo::turbojpeg,libjpeg-turbo::turbojpeg-static>
  WebP::webp
  WebP::webpdecoder
)

target_include_directories(palettum_tests PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${CMAKE_SOURCE_DIR}/src
  ${CMAKE_SOURCE_DIR}/include
  ${CMAKE_SOURCE_DIR}/external/mtpng/c
  ${OpenMP_CXX_INCLUDE_DIR}
)

if(WIN32)
  add_custom_command(TARGET palettum_tests POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${MTPNG_DLL}"
    "$<TARGET_FILE_DIR:palettum_tests>"
    COMMENT "Copying mtpng.dll to test output directory"
    VERBATIM
  )
endif()

file(COPY ${CMAKE_SOURCE_DIR}/tests/test_images/
  DESTINATION ${CMAKE_BINARY_DIR}/test_images/)

add_test(NAME PalettumTest COMMAND palettum_tests)

add_custom_target(run-tests
  COMMAND ${CMAKE_CTEST_COMMAND} --output-on-failure
  DEPENDS palettum_tests
  COMMENT "Building and running all tests"
)
