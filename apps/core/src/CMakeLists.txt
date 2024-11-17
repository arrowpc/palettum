pybind11_add_module(palettum bindings.cpp palettum.cpp processor.cpp)
target_link_libraries(palettum PRIVATE ${OpenCV_LIBS} OpenMP::OpenMP_CXX)
target_include_directories(palettum PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
)