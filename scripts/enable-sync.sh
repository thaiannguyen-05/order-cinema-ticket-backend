#!/bin/sh
# Bật sync replication SAU khi leader init xong và follower đã streaming.
# Lý do phải làm riêng bước này: synchronous_standby_names không được set
# lúc boot (entrypoint truyền "$@" cho temp server init => CREATE DATABASE
# kẹt chờ standby vĩnh viễn, xem comment trong docker-compose.yml db.command).
# ALTER SYSTEM persist vào $PGDATA/postgresql.auto.conf nên sống qua restart.
set -e

NAMES="${SYNC_STANDBY_NAMES:-FIRST 1 (follower)}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-order_cinema_db}"

echo ">> Chờ leader sẵn sàng..."
until docker exec order-cinema-db pg_isready -U "$DB_USER" -d postgres >/dev/null 2>&1; do sleep 2; done

echo ">> Bật synchronous_standby_names='$NAMES'..."
docker exec order-cinema-db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER SYSTEM SET synchronous_standby_names = '$NAMES';" \
  -c "SELECT pg_reload_conf();"

echo ">> Kiểm tra:"
docker exec order-cinema-db psql -U "$DB_USER" -d postgres \
  -c "SHOW synchronous_standby_names;" \
  -c "SELECT application_name, state, sync_state FROM pg_stat_replication;"
