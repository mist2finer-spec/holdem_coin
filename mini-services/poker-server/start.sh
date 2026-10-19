#!/bin/bash
# poker-server 시작 스크립트 (자동 재시작 포함)
# 포트 3003 정리 후 서버 시작, crash 시 자동 재시작
# ★ Bun 대신 Node.js 사용 (socket.io 호환성)

PORT=3003
MAX_RESTART=20
RESTART_COUNT=0

echo "=== 포커 서버 시작 (자동 재시작 모드, Node.js) ==="

cleanup_port() {
  echo "기존 프로세스 정리 중..."
  lsof -ti :$PORT 2>/dev/null | xargs -r kill -9 2>/dev/null
  sleep 2
}

cleanup_port

while [ $RESTART_COUNT -lt $MAX_RESTART ]; do
  echo ""
  echo "=== 서버 시작 (시도 $((RESTART_COUNT + 1))/$MAX_RESTART) ==="

  cd /home/z/my-project/mini-services/poker-server
  # ★ Bun 대신 Node.js + tsx 사용 (socket.io 안정성)
  npx tsx index.ts

  EXIT_CODE=$?
  echo ""
  echo "⚠️ 서버가 종료되었습니다 (exit code: $EXIT_CODE)"

  if [ $EXIT_CODE -eq 0 ]; then
    echo "정상 종료, 재시작하지 않습니다"
    break
  fi

  RESTART_COUNT=$((RESTART_COUNT + 1))
  echo "🔄 3초 후 자동 재시작... ($RESTART_COUNT/$MAX_RESTART)"
  sleep 3

  cleanup_port
done

echo "=== 최대 재시작 횟수 도달, 종료 ==="
