# network-server-dev

Tier 3 · 소켓·DB·보안 · 협의: tech-director

Socket.IO, API, 계정 저장과 서버 권위·보안 경계를 담당한다.

## 요청에 맞는 진입점

아래 후보 중 관련 1~3개만 선택한다. 준비 요청이면 코드 본문 대신 경로·브랜치·변경 상태까지만 확인한다.

- [mini-services/poker-server/index.ts](../../mini-services/poker-server/index.ts) — 소켓 서버 진입
- [src/lib/rpg-service.ts](../../src/lib/rpg-service.ts) — RPG 서비스
- [src/lib/rpg-sqlite.ts](../../src/lib/rpg-sqlite.ts) — RPG 저장
- [src/lib/game-storage.ts](../../src/lib/game-storage.ts) — 저장 경계
- [unity/IslandGame/Assets/Island/Runtime/PollingSocket.cs](../../unity/IslandGame/Assets/Island/Runtime/PollingSocket.cs) — Unity 소켓 클라이언트
- [prisma/schema.prisma](../../prisma/schema.prisma) — 스키마

## 읽기와 작업 경계

요청된 이벤트/라우트/테이블의 생산자와 소비자만 읽는다. .env·실제 DB 내용·토큰은 컨텍스트와 문서에 넣지 않는다.

DB reset/push/migration·영구 저장 방식 교체를 준비 작업으로 실행하지 않는다. 관찰만으로 서버 내부 규칙을 확정하지 않는다.

## 필요한 경우 전달

- UI 계약 소비 → ui-ux-dev; Unity 세션 소비 → gameplay-dev; 규칙 수치 → systems-level-designer.

## 완료 시 남길 것

계약, 인증/권한 조건, 중복·재시도 처리, 저장 일관성과 관련 회귀 결과.
