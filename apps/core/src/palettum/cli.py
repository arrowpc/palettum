import importlib.metadata
import importlib.resources as resources
import json
import os
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

import rich_click as click
from rich.console import Console
from rich.panel import Panel
from rich.status import Status
from rich.table import Table

from palettum import (
    GIF,
    RGB,
    Architecture,
    Config,
    Formula,
    Image,
    Mapping,
    WeightingKernelType,
)
from palettum import palettify as core_palettify

console = Console()

PACKAGE_NAME = "palettum"
DEFAULT_PALETTES_DIR = "palettes"
CUSTOM_PALETTES_DIR = Path.home() / ".palettum" / "palettes"

MIN_SMOOTHED_SCALE = 0.1
MAX_SMOOTHED_SCALE = 10.0
MIN_SMOOTHED_SHAPE = 0.02
MAX_SMOOTHED_SHAPE = 0.2
MIN_SMOOTHED_POWER = 2.0
MAX_SMOOTHED_POWER = 5.0

VALID_WEIGHTING_KERNELS = {
    "GAUSSIAN": WeightingKernelType.GAUSSIAN,
    "INVERSE_DISTANCE_POWER": WeightingKernelType.INVERSE_DISTANCE_POWER,
}

try:
    __version__ = importlib.metadata.version(PACKAGE_NAME)
except importlib.metadata.PackageNotFoundError:
    __version__ = "0.0.0"


def ensure_custom_palettes_dir():
    CUSTOM_PALETTES_DIR.mkdir(parents=True, exist_ok=True)


def parse_palette_json(palette_path: str) -> Tuple[List[RGB], str]:
    with open(palette_path, "r") as f:
        data = json.load(f)
    if "name" not in data:
        raise ValueError("Palette JSON must contain a 'name' key")
    if "colors" not in data:
        raise ValueError("Palette JSON must contain a 'colors' key")
    name = data["name"]
    colors = data["colors"]
    if not isinstance(colors, list):
        raise ValueError("'colors' must be a list")
    palette = []
    for color in colors:
        if not isinstance(color, dict) or not all(k in color for k in ("r", "g", "b")):
            raise ValueError("Each color must be a dictionary with 'r', 'g', 'b' keys")
        r, g, b = color["r"], color["g"], color["b"]
        if not all(isinstance(val, int) and 0 <= val <= 255 for val in (r, g, b)):
            raise ValueError("RGB values must be integers between 0 and 255")
        palette.append(RGB(r, g, b))
    return palette, name


def parse_scale(scale_str: str) -> float:
    try:
        if scale_str.endswith("x"):
            return float(scale_str[:-1])
        elif scale_str.endswith("%"):
            return float(scale_str[:-1]) / 100
        else:
            raise ValueError(
                "Scale must be in 'Nx' (e.g., 0.5x) or 'N%' (e.g., 50%) format"
            )
    except ValueError as e:
        raise ValueError(f"Invalid scale specification '{scale_str}': {e}")


def calculate_dimensions(
    original_width: int,
    original_height: int,
    width: Optional[int] = None,
    height: Optional[int] = None,
    scale: Optional[str] = None,
) -> Tuple[int, int]:
    if original_height == 0:
        original_aspect = 1.0
    else:
        original_aspect = original_width / original_height

    target_width, target_height = original_width, original_height

    if scale is not None:
        scale_factor = parse_scale(scale)
        target_width = max(1, int(original_width * scale_factor))
        target_height = max(1, int(original_height * scale_factor))

    if width is not None and height is not None:
        return (width, height)
    elif width is not None:
        return (width, max(1, int(width / original_aspect)))
    elif height is not None:
        return (max(1, int(height * original_aspect)), height)

    return (target_width, target_height)


ARCH_TO_STR = {
    Architecture.SCALAR: "SCALAR",
    Architecture.NEON: "NEON",
    Architecture.AVX2: "AVX2",
}


def get_default_architecture() -> str:
    try:
        config = Config()
        return ARCH_TO_STR.get(config.architecture, "SCALAR")
    except Exception:
        return "SCALAR"


