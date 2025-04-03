import os
import re
import subprocess
import sys
from pathlib import Path

from setuptools import Extension, setup
from setuptools.command.build_ext import build_ext

# Convert distutils Windows platform specifiers to CMake -A arguments
PLAT_TO_CMAKE = {
    "win32": "Win32",
    "win-amd64": "x64",
    "win-arm32": "ARM",
    "win-arm64": "ARM64",
}


# A CMakeExtension needs a sourcedir instead of a file list.
# The name must be the _single_ output extension from the CMake build.
# If you need multiple extensions, see scikit-build.
class CMakeExtension(Extension):
    def __init__(self, name: str, sourcedir: str = "") -> None:
        super().__init__(name, sources=[])
        self.sourcedir = os.fspath(Path(sourcedir).resolve())


class CMakeBuild(build_ext):
    def build_extension(self, ext: CMakeExtension) -> None:
        mtpng_source_dir = Path(ext.sourcedir) / "external" / "mtpng"
        mtpng_build_dir = mtpng_source_dir / "build"
        mtpng_lib_name = "libmtpng.dylib" if sys.platform == "darwin" else "libmtpng.so"
        if sys.platform == "win32":
            # Assuming mtpng builds a static lib on Windows by default
            # Adjust if it builds a DLL (mtpng.dll) and needs an import lib (mtpng.lib)
            mtpng_lib_name = (
                "mtpng.lib"  # Or potentially mtpng.dll if linking dynamically
            )

        mtpng_lib_path = mtpng_build_dir / mtpng_lib_name

        # Check if mtpng library already exists to avoid rebuilding every time
        if not mtpng_lib_path.exists():
            print(f"--- Building mtpng dependency at {mtpng_source_dir} ---")
            if not mtpng_source_dir.exists():
                raise FileNotFoundError(
                    f"mtpng source directory not found at {mtpng_source_dir}"
                )
            # Assuming mtpng uses 'make' and builds into its 'build' subdir
            # Adjust command if needed (e.g., 'make release', 'cargo build --release', etc.)
            # Use appropriate build command for the platform
            if sys.platform == "win32":
                # Example using nmake, adjust if mtpng uses CMake or other build system
                # This part might need significant adjustment based on how mtpng builds on Windows
                print(
                    "Warning: Windows build command for mtpng is assumed (nmake). Please verify."
                )
                make_command = [
                    "nmake"
                ]  # Or potentially ["cmake", "--build", "."] if it uses CMake
            else:
                make_command = ["make"]

            try:
                # Run the build command from within the mtpng source directory
                subprocess.run(make_command, cwd=mtpng_source_dir, check=True)
                # Verify the library was created
                if not mtpng_lib_path.exists():
                    raise RuntimeError(
                        f"mtpng build command succeeded but library not found at {mtpng_lib_path}"
                    )
                print(f"--- Finished building mtpng ---")
            except FileNotFoundError:
                raise RuntimeError(
                    f"Failed to build mtpng: '{make_command[0]}' command not found. Ensure build tools are installed."
                )
            except subprocess.CalledProcessError as e:
                raise RuntimeError(f"Failed to build mtpng: {e}")
        else:
            print(
                f"--- Found existing mtpng library at {mtpng_lib_path}, skipping build ---"
            )

        # Must be in this form due to bug in .resolve() only fixed in Python 3.10+
        ext_fullpath = Path.cwd() / self.get_ext_fullpath(ext.name)
        extdir = ext_fullpath.parent.resolve()

        debug = int(os.environ.get("DEBUG", 0)) if self.debug is None else self.debug
        cfg = "Debug" if debug else "Release"

        # CMake lets you override the generator - we need to check this.
        cmake_generator = os.environ.get("CMAKE_GENERATOR", "")

        vcpkg_root = Path(ext.sourcedir) / "external" / "vcpkg"
        vcpkg_toolchain = vcpkg_root / "scripts" / "buildsystems" / "vcpkg.cmake"
        use_vcpkg = False  # Flag to track if we are using vcpkg

        cmake_args = [
            f"-DBUILD_TESTS=OFF",
            f"-DCMAKE_LIBRARY_OUTPUT_DIRECTORY={extdir}{os.sep}",
            f"-DPYTHON_EXECUTABLE={sys.executable}",
            f"-DCMAKE_BUILD_TYPE={cfg}",  # not used on MSVC, but no harm
        ]

        if vcpkg_toolchain.exists():
            print(f"--- Found vcpkg toolchain at {vcpkg_toolchain} ---")
            use_vcpkg = True
            # Check if VCPKG needs bootstrapping only if we intend to use it
            if sys.platform == "win32":
                vcpkg_executable = vcpkg_root / "vcpkg.exe"
                bootstrap_script = "bootstrap-vcpkg.bat"
            else:
                vcpkg_executable = vcpkg_root / "vcpkg"
                bootstrap_script = "bootstrap-vcpkg.sh"

            if not vcpkg_executable.exists():
                print(
                    f"--- vcpkg executable not found at {vcpkg_executable}, bootstrapping... ---"
                )
                bootstrap_cmd = [str(vcpkg_root / bootstrap_script), "-disableMetrics"]
                try:
                    subprocess.run(bootstrap_cmd, cwd=vcpkg_root, check=True)
                except subprocess.CalledProcessError as e:
                    # If bootstrapping fails, maybe we should fall back? Or error out?
                    # For now, let's error out as the user likely intended vcpkg use.
                    raise RuntimeError(f"Failed to bootstrap VCPKG: {e}")
                except FileNotFoundError:
                    raise RuntimeError(
                        f"Failed to bootstrap VCPKG: Bootstrap script not found at {vcpkg_root / bootstrap_script}"
                    )

                if not vcpkg_executable.exists():
                    raise RuntimeError(
                        f"VCPKG bootstrap ran but {vcpkg_executable} still not found."
                    )
                print(f"--- Finished bootstrapping vcpkg ---")
            else:
                print(f"--- Found vcpkg executable at {vcpkg_executable} ---")

            # Add the toolchain file argument only if we successfully found/bootstrapped vcpkg
            cmake_args.append(f"-DCMAKE_TOOLCHAIN_FILE={vcpkg_toolchain}")
            print("--- Configuring CMake to use vcpkg toolchain ---")

        else:
            print(f"--- vcpkg toolchain not found at {vcpkg_toolchain} ---")
            print("--- Configuring CMake without vcpkg toolchain ---")
            # Optionally, you could add other flags here if needed for a non-vcpkg build
            # e.g., specifying system library paths if necessary
            # cmake_args.append("-DSOME_OTHER_FLAG=ON")

        build_args = []
        # Adding CMake arguments set as environment variable
        if "CMAKE_ARGS" in os.environ:
            cmake_args += [item for item in os.environ["CMAKE_ARGS"].split(" ") if item]

        cmake_args += [f"-DEXAMPLE_VERSION_INFO={self.distribution.get_version()}"]

        if self.compiler.compiler_type != "msvc":
            if not cmake_generator or cmake_generator == "Ninja":
                try:
                    import ninja

                    ninja_executable_path = Path(ninja.BIN_DIR) / "ninja"
                    cmake_args += [
                        "-GNinja",
                        f"-DCMAKE_MAKE_PROGRAM:FILEPATH={ninja_executable_path}",
                    ]
                except ImportError:
                    print("--- Ninja not found, using default CMake generator ---")
                    pass  # Allow CMake to pick the default generator

        else:  # MSVC specific logic
            single_config = any(x in cmake_generator for x in {"NMake", "Ninja"})
            contains_arch = any(x in cmake_generator for x in {"ARM", "Win64"})

            if not single_config and not contains_arch:
                # Check if plat_name is valid before using it
                if self.plat_name not in PLAT_TO_CMAKE:
                    raise ValueError(f"Unsupported platform: {self.plat_name}")
                cmake_args += ["-A", PLAT_TO_CMAKE[self.plat_name]]

            if not single_config:
                cmake_args += [
                    f"-DCMAKE_LIBRARY_OUTPUT_DIRECTORY_{cfg.upper()}={extdir}"
                ]
                # Add parallel build for MSVC multi-config
                build_args += ["--config", cfg, "--parallel"]  # Added parallel here
            else:
                # Add parallel build for single-config (like Ninja on Windows)
                build_args += ["--parallel"]

        if sys.platform.startswith("darwin"):
            archs = re.findall(r"-arch (\S+)", os.environ.get("ARCHFLAGS", ""))
            if archs:
                cmake_args += ["-DCMAKE_OSX_ARCHITECTURES={}".format(";".join(archs))]

        if "CMAKE_BUILD_PARALLEL_LEVEL" not in os.environ:
            if hasattr(self, "parallel") and self.parallel:
                # Ensure build_args doesn't already contain -j or --parallel
                if not any(arg.startswith(("-j", "--parallel")) for arg in build_args):
                    build_args += [
                        f"--parallel={self.parallel}"
                    ]  # Use --parallel=N format

        build_temp = Path(self.build_temp) / ext.name
        if not build_temp.exists():
            build_temp.mkdir(parents=True)

        print(f"--- Configuring CMake for {ext.name} ---")
        print(f"CMake Args: {cmake_args}")
        subprocess.run(
            ["cmake", ext.sourcedir, *cmake_args], cwd=build_temp, check=True
        )

        print(f"--- Building {ext.name} ---")
        print(f"Build Args: {build_args}")
        subprocess.run(
            ["cmake", "--build", ".", *build_args], cwd=build_temp, check=True
        )
        print(f"--- Finished building {ext.name} ---")


# The information here can also be placed in setup.cfg - better separation of
# logic and declaration, and simpler if you include description/version in a file.

setup(
    name="palettum",
    version="0.4.2",
    author="ArrowPC",
    description="Core functionality for the Palettum project.",
    long_description="Core functionality for the Palettum project.",
    long_description_content_type="text/x-rst",
    url="https://github.com/ArrowPC/palettum/",
    license="GNU Affero General Public License v3.0",
    packages=["palettum"],
    package_dir={"palettum": "src/palettum"},
    package_data={
        "palettum": ["palettes/*.json"],
    },
    ext_modules=[CMakeExtension("palettum.palettum")],
    cmdclass={"build_ext": CMakeBuild},
    entry_points={
        "console_scripts": [
            "palettum=palettum.cli:main",
        ],
    },
    install_requires=["rich-click>=1.7.0"],
    zip_safe=False,
    extras_require={"test": ["pytest>=6.0"]},
    python_requires=">=3.8",
)
