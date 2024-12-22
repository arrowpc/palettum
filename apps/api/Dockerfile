FROM --platform=linux/arm64 python:3.12-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y \
    cmake \
    build-essential \
    git \
    curl \
    zip \
    unzip \
    tar \
    pkg-config \
    ninja-build \
    make \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY core ./core
COPY api ./api

RUN cd core/external/vcpkg && \
    rm -f ./vcpkg && \
    VCPKG_FORCE_SYSTEM_BINARIES=1 ./bootstrap-vcpkg.sh -disableMetrics

ENV VCPKG_FORCE_SYSTEM_BINARIES=1
ENV CC=/usr/bin/gcc
ENV CXX=/usr/bin/g++
ENV PYTHONPATH=/app/core:/app

RUN pip install --no-cache-dir -r core/requirements.txt && \
    cd core && pip install .

WORKDIR /app/api
ENV FLASK_APP=run.py
ENV FLASK_ENV=development

CMD ["flask", "run", "--host=0.0.0.0"]
