#!/bin/sh
set -eu
# Xvfb fornece a tela; Openbox processa pedidos de tela cheia e foco.
: "${DISPLAY:?Execute com xvfb-run ou uma sessão X11 de teste}"
mkdir -p test-results
openbox --sm-disable >test-results/openbox.log 2>&1 &
studyroom_openbox_pid=$!
trap 'kill "$studyroom_openbox_pid" 2>/dev/null || true' EXIT INT TERM
studyroom_attempt=0
until xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q 'window id'; do
  studyroom_attempt=$((studyroom_attempt + 1))
  if [ "$studyroom_attempt" -ge 30 ] || ! kill -0 "$studyroom_openbox_pid" 2>/dev/null; then
    cat test-results/openbox.log
    exit 1
  fi
  sleep 1
done
"$@"