def format_size(size: float) -> str:
    if size < 1024:
        return f"{size:.2f} B"
    elif size < 1024 * 1024:
        return f"{size / 1024:.2f} KB"
    else:
        return f"{size / (1024 * 1024):.2f} MB"


# TODO: Make more sophisticated by being able to display minutes with seconds
def format_time(seconds: float) -> str:
    if seconds < 1:
        return f"{seconds * 1000:.2f} ms"
    else:
        return f"{seconds:.2f} s"


def find_palette_by_id(palette_id: str) -> str:
    custom_palette_path = CUSTOM_PALETTES_DIR / f"{palette_id}.json"
    if custom_palette_path.exists():
        try:
            with open(custom_palette_path, "r") as f:
                data = json.load(f)
                if data.get("id", "").lower() == palette_id.lower():
                    return str(custom_palette_path)
        except Exception as e:
            console.print(
                f"[yellow]Warning:[/yellow] Could not read custom palette {custom_palette_path}: {e}"
            )
            pass

    try:
        with resources.path(PACKAGE_NAME, DEFAULT_PALETTES_DIR) as dir_path:
            for fname in os.listdir(dir_path):
                if not fname.endswith(".json"):
                    continue
                palette_path = os.path.join(dir_path, fname)
                try:
                    with open(palette_path, "r") as f:
                        data = json.load(f)
                        file_id = data.get("id", fname.rsplit(".", 1)[0])
                        if file_id.lower() == palette_id.lower():
                            return palette_path
                except Exception:
                    continue
    except FileNotFoundError:
        pass
    except Exception as e:
        console.print(
            f"[yellow]Warning:[/yellow] Error accessing default palettes: {e}"
        )

    raise ValueError(
        f"[bold red]Palette '{palette_id}' not found.[/bold red]\n"
        f"Searched in custom path: {CUSTOM_PALETTES_DIR}\n"
        f"And in default package palettes.\n"
        f"Try running [bold green]palettum list-palettes[/bold green] to see available palettes.\n"
        f"You can also create custom palettes at https://palettum.com and save them using 'palettum save-palette'."
    )


def list_palettes() -> None:
    palettes = []

    try:
        with resources.path(PACKAGE_NAME, DEFAULT_PALETTES_DIR) as dir_path:
            for fname in os.listdir(dir_path):
                if fname.endswith(".json"):
                    palette_path = os.path.join(dir_path, fname)
                    try:
                        with open(palette_path, "r") as f:
                            data = json.load(f)
                            palette_id = data.get("id", fname.rsplit(".", 1)[0])
                            palette_name = data.get("name", "Unknown Name")
                            palette_source = data.get("source", "Unknown Source")
                            palette_type = "Default"
                            palettes.append(
                                (
                                    palette_id,
                                    palette_name,
                                    palette_source,
                                    palette_type,
                                )
                            )
                    except Exception as e:
                        palettes.append(
                            (
                                fname.rsplit(".", 1)[0],
                                f"Error reading file: {e}",
                                "",
                                "Default (Error)",
                            )
                        )
    except FileNotFoundError:
        console.print("[yellow]Warning:[/yellow] Default palettes directory not found.")
    except Exception as e:
        console.print(
            f"[yellow]Warning:[/yellow] Error accessing default palettes: {e}"
        )

    ensure_custom_palettes_dir()
    if CUSTOM_PALETTES_DIR.exists():
        for fname in os.listdir(CUSTOM_PALETTES_DIR):
            if fname.endswith(".json"):
                palette_path = os.path.join(CUSTOM_PALETTES_DIR, fname)
                try:
                    with open(palette_path, "r") as f:
                        data = json.load(f)
                        palette_id = data.get("id", fname.rsplit(".", 1)[0])
                        palette_name = data.get("name", "Unknown Name")
                        palette_source = data.get("source", "Unknown Source")
                        palette_type = (
                            "Default" if data.get("isDefault", False) else "Custom"
                        )
                        palettes.append(
                            (
                                palette_id,
                                palette_name,
                                palette_source,
                                palette_type,
                            )
                        )
                except Exception as e:
                    palettes.append(
                        (
                            fname.rsplit(".", 1)[0],
                            f"Error reading file: {e}",
                            "",
                            "Custom (Error)",
                        )
                    )

    if not palettes:
        console.print("[bold red]No palettes found.[/bold red]")
        console.print(
            f"Default palettes should be in the package, custom palettes in {CUSTOM_PALETTES_DIR}"
        )
        sys.exit(1)

    table = Table(title="Available Palettes")
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="green")
    table.add_column("Source", style="yellow")
    table.add_column("Type", style="magenta")

    palettes.sort(key=lambda p: (p[3] != "Custom", p[0].lower()))

    for palette in palettes:
        source_link = f"[link={palette[2]}]{palette[2]}[/link]" if palette[2] else ""
        table.add_row(palette[0], palette[1], source_link, palette[3])

    console.print(table)
    console.print(
        "\nUse the 'ID' with the -p/--palette option in the palettify command."
    )
    console.print("You can create and export custom palettes at https://palettum.com")
    sys.exit(0)


