import importlib.resources as resources
import json
import os
import sys
import time
from typing import List, Optional, Tuple

import rich_click as click
from rich.console import Console
from rich.status import Status
from rich.table import Table

from palettum import GIF, RGB, Architecture, Config, Formula, Image, Mapping, palettify

console = Console()

PACKAGE_NAME = "palettum"
DEFAULT_PALETTES_DIR = "palettes"


def parse_palette_json(palette_path: str) -> Tuple[List[RGB], str]:
    """Parse a JSON palette file and return the list of RGB colors and palette name."""
    with open(palette_path, "r") as f:
        data = json.load(f)

    if "name" not in data:
        raise ValueError("JSON must contain a 'name' key")
    if "colors" not in data:
        raise ValueError("JSON must contain a 'colors' key")

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
    """Parse scale input as either 'Nx' (e.g., 0.5x) or 'N%' (e.g., 50%)"""
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
    """Calculate new dimensions based on width, height, and scale"""
    original_aspect = original_width / original_height
    target_width, target_height = original_width, original_height

    if scale is not None:
        scale_factor = parse_scale(scale)
        target_width = int(original_width * scale_factor)
        target_height = int(original_height * scale_factor)

    if width is not None and height is not None:
        return (width, height)
    elif width is not None:
        return (width, int(width / original_aspect))
    elif height is not None:
        return (int(height * original_aspect), height)

    return (target_width, target_height)


ARCH_TO_STR = {
    Architecture.SCALAR: "SCALAR",
    Architecture.NEON: "NEON",
    Architecture.AVX2: "AVX2",
}


def get_default_architecture() -> str:
    """Return the default system architecture as a string"""
    config = Config()
    return ARCH_TO_STR.get(config.architecture, "SCALAR")


def format_size(size: float) -> str:
    """Format file size in bytes to a human-readable string"""
    if size < 1024:
        return f"{size:.2f} B"
    elif size < 1024 * 1024:
        return f"{size / 1024:.2f} KB"
    else:
        return f"{size / (1024 * 1024):.2f} MB"


def list_default_palettes() -> None:
    """List and print all default palettes"""
    with resources.path(PACKAGE_NAME, DEFAULT_PALETTES_DIR) as dir_path:
        palette_files = [
            fname for fname in os.listdir(dir_path) if fname.endswith(".json")
        ]

        if not palette_files:
            console.print("[bold red]No default palettes found.[/bold red]")
            sys.exit(1)

        table = Table(title="Default Palettes")
        table.add_column("ID", style="cyan", no_wrap=True)
        table.add_column("Name", style="green")
        table.add_column("Source", style="yellow")
        for fname in palette_files:
            palette_path = os.path.join(dir_path, fname)
            try:
                with open(palette_path, "r") as f:
                    data = json.load(f)
                    palette_id = data.get("id", fname.rstrip(".json"))
                    palette_name = data.get("name", "Unknown")
                    palette_source = data.get("source", "Unknown")
                table.add_row(
                    palette_id,
                    palette_name,
                    f"[link={palette_source}]{palette_source}[/link]",
                )
            except Exception as e:
                table.add_row(fname.rstrip(".json"), f"Error reading file: {e}")
        console.print(table)
    sys.exit(0)


def find_palette_by_id(palette_id: str) -> str:
    """Search for a default palette JSON file by matching its 'id' field.
    Returns the path to the palette if found; otherwise, raises ValueError."""
    with resources.path(PACKAGE_NAME, DEFAULT_PALETTES_DIR) as dir_path:
        for fname in os.listdir(dir_path):
            if not fname.endswith(".json"):
                continue
            palette_path = os.path.join(dir_path, fname)
            try:
                with open(palette_path, "r") as f:
                    data = json.load(f)
                    if data.get("id", "").lower() == palette_id.lower():
                        return palette_path
            except Exception:
                continue
        raise ValueError(
            f"[bold red]Palette '{palette_id}' not found in default palettes.[/bold red]\n"
            f"Try running [bold green]palettum --list-palettes[/bold green] to see the available default palettes."
        )


