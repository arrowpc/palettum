FROM oven/bun:1-alpine AS builder

WORKDIR /app

RUN apk add --no-cache curl build-base

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown
RUN cargo install wasm-pack wasm-bindgen-cli

COPY web/package.json web/bun.lockb ./web/
COPY web/patches ./web/patches/
COPY Cargo.toml Cargo.lock Cross.toml ./

WORKDIR /app/web
RUN bun install --frozen-lockfile

WORKDIR /app
COPY core core/
COPY wasm wasm/
COPY web web/
COPY cli cli/
copy palettes palettes/

WORKDIR /app/web
RUN bun run wasm:build
RUN apk add --no-cache nodejs npm
RUN bun run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