def validate_smoothed_scale(scale: float) -> None:
    if not (MIN_SMOOTHED_SCALE <= scale <= MAX_SMOOTHED_SCALE):
        raise ValueError(
            f"Smoothed Lab scale must be between {MIN_SMOOTHED_SCALE} and {MAX_SMOOTHED_SCALE}"
        )


def validate_smoothed_shape(shape: float) -> None:
    if not (MIN_SMOOTHED_SHAPE <= shape <= MAX_SMOOTHED_SHAPE):
        raise ValueError(
            f"Smoothed shape parameter must be between {MIN_SMOOTHED_SHAPE} and {MAX_SMOOTHED_SHAPE}"
        )


def validate_smoothed_power(power: float) -> None:
    if not (MIN_SMOOTHED_POWER <= power <= MAX_SMOOTHED_POWER):
        raise ValueError(
            f"Smoothed power parameter must be between {MIN_SMOOTHED_POWER} and {MAX_SMOOTHED_POWER}"
        )


def validate_weighting_kernel(kernel: str) -> None:
    if kernel.upper() not in VALID_WEIGHTING_KERNELS:
        raise ValueError(
            f"Invalid weighting kernel '{kernel}'. Choose from: {', '.join(VALID_WEIGHTING_KERNELS.keys())}"
        )


click.rich_click.USE_RICH_MARKUP = True
click.rich_click.OPTION_GROUPS = {
    "palettum palettify": [
        {
            "name": "Input/Output Options",
            "options": ["--output", "--palette", "--mapping"],
        },
        {
            "name": "Smoothing Options (Used with --mapping smoothed* modes)",
            "options": [
                "--weighting-kernel",
                "--smoothed-l-scale",
                "--smoothed-a-scale",
                "--smoothed-b-scale",
                "--smoothed-shape-parameter",
                "--smoothed-power-parameter",
            ],
        },
        {
            "name": "Palettization Options (Used with --mapping palettized* modes)",
            "options": ["--formula", "--alpha-threshold"],
        },
        {
            "name": "Output Resizing",
            "options": ["--width", "--height", "--scale"],
        },
        {
            "name": "Performance Tuning",
            "options": ["--quantization", "--architecture"],
        },
    ]
}


@click.group()
@click.version_option(__version__, package_name=PACKAGE_NAME)
def cli():
    pass


