<p align="center">
  <a href="https://palettum.com" target="_blank">
    <img src="https://i.nuuls.com/ibW4Z.png" alt="palettum logo" width="100" />
  </a>
</p><h1 align="center">palettum</h1><p align="center">
  Palettum is a color remapping tool for images and GIFs.<br>
  It lets you apply any custom palette by either snapping each pixel to its closest color (ideal for pixel-art styles), blending the palette as a filter for a smoother effect, or both.
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

> **Settings used:**  
> `--mapping smoothed-palettized  --smoothing-style idw  --lab-scales 10.0, 10.0, 2.0`
>
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
cargo build -p palettum-cli
```

The executable will be located in the `target/debug/` directory (or `target/release/` if you add the `--release` flag).

### WebAssembly (WASM) for Web App

The web application uses a WebAssembly module compiled from the Rust code.

1.  **Build the WASM package:**
    Run the build script from the project root. This script compiles the Rust code to WASM and places the necessary files into the `web/src/wasm/pkg` directory.

    ```bash
    ./build-wasm.sh # won't work on windows, script content will be moved to package.json scripts soon™
    ```

2.  **Set up the web frontend:**
    The web frontend is located in the `web/` directory and uses Bun.

    *   Navigate to the web directory:
        ```bash
        cd web
        ```
    *   Install dependencies:
        ```bash
        bun install
        ```
    *   Run the development server:
        ```bash
        bun run dev
        ```

---
## References
* The main color difference formula (CIEDE2000) was implemented through the help of this paper:
https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ciede2000noteCRNA.pdf.  The rest were easy to implement through the color difference wiki: https://en.wikipedia.org/wiki/Color_difference.
* The fast trig approximation functions were inspired/taken from:
  * atan / atan2: https://mazzo.li/posts/vectorized-atan2.html
  * sin: Basic taylor series https://en.wikipedia.org/wiki/Taylor_series
  * cos: https://github.com/milianw/cosine/tree/parabola-approx
  * exp: https://stackoverflow.com/questions/47025373/fastest-implementation-of-the-natural-exponential-function-using-sse
* Smoothing was done with basic L* a* b* interpolation using:
  * IDW: https://en.wikipedia.org/wiki/Inverse_distance_weighting
  * Gaussian: https://dsp.stackexchange.com/questions/36954/gaussian-weighted-distance-between-pixel-amplitudes-motivations-and-sources

---

