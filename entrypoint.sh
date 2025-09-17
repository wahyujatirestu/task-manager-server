cat > entrypoint.sh <<'EOF'
#!/bin/sh
set -e

# fallback values
DB_HOST=${POSTGRES_HOST:-db}
DB_PORT=${POSTGRES_PORT:-5432}
DB_USER=${POSTGRES_USER:-postgres}

echo "=> entrypoint: waiting for Postgres at $DB_HOST:$DB_PORT (user $DB_USER)"

RETRY=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1
do
  RETRY=$((RETRY+1))
  echo "Postgres not ready yet (attempt: $RETRY) — sleeping 1s..."
  if [ "$RETRY" -ge 60 ]; then
    echo "Postgres did not become ready in time, aborting."
    exit 1
  fi
  sleep 1
done

echo "Postgres is up. Running prisma generate..."
npx prisma generate

echo "Running prisma migrate deploy (apply pending migrations)..."
# If no migrations, this will be a no-op
npx prisma migrate deploy || true

if [ "$RUN_SEED" = "true" ]; then
  echo "RUN_SEED=true — running prisma seed..."
  npm run prisma:seed || true
fi

echo "Starting application: exec $@"
exec "$@"
EOF

# buat executable
chmod +x entrypoint.sh
