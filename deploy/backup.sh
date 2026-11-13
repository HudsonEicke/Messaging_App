#!/usr/bin/env bash
# Nightly Postgres backup: dump, verify, upload encrypted to an rclone remote.
set -euo pipefail
umask 077

: "${BEACON_DIR:?BEACON_DIR is not set}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE is not set}"
LOCAL_DIR="${LOCAL_DIR:-/var/backups/beacon}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"

compose() {
    docker compose -f "$BEACON_DIR/compose.yaml" "$@"
}

name="messaging_app-$(date -u +%Y-%m-%dT%H%MZ).dump"
file="$LOCAL_DIR/$name"
partial="$file.partial"

healthcheck_ping() {
    if [[ -z "$HEALTHCHECK_URL" ]]; then
        return 0
    fi
    curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECK_URL$1" || true
}

finish() {
    local status="$1"
    rm -f "$partial"
    if [[ "$status" -eq 0 ]]; then
        healthcheck_ping ""
    else
        echo "Backup failed" >&2
        healthcheck_ping "/fail"
    fi
}

trap 'finish $?' EXIT
healthcheck_ping "/start"

mkdir -p "$LOCAL_DIR"

echo "Dumping database to $file"
compose exec -T postgres pg_dump -U postgres -Fc messaging_app > "$partial"
mv "$partial" "$file"

echo "Checking dump"
[[ -s "$file" ]] || { echo "Dump is empty" >&2; exit 1; }
compose exec -T postgres pg_restore --list < "$file" > /dev/null

echo "Uploading to $BACKUP_REMOTE"
rclone copy "$file" "$BACKUP_REMOTE" --tpslimit 5

echo "Verifying upload"
rclone cryptcheck "$LOCAL_DIR" "$BACKUP_REMOTE" --include "$name" --tpslimit 5

echo "Removing older local dumps"
find "$LOCAL_DIR" -maxdepth 1 -name 'messaging_app-*.dump' ! -name "$name" -delete

echo "Backup complete: $name"
