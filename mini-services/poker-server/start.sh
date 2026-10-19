#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# One foreground process. Let the hosting service own restart and shutdown.
# Never kill an arbitrary process using the port.
exec node --import tsx index.ts