@click.command()
@click.argument(
    "input_file", type=click.Path(exists=True, readable=True), required=False
)
@click.option(
    "-o",
    "--output",
    type=click.Path(),
    show_default=True,
    help="Output file (defaults to '<input>_palettified.<ext>')",
)
@click.option(
    "-p",
    "--palette",
    help="Palette ID or path to a JSON palette file",
)
@click.option(
    "-m",
    "--mapping",
    type=click.Choice(["ciede", "rbf-i", "rbf-p"], case_sensitive=False),
    default="ciede",
    show_default=True,
    help="Color mapping: 'ciede' (closest match), 'rbf-i' (smoothed direct), 'rbf-p' (smoothed then matched)",
)
@click.option(
    "-q",
    "--quantization",
    type=click.IntRange(0, 5),
    default=2,
    show_default=True,
    help="Quantization level: 0 = best quality, 5 = fastest",
)
@click.option(
    "-t",
    "--alpha-threshold",
    type=click.IntRange(0, 255),
    default=0,
    show_default=True,
    help="Alpha threshold: below this, pixels turn transparent",
)
@click.option(
    "-s",
    "--sigma",
    type=float,
    default=50.0,
    show_default=True,
    help="Smoothing factor for RBF mappings ('rbf-i' or 'rbf-p')",
)
@click.option(
    "-f",
    "--formula",
    type=click.Choice(["cie76", "cie94", "ciede2000"], case_sensitive=False),
    default="ciede2000",
    show_default=True,
    help="Color formula: 'cie76' (fast), 'cie94' (balanced), 'ciede2000' (accurate)",
)
@click.option(
    "-a",
    "--architecture",
    type=click.Choice(["scalar", "neon", "avx2"], case_sensitive=False),
    default=get_default_architecture(),
    show_default=True,
    help="Processing architecture (auto-detected)",
)
@click.option(
    "--width",
    type=click.IntRange(1),
    help="Desired width in pixels (maintains aspect ratio if height unset)",
)
@click.option(
    "--height",
    type=click.IntRange(1),
    help="Desired height in pixels (maintains aspect ratio if width unset)",
)
@click.option(
    "--scale",
    type=str,
    help="Scale factor (e.g., '0.5x' or '50%' for half size, '2x' for double size)",
)
@click.option(
    "--silent",
    is_flag=True,
    help="Run in silent mode (no terminal output)",
)
@click.option(
    "--list-palettes",
    is_flag=True,
    default=False,
    help="List all default palettes and exit",
)
def palettum(
    input_file: Optional[str],
    output: str,
    palette: Optional[str],
    mapping: str,
    quantization: int,
    alpha_threshold: int,
    sigma: float,
    formula: str,
    architecture: str,
    width: Optional[int],
    height: Optional[int],
    scale: Optional[str],
    silent: bool,
    list_palettes: bool,
):
    """
    Palettum: Map an image or GIF's colors to a custom RGB palette.

    If --list-palettes is provided, the list of default palettes is printed and
    the program exits.
    """
    if list_palettes:
        list_default_palettes()

    if input_file is None:
        raise click.UsageError("Missing argument 'INPUT_FILE'. See --help.")

    if silent:
        console.quiet = True

    is_gif_file = input_file.lower().endswith(".gif")
    file_type = "GIF" if is_gif_file else "Image"
    input_size = os.path.getsize(input_file)

    if palette and os.path.isfile(palette):
        palette_path = palette
    elif palette:
        try:
            palette_path = find_palette_by_id(palette)
        except ValueError as e:
            console.print(f"[bold red]Error:[/bold red] {e}")
            sys.exit(1)
    else:
        console.print(
            "[bold red]Error:[/bold red] Palette must be specified (via -p/--palette)."
        )
        sys.exit(1)

    try:
        rgb_palette, palette_name = parse_palette_json(palette_path)
    except Exception as e:
        if not silent:
            console.print(f"[bold red]Error:[/bold red] Failed to parse palette: {e}")
        sys.exit(1)

    resize_requested = any(param is not None for param in [width, height, scale])

    if not silent:
        details_table = Table(show_header=False, expand=False)
        details_table.add_column("Parameter", style="cyan")
        details_table.add_column("Value", style="green")
        details_table.add_row("Palette", f"{palette_name} ({len(rgb_palette)} colors)")
        details_table.add_row("Mapping", mapping)
        if mapping.lower() in ["rbf-i", "rbf-p"]:
            details_table.add_row("Sigma", str(sigma))
        details_table.add_row("Quantization", str(quantization))
        details_table.add_row("Alpha threshold", str(alpha_threshold))
        if mapping.lower() in ["ciede", "rbf-p"]:
            details_table.add_row("Formula", formula)
        details_table.add_row("Architecture", architecture)
        if resize_requested:
            if scale:
                details_table.add_row("Scale", scale)
            if width:
                details_table.add_row("Width", f"{width}px")
            if height:
                details_table.add_row("Height", f"{height}px")
        console.print("\n[bold]Processing Configuration:[/bold]")
        console.print(details_table)

    mapping_dict = {
        "ciede": Mapping.CIEDE_PALETTIZED,
        "rbf-i": Mapping.RBF_INTERPOLATED,
        "rbf-p": Mapping.RBF_PALETTIZED,
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

    config = Config()
    config.palette = rgb_palette
    config.mapping = mapping_dict[mapping.lower()]
    config.quantLevel = quantization
    config.transparencyThreshold = alpha_threshold
    config.sigma = sigma
    config.formula = formula_dict[formula.lower()]
    config.architecture = arch_dict[architecture.lower()]

    if output is None:
        base, ext = os.path.splitext(input_file)
        if is_gif_file:
            output = f"{base}_palettified.gif"
        else:
            output = (
                f"{base}_palettified.jpg"
                if mapping.lower() == "rbf-i"
                else f"{base}_palettified.png"
            )

    if not silent:
        console.print("\n[bold]Processing...[/bold]")
        with Status(
            f"Working on {file_type.lower()}...", console=console, spinner="dots"
        ) as status:
            start_time = time.perf_counter()
            try:
                if is_gif_file:
                    gif = GIF(input_file)
                    original_width, original_height = gif.width(), gif.height()
                    if resize_requested:
                        target_width, target_height = calculate_dimensions(
                            original_width, original_height, width, height, scale
                        )
                        original_aspect = original_width / original_height
                        new_aspect = target_width / target_height
                        if abs(
                            original_aspect - new_aspect
                        ) / original_aspect > 0.05 and not (width and height):
                            console.print(
                                "[bold yellow]Warning:[/bold yellow] Aspect ratio change >5% detected."
                            )
                        status.update(
                            f"Resizing GIF to {target_width}x{target_height}..."
                        )
                        gif.resize(target_width, target_height)
                    result = palettify(gif, config)
                else:
                    img = Image(input_file)
                    original_width, original_height = img.width(), img.height()
                    if resize_requested:
                        target_width, target_height = calculate_dimensions(
                            original_width, original_height, width, height, scale
                        )
                        original_aspect = original_width / original_height
                        new_aspect = target_width / target_height
                        if abs(
                            original_aspect - new_aspect
                        ) / original_aspect > 0.05 and not (width and height):
                            console.print(
                                "[bold yellow]Warning:[/bold yellow] Aspect ratio change >5% detected."
                            )
                        status.update(
                            f"Resizing image to {target_width}x{target_height}..."
                        )
                        img.resize(target_width, target_height)
                    result = palettify(img, config)
                result.write(output)
            except Exception as e:
                console.print(f"[bold red]Error:[/bold red] Processing failed: {e}")
                sys.exit(1)
            end_time = time.perf_counter()
            processing_time = end_time - start_time
    else:
        start_time = time.perf_counter()
        try:
            if is_gif_file:
                gif = GIF(input_file)
                original_width, original_height = gif.width(), gif.height()
                if resize_requested:
                    target_width, target_height = calculate_dimensions(
                        original_width, original_height, width, height, scale
                    )
                    gif.resize(target_width, target_height)
                result = palettify(gif, config)
            else:
                img = Image(input_file)
                original_width, original_height = img.width(), img.height()
                if resize_requested:
                    target_width, target_height = calculate_dimensions(
                        original_width, original_height, width, height, scale
                    )
                    img.resize(target_width, target_height)
                result = palettify(img, config)
            result.write(output)
        except Exception as e:
            sys.exit(1)
        end_time = time.perf_counter()
        processing_time = end_time - start_time

    if not silent:
        output_size = os.path.getsize(output)
        size_change = input_size - output_size
        size_change_str = f"{format_size(abs(size_change))} ({'increased' if size_change < 0 else 'reduced'})"
        console.print("\n[bold]Results:[/bold]")
        console.print(f"[bold]Output:[/bold] {output}")
        console.print(f"[bold]Size:[/bold] {format_size(output_size)}")
        console.print(
            f"[bold]Original Dimensions:[/bold] {original_width}x{original_height}"
        )
        if resize_requested:
            width_change = (
                ((target_width - original_width) / original_width * 100)
                if original_width
                else 0
            )
            height_change = (
                ((target_height - original_height) / original_height * 100)
                if original_height
                else 0
            )
            console.print(
                f"[bold]Resized To:[/bold] [green]{target_width}x{target_height}[/green] "
                f"([green]{width_change:+.1f}%[/green] width, [green]{height_change:+.1f}%[/green] height)"
            )
        if is_gif_file and hasattr(gif, "frame_count"):
            console.print(f"[bold]Frame Count:[/bold] {gif.frame_count()}")
        console.print(f"[bold]Time Taken:[/bold] {processing_time:.2f} seconds")


def main():
    palettum()


if __name__ == "__main__":
    main()
