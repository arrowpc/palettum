FROM rustembedded/cross:aarch64-unknown-linux-gnu

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git build-essential yasm pkg-config

ENV PKG_CONFIG_ALLOW_CROSS=1
ENV PKG_CONFIG_PATH=/usr/aarch64-linux-gnu/lib/pkgconfig:/usr/aarch64-linux-gnu/share/pkgconfig

RUN git clone --depth 1 --branch n6.0 https://github.com/FFmpeg/FFmpeg.git /ffmpeg && \
    cd /ffmpeg && \
    ./configure \
        --prefix=/usr/aarch64-linux-gnu \
        --enable-shared \
        --disable-static \
        --cross-prefix=aarch64-linux-gnu- \
        --arch=aarch64 \
        --target-os=linux \
        --disable-x86asm \
        --disable-doc \
        --disable-programs \
        --disable-avdevice \
        --disable-swresample \
        --disable-postproc \
        --disable-indevs \
        --disable-outdevs \
        --disable-ffprobe \
        --disable-ffmpeg && \
    make -j$(nproc) && \
    make install && \
    cd / && rm -rf /ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        clang-8 libclang-8-dev libc6-dev

ENV BINDGEN_EXTRA_CLANG_ARGS="--target=aarch64-unknown-linux-gnu --sysroot=/usr/aarch64-linux-gnu"
RUN ln -s /usr/include/asm-generic /usr/include/asm
