#!/bin/sh
set -eu
# Executar dentro de um ambiente Linux de teste com Weston instalado.
export XDG_RUNTIME_DIR="$(mktemp -d /tmp/studyroom-wayland.XXXXXX)"
export WAYLAND_DISPLAY=studyroom-test
export STUDYROOM_TEST_PLATFORM=wayland
mkdir -p test-results
# A saída padrão (1024 × 640) fica menor que a janela mínima com decoração.
weston --backend=headless-backend.so --width=1366 --height=768 --use-pixman --socket="$WAYLAND_DISPLAY" --idle-time=0 --no-config >test-results/weston.log 2>&1 &
studyroom_weston_pid=$!
trap 'kill "$studyroom_weston_pid" 2>/dev/null || true' EXIT INT TERM
studyroom_attempt=0
until [ -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; do
  studyroom_attempt=$((studyroom_attempt + 1))
  if [ "$studyroom_attempt" -ge 30 ] || ! kill -0 "$studyroom_weston_pid" 2>/dev/null; then
    cat test-results/weston.log
    exit 1
  fi
  sleep 1
done
"$@"
