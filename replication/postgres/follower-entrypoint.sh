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

# Sync replication: leader chờ application_name='follower' (xem
# synchronous_standby_names ở docker-compose.yml db command).
# pg_basebackup -R không ghi application_name, và volume cũ từ thời async
# cũng thiếu nó — nên patch mỗi lần start, không chỉ lúc basebackup.
AUTO_CONF="$PGDATA/postgresql.auto.conf"
if [ -f "$AUTO_CONF" ] && grep -q "^primary_conninfo" "$AUTO_CONF"; then
  if grep -q "application_name" "$AUTO_CONF"; then
    sed -i "s/application_name=[^ ']*/application_name=follower/g" "$AUTO_CONF"
  else
    sed -i "s/^primary_conninfo = '\(.*\)'$/primary_conninfo = '\1 application_name=follower'/" "$AUTO_CONF"
  fi
fi

exec docker-entrypoint.sh postgres -c hot_standby=on