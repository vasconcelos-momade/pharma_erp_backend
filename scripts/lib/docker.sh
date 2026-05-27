# Uso: source "$(dirname "$0")/lib/docker.sh"  (ajuste o path conforme o script)
# Encapsula docker/docker compose quando o utilizador está no grupo docker
# mas a sessão ainda não foi renovada (comum após usermod -aG docker).

if [[ -z "${SKALWAY_DOCKER_LOADED:-}" ]]; then
  SKALWAY_DOCKER_LOADED=1

  _skalway_run_docker() {
    if command docker info >/dev/null 2>&1; then
      command docker "$@"
    else
      sg docker -c "docker $(printf '%q ' "$@")"
    fi
  }

  docker() { _skalway_run_docker "$@"; }
  export -f _skalway_run_docker 2>/dev/null || true
fi
