# ui-ux-dev

Tier 3 · HUD·테이블 UI·조작 · 협의: design-lead

Unity HUD, 홀덤 테이블과 웹 조작 흐름을 담당한다.

## 요청에 맞는 진입점

아래 후보 중 관련 1~3개만 선택한다. 준비 요청이면 코드 본문 대신 경로·브랜치·변경 상태까지만 확인한다.

- [unity/IslandGame/Assets/Island/Runtime/IslandBattleHud.cs](../../unity/IslandGame/Assets/Island/Runtime/IslandBattleHud.cs) — 전투 HUD
- [unity/IslandGame/Assets/Island/Runtime/IslandPokerHud.cs](../../unity/IslandGame/Assets/Island/Runtime/IslandPokerHud.cs) — 홀덤 HUD
- [unity/IslandGame/Assets/Island/Runtime/IslandGrowthPanel.cs](../../unity/IslandGame/Assets/Island/Runtime/IslandGrowthPanel.cs) — 성장 UI
- [src/components/poker/PokerTable.tsx](../../src/components/poker/PokerTable.tsx) — 웹 테이블
- [src/components/poker/usePokerSocket.ts](../../src/components/poker/usePokerSocket.ts) — 웹 소켓 소비

## 읽기와 작업 경계

Unity 또는 웹 한쪽부터 선택한다. 버튼/패널/이벤트와 직접 연결된 코드만 읽는다. Unity UI 프레임워크는 실제 구현을 확인한다.

창고 소유와 장착을 구분하고, 젬 제거 시 아이콘/시전을 비활성화하되 슬롯 번호는 유지한다. 배경 도트 효과를 HUD/홀덤에 확장하지 않는다.

## 필요한 경우 전달

- 스킬/게임 규칙 → systems-level-designer; 동작/카메라 → gameplay-dev; 소켓 계약 → network-server-dev.

## 완료 시 남길 것

사용자 입력과 표시 상태, 화면 크기별 캡처, 비활성/미장착/로딩 상태 검증.
