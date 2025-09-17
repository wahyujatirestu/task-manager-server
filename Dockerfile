
# ---------- builder ----------
FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app

# install build tools untuk modul native (argon2, prisma engine compile)
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# copy package manifest & install deps (full install so prisma CLI available)
COPY package*.json ./
RUN npm ci

# copy source
COPY . .

# generate prisma client
RUN npx prisma generate

# ---------- runner ----------
FROM node:20-bullseye-slim AS runner
WORKDIR /usr/src/app

# install minimal tools (pg_isready)
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# copy app and node_modules from builder
COPY --from=builder /usr/src/app /usr/src/app

# pastikan entrypoint executable & chown
RUN chmod +x /usr/src/app/entrypoint.sh || true
RUN chown -R node:node /usr/src/app

ENV NODE_ENV=production
EXPOSE 8800

USER node

# default: jalankan entrypoint.sh diikuti command (contoh: npm start)
CMD ["sh", "./entrypoint.sh", "npm", "start"]

