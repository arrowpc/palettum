pybind11_add_module(palettum 
  bindings.cpp 
  palettum.cpp 
  image.cpp 
  color/delta_e.cpp
  color/rgb.cpp
  color/lab.cpp
)
target_link_libraries(palettum PRIVATE OpenMP::OpenMP_CXX GIF::GIF)
target_include_directories(palettum PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
        ${OpenMP_CXX_INCLUDE_DIR}
        ${Stb_INCLUDE_DIR}
)
