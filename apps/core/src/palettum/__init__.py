try:
    from .palettum import (
        GIF,
        RGB,
        Architecture,
        Config,
        Formula,
        Image,
        Lab,
        Mapping,
        palettify,
        validate,
    )
except ImportError as e:
    raise ImportError(
        "The C++ extension module '.palettum' could not be imported. "
        "Ensure it is built and installed correctly."
    ) from e