@cli.command()
@click.argument("input_file", type=click.Path(exists=True, readable=True))
@click.option(
    "-o",
    "--output",
    type=click.Path(writable=True, dir_okay=False),
    help="Output file path. If omitted, defaults to '<input>_palettified.<ext>' (png/jpg/webp/gif based on mapping).",
)
@click.option(
    "-p",
    "--palette",
    required=True,
    help="[REQUIRED] Palette ID (see 'list-palettes') or path to a custom JSON palette file.",
)
@click.option(
    "-m",
    "--mapping",
    type=click.Choice(
        ["palettized", "smoothed", "smoothed-palettized"], case_sensitive=False
    ),
    default="palettized",
    show_default=True,
    help="'palettized' snaps colors to the nearest palette entry. 'smoothed' creates smooth gradients using palette colors as anchors (output is JPG). 'smoothed-palettized' applies smoothing then snaps to the palette.",
)
@click.option(
    "--weighting-kernel",
    type=click.Choice(list(VALID_WEIGHTING_KERNELS.keys()), case_sensitive=False),
    default="INVERSE_DISTANCE_POWER",
    show_default=True,
    help="Determines how the smoothness is applied.",
)
@click.option(
    "--smoothed-l-scale",
    type=click.FloatRange(MIN_SMOOTHED_SCALE, MAX_SMOOTHED_SCALE),
    default=1.0,
    show_default=True,
    help="Weighting scale factor for the L (lightness) channel.",
)
@click.option(
    "--smoothed-a-scale",
    type=click.FloatRange(MIN_SMOOTHED_SCALE, MAX_SMOOTHED_SCALE),
    default=1.0,
    show_default=True,
    help="Weighting scale factor for the a (green-red) channel.",
)
@click.option(
    "--smoothed-b-scale",
    type=click.FloatRange(MIN_SMOOTHED_SCALE, MAX_SMOOTHED_SCALE),
    default=1.0,
    show_default=True,
    help="Weighting scale factor for the b (blue-yellow) channel.",
)
@click.option(
    "--smoothed-shape-parameter",
    type=click.FloatRange(MIN_SMOOTHED_SHAPE, MAX_SMOOTHED_SHAPE),
    default=0.10,
    show_default=True,
    help=f"Controls the sharpness of the smoothing. higher increases sharpness.",
)
@click.option(
    "--smoothed-power-parameter",
    type=click.FloatRange(MIN_SMOOTHED_POWER, MAX_SMOOTHED_POWER),
    default=4.0,
    show_default=True,
    help=f"Controls the sharpness of the smoothing. higher increases sharpness.",
)
@click.option(
    "-q",
    "--quantization",
    type=click.IntRange(0, 4),
    default=2,
    show_default=True,
    help="Set color quantization level (0-4). Controls the trade-off between color accuracy and speed. 0=Exact colors (slowest, 0% error), 4=Fastest (~10% error). Default 2 is ~3% error.",
)
@click.option(
    "-t",
    "--alpha-threshold",
    type=click.IntRange(0, 255),
    default=128,
    show_default=True,
    help="Pixels with alpha below this value become fully transparent.",
)
@click.option(
    "-f",
    "--formula",
    type=click.Choice(["cie76", "cie94", "ciede2000"], case_sensitive=False),
    default="ciede2000",
    show_default=True,
    help="Color difference formula: 'cie76' (Most basic), 'cie94', 'ciede2000' (Most advanced).",
)
@click.option(
    "-a",
    "--architecture",
    type=click.Choice(["scalar", "neon", "avx2"], case_sensitive=False),
    default=get_default_architecture(),
    show_default=True,
    help="SIMD instruction set for vectorization. 'scalar' = no vectorization. Auto-detected by default for best performance. Overriding with an unsupported set will port the instructions, usually less efficiently.",
)
@click.option(
    "--width",
    type=click.IntRange(min=1),
    help="Resize output to this width (pixels). If --height is not set, aspect ratio is preserved.",
)
@click.option(
    "--height",
    type=click.IntRange(min=1),
    help="Resize output to this height (pixels). If --width is not set, aspect ratio is preserved.",
)
@click.option(
    "--scale",
    type=str,
    help="Resize output by a scale factor. Use 'Nx' format (e.g., '0.5x', '2x') or 'N%' format (e.g., '50%', '200%'). Overridden by --width/--height if they are set.",
)
@click.option(
    "--silent", is_flag=True, help="Suppress all terminal output except errors."
)
def palettify(
    input_file: str,
    output: Optional[str],
    palette: str,
    mapping: str,
    quantization: int,
    alpha_threshold: int,
    formula: str,
    architecture: str,
    width: Optional[int],
    height: Optional[int],
    scale: Optional[str],
    smoothed_l_scale: float,
    smoothed_a_scale: float,
    smoothed_b_scale: float,
    smoothed_shape_parameter: float,
    smoothed_power_parameter: float,
    weighting_kernel: str,
    silent: bool,
):
    if silent:
        console.quiet = True

    is_gif_file = input_file.lower().endswith(".gif")
    file_type = "GIF" if is_gif_file else "Image"
    try:
        input_size = os.path.getsize(input_file)
    except OSError:
        input_size = 0

    try:
        if os.path.isfile(palette):
            palette_path = palette
        else:
            palette_path = find_palette_by_id(palette)
        rgb_palette, palette_name = parse_palette_json(palette_path)
    except (ValueError, FileNotFoundError, json.JSONDecodeError) as e:
        console.print(f"[bold red]Error:[/bold red] Failed to load palette: {e}")
        sys.exit(1)
    except Exception as e:
        console.print(
            f"[bold red]Error:[/bold red] Unexpected error loading palette: {e}"
        )
        sys.exit(1)

    if output is None:
        base, _ = os.path.splitext(input_file)
        if is_gif_file:
            output_ext = ".gif"
        elif mapping.lower() == "smoothed":
            output_ext = ".jpg"
        else:
            output_ext = ".png"
        output = f"{base}_palettified{output_ext}"

    mapping_lower = mapping.lower()
    kernel_lower = weighting_kernel.lower()
    uses_smoothed = "smoothed" in mapping_lower
    uses_palettized = "palettized" in mapping_lower

    mapping_dict = {
        "palettized": Mapping.PALETTIZED,
        "smoothed": Mapping.SMOOTHED,
        "smoothed-palettized": Mapping.SMOOTHED_PALETTIZED,
    }
    formula_dict = {
        "cie76": Formula.CIE76,
        "cie94": Formula.CIE94,
        "ciede2000": Formula.CIEDE2000,
    }
    arch_dict = {
        "scalar": Architecture.SCALAR,
        "neon": Architecture.NEON,
        "avx2": Architecture.AVX2,
    }

    try:
        config = Config()
        config.palette = rgb_palette
        config.mapping = mapping_dict[mapping_lower]
        config.quantLevel = quantization
        config.transparencyThreshold = alpha_threshold
        config.architecture = arch_dict[architecture.lower()]
        if uses_palettized:
            config.formula = formula_dict[formula.lower()]
        if uses_smoothed:
            validate_weighting_kernel(weighting_kernel)
            config.anisotropic_kernel = VALID_WEIGHTING_KERNELS[
                weighting_kernel.upper()
            ]
            validate_smoothed_scale(smoothed_l_scale)
            validate_smoothed_scale(smoothed_a_scale)
            validate_smoothed_scale(smoothed_b_scale)
            config.anisotropic_labScales = (
                smoothed_l_scale,
                smoothed_a_scale,
                smoothed_b_scale,
            )
            if kernel_lower == "gaussian":
                validate_smoothed_shape(smoothed_shape_parameter)
                config.anisotropic_shapeParameter = smoothed_shape_parameter
            elif kernel_lower == "inverse_distance_power":
                validate_smoothed_power(smoothed_power_parameter)
                config.anisotropic_powerParameter = smoothed_power_parameter
    except ValueError as e:
        console.print(f"[bold red]Configuration Error:[/bold red] {e}")
        sys.exit(1)
    except KeyError as e:
        console.print(
            f"[bold red]Configuration Error:[/bold red] Invalid choice for option: {e}"
        )
        sys.exit(1)

    resize_requested = any(param is not None for param in [width, height, scale])
    target_width, target_height = 0, 0

    if not silent:
        details_table = Table(show_header=False, expand=False, box=None)
        details_table.add_column("Parameter", style="cyan", justify="right")
        details_table.add_column("Value", style="green")
        details_table.add_row("Input File", input_file)
        details_table.add_row("Output File", output)
        details_table.add_row("Palette", f"{palette_name} ({len(rgb_palette)} colors)")
        details_table.add_row("Mapping", mapping)
        details_table.add_row("Quantization", str(quantization))
        details_table.add_row("Alpha Threshold", str(alpha_threshold))
        details_table.add_row("Architecture", architecture.upper())
        if uses_palettized:
            details_table.add_row("Color Formula", formula)
        if uses_smoothed:
            details_table.add_row("Weighting Kernel", weighting_kernel.upper())
            details_table.add_row(
                "Smoothed Lab Scales",
                f"L*: {smoothed_l_scale}, a*: {smoothed_a_scale}, b*: {smoothed_b_scale}",
            )
            if kernel_lower == "gaussian":
                details_table.add_row(
                    "Smoothed Shape (Gaussian)", str(smoothed_shape_parameter)
                )
            elif kernel_lower == "inverse_distance_power":
                details_table.add_row(
                    "Smoothed Power (InvDist)", str(smoothed_power_parameter)
                )
        if resize_requested:
            resize_str = []
            if scale:
                resize_str.append(f"Scale: {scale}")
            if width:
                resize_str.append(f"Width: {width}px")
            if height:
                resize_str.append(f"Height: {height}px")
            details_table.add_row("Resize Request", ", ".join(resize_str))
        console.print(Panel(details_table, title="Configuration", style="bold blue"))

    start_time = time.perf_counter()
    original_width, original_height = 0, 0
    result = None
    with Status(
        f"Palettifying {file_type.lower()}...", console=console, spinner="dots"
    ) as status:
        try:
            if is_gif_file:
                status.update(f"Loading GIF...")
                result = GIF(input_file)
                original_width, original_height = result.width(), result.height()
                if resize_requested:
                    target_width, target_height = calculate_dimensions(
                        original_width, original_height, width, height, scale
                    )
                    status.update(f"Resizing GIF to {target_width}x{target_height}...")
                    result.resize(target_width, target_height)
                else:
                    target_width, target_height = original_width, original_height
                status.update(f"Applying palette to GIF...")
                core_palettify(result, config)
            else:
                status.update(f"Loading image...")
                result = Image(input_file)
                original_width, original_height = result.width(), result.height()
                if resize_requested:
                    target_width, target_height = calculate_dimensions(
                        original_width, original_height, width, height, scale
                    )
                    status.update(
                        f"Resizing image to {target_width}x{target_height}..."
                    )
                    result.resize(target_width, target_height)
                else:
                    target_width, target_height = original_width, original_height
                status.update(f"Applying palette to image...")
                core_palettify(result, config)
            status.update(f"Writing output to {output}...")
            result.write(output)
        except Exception as e:
            console.print(f"\n[bold red]Error:[/bold red] Processing failed: {e}")
            sys.exit(1)
    end_time = time.perf_counter()
    processing_time = end_time - start_time
    complete_message = (
        f"[bold green]Palettifying Complete![/bold green]\n"
        f"[cyan]Time Taken:[/cyan] {format_time(processing_time)}"
    )
    console.print(Panel(complete_message, style="bold green"))
    results_table = Table(show_header=False, header_style="bold magenta")
    results_table.add_column("Metric", justify="right")
    results_table.add_column("Value", style="bold green")
    results_table.add_row("Output File", output)
    try:
        output_size = os.path.getsize(output)
        size_change = output_size - input_size
        size_change_percent = (size_change / input_size * 100) if input_size > 0 else 0
        size_change_str = (
            f"{format_size(abs(size_change))} "
            f"({'increase' if size_change > 0 else 'reduction'}) "
            f"({size_change_percent:+.1f}%)"
        )
        results_table.add_row("Output Size", format_size(output_size))
        results_table.add_row("Size Change", size_change_str)
    except FileNotFoundError:
        results_table.add_row(
            "Output Size", "[red]Error reading output file size[/red]"
        )
    except Exception as e:
        results_table.add_row("Output Size", f"[red]Error: {e}[/red]")
    if resize_requested and (
        target_width != original_width or target_height != original_height
    ):
        width_change = (
            ((target_width - original_width) / original_width * 100)
            if original_width > 0
            else 0
        )
        height_change = (
            ((target_height - original_height) / original_height * 100)
            if original_height > 0
            else 0
        )
        results_table.add_row(
            "Output Dimensions",
            f"{target_width}x{target_height} "
            f"({width_change:+.1f}% W, {height_change:+.1f}% H)",
        )
    if is_gif_file and result and hasattr(result, "frame_count"):
        try:
            results_table.add_row("Frame Count", str(result.frame_count()))
        except Exception:
            results_table.add_row("Frame Count", "[red]N/A[/red]")
    console.print("[bold]Results:[/bold]")
    console.print(results_table)


