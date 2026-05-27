# Funções MySQL para bases tenant_* (evita pipes diretos do cliente mysql, que podem segfault).
# Uso: source após definir MYSQL_CONTAINER e MYSQL_ROOT_PASSWORD.

drop_all_tenant_databases() {
  local dbs db
  dbs="$(
    command docker exec "${MYSQL_CONTAINER}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
      --batch --skip-column-names -e \
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'tenant_%';" \
      2>/dev/null || true
  )"
  while IFS= read -r db; do
    [[ -z "${db:-}" ]] && continue
    echo "    DROP $db"
    command docker exec "${MYSQL_CONTAINER}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e \
      "DROP DATABASE IF EXISTS \`${db}\`;"
  done <<< "$dbs"
}

tenant_database_exists() {
  local db_name="$1"
  local count
  count="$(
    command docker exec "${MYSQL_CONTAINER}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
      --batch --skip-column-names -e \
      "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${db_name}';" \
      2>/dev/null | tr -d '[:space:]'
  )"
  [[ "${count:-0}" == "1" ]]
}
