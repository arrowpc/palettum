pybind11_add_module(palettum bindings.cpp palettum.cpp)
target_link_libraries(palettum PRIVATE ${OpenCV_LIBS})
target_include_directories(palettum PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
        )