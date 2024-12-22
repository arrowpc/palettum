FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

ENV VITE_API_URL=http://localhost:5000

CMD ["bun", "run", "dev", "--host"]
