#!/bin/bash
# poker-server 시작 스크립트
# 포트 3003 정리 후 서버 시작

PORT=3003

echo "=== 포커 서버 시작 ==="

# 기존 프로세스 종료
echo "기존 프로세스 정리 중..."
lsof -ti :$PORT 2>/dev/null | xargs -r kill -9 2>/dev/null
sleep 2

# 포트 확인
if lsof -i :$PORT 2>/dev/null | grep -q LISTEN; then
  echo "❌ 포트 $PORT 가 여전히 사용 중입니다"
  lsof -i :$PORT 2>/dev/null
  exit 1
fi

echo "✅ 포트 $PORT 비어있음"

# 서버 시작
cd /home/z/my-project/mini-services/poker-server
echo "서버 시작 중..."
exec bun run index.ts
