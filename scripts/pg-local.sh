#!/usr/bin/env bash
# Levanta un Postgres local descartable para los tests de la API (sin Docker).
# Imita lo mínimo de Supabase: roles anon/authenticated/service_role y auth.users.
# Uso: scripts/pg-local.sh start|stop|reset      URL: postgres://postgres@127.0.0.1:54329/magnate
set -euo pipefail
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
DATA=${PGDATA_DIR:-/tmp/el-magnate-pg}
PORT=${PGPORT:-54329}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }

start() {
  if [ ! -d "$DATA" ]; then
    mkdir -p "$DATA"; [ "$(id -u)" = 0 ] && chown postgres "$DATA"
    as_pg "$PGBIN/initdb -D $DATA -U postgres --auth=trust -E UTF8 >/dev/null"
  fi
  if ! as_pg "$PGBIN/pg_ctl -D $DATA status" >/dev/null 2>&1; then
    as_pg "$PGBIN/pg_ctl -D $DATA -l $DATA/log -o '-p $PORT -k /tmp -c listen_addresses=127.0.0.1' -w start" >/dev/null
  fi
  if ! psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc "select 1 from pg_database where datname='magnate'" | grep -q 1; then
    psql -h 127.0.0.1 -p "$PORT" -U postgres -qc "create database magnate"
    psql -h 127.0.0.1 -p "$PORT" -U postgres -d magnate -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/supabase-shim.sql"
    for f in "$ROOT"/supabase/migrations/*.sql; do
      psql -h 127.0.0.1 -p "$PORT" -U postgres -d magnate -q -v ON_ERROR_STOP=1 -f "$f"
    done
  fi
  echo "postgres://postgres@127.0.0.1:$PORT/magnate"
}
stop() { as_pg "$PGBIN/pg_ctl -D $DATA -m fast stop" >/dev/null 2>&1 || true; }
case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  reset) stop; rm -rf "$DATA"; start ;;
esac
