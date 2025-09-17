FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate

# ---------- runner ----------
FROM node:20-bullseye-slim AS runner
WORKDIR /usr/src/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app /usr/src/app

RUN chmod +x /usr/src/app/entrypoint.sh

ENV NODE_ENV=production
EXPOSE 8800

# jangan downgrade user ke "node", biar tetap bisa eksekusi script
ENTRYPOINT ["./entrypoint.sh"]
