FROM rustembedded/cross:riscv64gc-unknown-linux-gnu

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
     pkg-config \
     libavutil-dev libavcodec-dev libavformat-dev \
     libavdevice-dev libswscale-dev libswresample-dev \
     libpostproc-dev libclang-dev \
 && rm -rf /var/lib/apt/lists/*

ENV PKG_CONFIG_ALLOW_CROSS=1
