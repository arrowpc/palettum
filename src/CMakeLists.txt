add_library(palettum_core palettum.cpp)
set_property(TARGET palettum_core PROPERTY POSITION_INDEPENDENT_CODE ON)
target_link_libraries(palettum_core pybind11::embed ${OpenCV_LIBS} ${PYTHON_LIBRARIES} Python::Python)
target_include_directories(palettum_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/../include)

target_compile_definitions(palettum_core
        PRIVATE VERSION_INFO=${PALETTUM_VERSION_INFO})

pybind11_add_module(palettum bindings.cpp)
target_link_libraries(palettum PUBLIC palettum_core pybind11::module ${OpenCV_LIBS} ${PYTHON_LIBRARIES} Python::Python)
target_include_directories(palettum PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/../include
        )
