#!/usr/bin/env bash
# Spins up a throwaway local PostgreSQL, applies a Supabase shim + every
# migration, then runs the Row Level Security test suite.
# Requires PostgreSQL 15+ binaries (initdb, pg_ctl, psql) on PATH or in
# /usr/lib/postgresql/<ver>/bin.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DATA="$HERE/.pgdata"
PORT="${RITUAL_TEST_PGPORT:-54329}"
# PostgreSQL refuses to run as root; drop to an unprivileged user if needed.
AS=()
if [ "$(id -u)" = "0" ]; then
  PGUSER_OS="${RITUAL_PG_OS_USER:-postgres}"
  AS=(runuser -u "$PGUSER_OS" --)
fi
rm -rf "$DATA"; mkdir -p "$DATA"
[ ${#AS[@]} -gt 0 ] && chown "$PGUSER_OS" "$DATA"
"${AS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
trap '"${AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
PSQL=("$PGBIN/psql" -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$HERE/supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "→ re-applying seed (should be a no-op)"
"${PSQL[@]}" -f "$ROOT"/supabase/migrations/20261023000003_seed_library.sql 2>&1 | grep -q "skipping" && echo "  seed is idempotent"
echo "→ running RLS tests"
"${PSQL[@]}" -o /dev/null -f "$HERE/rls_test.sql" 2>&1 | sed -E "s/^psql:[^ ]+ NOTICE:  //"
