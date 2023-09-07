add_library(palettum_core palettum.cpp ${PROJECT_SOURCE_DIR}/include/palettum.h)
target_link_libraries(palettum_core ${OpenCV_LIBS})
target_include_directories(palettum_core PUBLIC ../include)
