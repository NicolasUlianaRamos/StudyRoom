#!/bin/sh
set -eu
# Weston precisa de um seat com teclado para testar foco e atalhos nativos.
# O Xvfb hospeda apenas o compositor; Electron continua usando Wayland.
if [ "${STUDYROOM_WESTON_HOST:-}" != x11 ]; then
  export STUDYROOM_WESTON_HOST=x11
  exec xvfb-run --auto-servernum --server-args="-screen 0 1600x1000x24" \
    sh scripts/x11-test.sh sh "$0" "$@"
fi
: "${DISPLAY:?Weston X11 precisa do display virtual}"
export XDG_RUNTIME_DIR="$(mktemp -d /tmp/studyroom-wayland.XXXXXX)"
export WAYLAND_DISPLAY=studyroom-test
export STUDYROOM_TEST_PLATFORM=wayland
mkdir -p test-results
weston --backend=x11-backend.so --width=1366 --height=768 --use-pixman --socket="$WAYLAND_DISPLAY" --idle-time=0 --no-config >test-results/weston.log 2>&1 &
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
# Ativa a janela que fornece entrada ao compositor antes de abrir o Electron.
studyroom_weston_window=$(timeout 15s xdotool search --sync --onlyvisible --class weston | head -n 1)
[ -n "$studyroom_weston_window" ]
timeout 15s xdotool windowactivate --sync "$studyroom_weston_window"
xdotool mousemove --window "$studyroom_weston_window" 680 384
# Falha na preparação, com diagnóstico útil, se o compositor não oferecer seat.
timeout 15s wayland-info >test-results/wayland-info.log 2>&1
if ! grep -q "wl_seat" test-results/wayland-info.log; then
  cat test-results/wayland-info.log
  echo "Weston não disponibilizou entrada para os testes de teclado." >&2
  exit 1
fi
"$@"
