#!/bin/bash
# build-wasm.sh - Build the WASM package with SIMD optimization

set -e

cd wasm
RUSTFLAGS='-C target-feature=+simd128' wasm-pack build --target bundler --out-dir ../web/src/wasm/pkg --release
