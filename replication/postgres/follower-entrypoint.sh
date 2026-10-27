#!/bin/sh
set -e

if [ -z "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
  echo ">> Data dir trống, chờ leader sẵn sàng..."
  until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"; do sleep 2; done

  echo ">> Chạy pg_basebackup từ leader..."
  echo "db:5432:replication:replicator:$REPLICATION_PASSWORD" > ~/.pgpass
  chmod 600 ~/.pgpass
  PGPASSWORD="$REPLICATION_PASSWORD" pg_basebackup \
    -h db -p 5432 -U replicator \
    -D "$PGDATA" -R -X stream -S follower_slot -P

  chmod 700 "$PGDATA"
fi

exec docker-entrypoint.sh postgres -c hot_standby=on