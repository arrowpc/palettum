<p align="center">
  <a href="https://palettum.com" target="_blank">
    <img src="https://i.nuuls.com/5BwS3.png" alt="palettum logo" width="200" />
  </a>
</p><p align="center">
  Palettum is a web app and CLI tool that  lets you recolor images, GIFs, and videos with any custom palette of your choosing.<br>
  It lets you apply any custom palette by either snapping each pixel to its closest color (ideal for pixel-art styles), or blending the palette as a filter for a smoother effect.
</p><p align="center">
  <a href="https://palettum.com" target="_blank">
    <b>Try it out here</b>
  </a>
</p>

---

## Examples

> [!NOTE]
> Unfinished

#### GIF Pixel Art
> **Original artwork by [lgarabato](https://www.artstation.com/lgarabato)**

<table>
  <tr>
    <th><a href="https://www.artstation.com/artwork/Ez2OWv" target="_blank">Original</a></th>
    <th>Catppuccin</th>
    <th>Dracula</th>
    <th>Nord</th>
    <th>Gruvbox</th>
  </tr>
  <tr>
    <td><img src="https://cdnb.artstation.com/p/assets/images/images/084/095/639/original/lgarabato-vastator-wait.gif" width="150"></td>
    <td><img src="https://i.nuuls.com/B3chP.gif" width="150"></td>
    <td><img src="https://i.nuuls.com/W61pB.gif" width="150"></td>
    <td><img src="https://i.nuuls.com/EIlTw.gif" width="150"></td>
    <td><img src="https://i.nuuls.com/fhQ8_.gif" width="150"></td>
  </tr>
</table>

---

## Installation

> [!NOTE]
> Unfinished

macOS:

```bash
brew tap arrowpc/palettum
brew install palettum
```

If your system/package manager wasn't listed, you can install the precompiled binary from [releases](https://github.com/arrowpc/palettum/releases).

## Building the Project

If you want to build the project from source, follow these steps:

### CLI

To build the command-line interface (CLI) tool, run the following Cargo command from the project root:

```bash
cargo build -p cli
```

The executable will be located in the `target/debug/` directory (or `target/release/` if you add the `--release` flag).

### Web App

The web application uses a WebAssembly module compiled from Rust code.

> [!IMPORTANT]
> It is highly recommended to use `rustup` for managing Rust toolchains rather than a system-wide installation. This helps avoid potential issues, especially when compiling for `wasm32-unknown-unknown` targets.

To set up and run the web application:

1.  **Navigate to the web frontend:**
    ```bash
    cd web
    ```

2.  **Install dependencies:**
    ```bash
    bun install
    ```

3.  **Compile the WASM binary (release mode):**
    ```bash
    bun run wasm:build:release
    ```

4.  **Run the development server:**
    ```bash
    bun run dev
    ```

---

## References

- The main color difference formula (CIEDE2000) was implemented through the help of this paper:
  https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ciede2000noteCRNA.pdf. The rest were easy to implement through the color difference wiki: https://en.wikipedia.org/wiki/Color_difference.
- The fast trig approximation functions were inspired/taken from:
  - atan / atan2: https://mazzo.li/posts/vectorized-atan2.html
  - sin: Basic taylor series https://en.wikipedia.org/wiki/Taylor_series
  - cos: https://github.com/milianw/cosine/tree/parabola-approx
  - exp: https://stackoverflow.com/questions/47025373/fastest-implementation-of-the-natural-exponential-function-using-sse
- Smoothing was done with basic L* a* b\* interpolation using:
  - IDW: https://en.wikipedia.org/wiki/Inverse_distance_weighting
  - Gaussian: https://dsp.stackexchange.com/questions/36954/gaussian-weighted-distance-between-pixel-amplitudes-motivations-and-sources
- Palette extraction (adjusted for L* a* b colorspace): https://www.ece.mcmaster.ca/~xwu/cq.c

---
