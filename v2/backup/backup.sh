#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DOCUMENTS_DIR="${DOCUMENTS_DIR:-/documents}"
BACKUP_HOUR="${BACKUP_HOUR:-1}"
BACKUP_MINUTE="${BACKUP_MINUTE:-0}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-royalthaitouch_v2}"
PGUSER="${PGUSER:-rtt_v2}"
export PGPASSWORD="${PGPASSWORD:-}"

log() {
  printf '[%s] %s\n' "$(date --iso-8601=seconds)" "$*"
}

wait_for_database() {
  log "Waiting for PostgreSQL at ${PGHOST}:${PGPORT}/${PGDATABASE}"
  until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
    sleep 5
  done
}

run_backup() {
  wait_for_database

  local stamp temp_dir final_file checksum_file
  stamp="$(date '+%Y-%m-%d_%H-%M-%S')"
  temp_dir="${BACKUP_DIR}/.building_${stamp}"
  final_file="${BACKUP_DIR}/royalthaitouch_full_${stamp}.tar.gz"
  checksum_file="${final_file}.sha256"

  mkdir -p "$BACKUP_DIR" "$temp_dir"
  trap 'rm -rf "$temp_dir"' RETURN

  log "Creating PostgreSQL custom-format database dump"
  pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-privileges \
    --file="${temp_dir}/database.dump"

  log "Exporting database roles and global objects"
  pg_dumpall \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --globals-only \
    --file="${temp_dir}/globals.sql"

  if [[ -d "$DOCUMENTS_DIR" ]]; then
    log "Copying uploaded documents and persistent files"
    mkdir -p "${temp_dir}/documents"
    cp -a "${DOCUMENTS_DIR}/." "${temp_dir}/documents/" 2>/dev/null || true
  fi

  cat > "${temp_dir}/manifest.txt" <<EOF
application=Royal Thai Touch ERP v2
created_at=$(date --iso-8601=seconds)
timezone=${TZ:-UTC}
database=${PGDATABASE}
database_host=${PGHOST}
contains_database_dump=yes
contains_database_globals=yes
contains_documents=yes
restore_database=pg_restore --clean --if-exists --no-owner --dbname=${PGDATABASE} database.dump
EOF

  log "Compressing complete backup archive"
  tar -C "$temp_dir" -czf "$final_file" .
  sha256sum "$final_file" > "$checksum_file"
  chmod 600 "$final_file" "$checksum_file"
  rm -rf "$temp_dir"
  trap - RETURN

  log "Backup completed: $final_file"
  log "Removing backup archives older than ${RETENTION_DAYS} days"
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'royalthaitouch_full_*.tar.gz' -o -name 'royalthaitouch_full_*.tar.gz.sha256' \) \
    -mtime "+${RETENTION_DAYS}" -delete
}

seconds_until_next_run() {
  local now today_target next_target
  now="$(date +%s)"
  today_target="$(date -d "today ${BACKUP_HOUR}:${BACKUP_MINUTE}:00" +%s)"
  if (( now < today_target )); then
    next_target="$today_target"
  else
    next_target="$(date -d "tomorrow ${BACKUP_HOUR}:${BACKUP_MINUTE}:00" +%s)"
  fi
  echo $((next_target - now))
}

if [[ "${1:-}" == "--once" ]]; then
  run_backup
  exit 0
fi

log "Daily full backup scheduler started for ${BACKUP_HOUR}:$(printf '%02d' "$BACKUP_MINUTE") ${TZ:-UTC}"
while true; do
  sleep_seconds="$(seconds_until_next_run)"
  next_time="$(date -d "+${sleep_seconds} seconds" --iso-8601=seconds)"
  log "Next backup: ${next_time}"
  sleep "$sleep_seconds"
  if ! run_backup; then
    log "ERROR: backup failed; the scheduler will retry at the next daily run"
  fi
done
