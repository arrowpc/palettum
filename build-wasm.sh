#!/bin/bash
# build-wasm.sh - Build the WASM package with SIMD optimization

set -e

cd wasm
RUSTFLAGS='--cfg=web_sys_unstable_apis -C target-feature=+simd128' wasm-pack build --target bundler --out-dir ../web_new/src/wasm/pkg --release
