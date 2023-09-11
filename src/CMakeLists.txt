add_library(palettum_core palettum.cpp)
set_property(TARGET palettum_core PROPERTY POSITION_INDEPENDENT_CODE ON)
target_link_libraries(palettum_core pybind11::embed ${OpenCV_LIBS})
target_include_directories(palettum_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/../include)

pybind11_add_module(py_palettum_core bindings.cpp)
target_link_libraries(py_palettum_core PUBLIC palettum_core pybind11::module ${OpenCV_LIBS})
target_include_directories(py_palettum_core PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
        )