@cli.command(name="list-palettes")
def list_palettes_cmd():
    """Lists all available default and custom palettes."""
    list_palettes()


@cli.command(name="save-palette")
@click.argument(
    "json_file", type=click.Path(exists=True, readable=True, dir_okay=False)
)
@click.option(
    "--id",
    help="Override the 'id' field from the JSON file with this value. Must be unique and not conflict with default palettes.",
)
def save_palette(json_file: str, id: Optional[str]):
    """Saves a custom palette JSON file to the user directory."""
    ensure_custom_palettes_dir()
    try:
        with open(json_file, "r") as f:
            data = json.load(f)

        json_id = data.get("id")
        final_id = id if id else json_id

        if not final_id:
            raise ValueError(
                "Palette ID must be provided via the --id option or exist as an 'id' key in the JSON file."
            )
        if not isinstance(final_id, str) or not final_id.strip():
            raise ValueError("Palette ID cannot be empty.")

        final_id = final_id.strip()

        _, _ = parse_palette_json(json_file)

        try:
            with resources.path(PACKAGE_NAME, DEFAULT_PALETTES_DIR) as dir_path:
                for fname in os.listdir(dir_path):
                    if not fname.endswith(".json"):
                        continue
                    default_palette_path = os.path.join(dir_path, fname)
                    try:
                        with open(default_palette_path, "r") as default_f:
                            default_data = json.load(default_f)
                            default_id = default_data.get("id", fname.rsplit(".", 1)[0])
                            if default_id.lower() == final_id.lower():
                                console.print(
                                    f"[bold red]Error:[/bold red] Palette ID '{final_id}' conflicts with a default palette ID ('{default_id}'). "
                                    f"Default palette IDs cannot be overridden."
                                )
                                console.print(
                                    "Please choose a different ID using the --id option or modify the 'id' in your JSON."
                                )
                                sys.exit(1)
                    except Exception:
                        continue
        except FileNotFoundError:
            pass
        except Exception as e:
            console.print(
                f"[yellow]Warning:[/yellow] Could not check for default palette ID conflicts: {e}"
            )

        custom_palette_path = CUSTOM_PALETTES_DIR / f"{final_id}.json"
        if custom_palette_path.exists():
            console.print(
                f"[bold yellow]Warning:[/bold yellow] Custom palette with ID '{final_id}' already exists ({custom_palette_path})."
            )
            if not click.confirm("Do you want to overwrite it?"):
                console.print("Operation cancelled.")
                sys.exit(0)

        data["id"] = final_id
        data["isDefault"] = False

        with open(custom_palette_path, "w") as out_f:
            json.dump(data, out_f, indent=4)

        console.print(
            f"[bold green]Palette '{final_id}' saved successfully to {custom_palette_path}[/bold green]"
        )

    except json.JSONDecodeError as e:
        console.print(
            f"[bold red]Error:[/bold red] Invalid JSON file '{json_file}': {e}"
        )
        sys.exit(1)
    except ValueError as e:
        console.print(f"[bold red]Error:[/bold red] Failed to save palette: {e}")
        sys.exit(1)
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] An unexpected error occurred: {e}")
        sys.exit(1)


def main():
    ensure_custom_palettes_dir()
    cli()


if __name__ == "__main__":
    main()
