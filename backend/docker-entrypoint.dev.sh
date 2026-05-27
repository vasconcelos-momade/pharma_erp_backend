#!/usr/bin/env sh
set -e

# Prisma generate fails on VirtualBox shared folders (vboxsf) when removing old files.
# docker-compose mounts named volumes over .../generated so output stays on a native FS.
flock -w 120 /tmp/prisma-generate.lock sh -c '
  bunx prisma generate --schema=src/infrastructure/prisma/central/schema.prisma
  bunx prisma generate --schema=src/infrastructure/prisma/tenant/schema.prisma
'

exec "$@"
