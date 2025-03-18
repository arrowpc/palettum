pybind11_add_module(palettum 
  bindings.cpp 
  ${SRC_FILES}
)

target_link_libraries(palettum PRIVATE 
  OpenMP::OpenMP_CXX
  GIF::GIF
  mtpng_lib
)

target_include_directories(palettum PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${CMAKE_CURRENT_SOURCE_DIR}/../include
  ${CMAKE_CURRENT_SOURCE_DIR}/../external/mtpng/c
  ${OpenMP_CXX_INCLUDE_DIR}
  ${Stb_INCLUDE_DIR}
)

if(WIN32)
  add_custom_command(TARGET palettum POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${MTPNG_DLL}"
    "$<TARGET_FILE_DIR:palettum>"
    COMMENT "Copying mtpng.dll to Python module output directory"
    VERBATIM
  )
endif()
