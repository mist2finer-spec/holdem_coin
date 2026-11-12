# gameplay-dev

Tier 3 · 전투·캐릭터·카메라 · 협의: tech-director

액션 입력, 캐릭터 표시, 전투 흐름과 카메라를 구현한다.

## 요청에 맞는 진입점

아래 후보 중 관련 1~3개만 선택한다. 준비 요청이면 코드 본문 대신 경로·브랜치·변경 상태까지만 확인한다.

- [unity/IslandGame/Assets/Island/Runtime/Battle3DView.cs](../../unity/IslandGame/Assets/Island/Runtime/Battle3DView.cs) — 전투 표시 진입
- [unity/IslandGame/Assets/Island/Runtime/RuntimeAnimationPlayer.cs](../../unity/IslandGame/Assets/Island/Runtime/RuntimeAnimationPlayer.cs) — 애니메이션/포즈
- [unity/IslandGame/Assets/Island/Runtime/BattleCameraController.cs](../../unity/IslandGame/Assets/Island/Runtime/BattleCameraController.cs) — 카메라
- [unity/IslandGame/Assets/Island/Runtime/NativeCombatPresentation.cs](../../unity/IslandGame/Assets/Island/Runtime/NativeCombatPresentation.cs) — 행동 표시
- [src/lib/rpg-mount-sunday-engine.ts](../../src/lib/rpg-mount-sunday-engine.ts) — 이동/전투 권위 로직

## 읽기와 작업 경계

액션/카메라 중 요청한 파일 1~3개에서 심볼 검색 후 필요한 호출자만 확장한다. 최신 추가 파일은 CURRENT의 게임 기준 브랜치에서 확인.

일반 구역 Side25D/보스 QuarterView 규칙과 기존 전투 타이밍을 보존한다. 포즈 제한을 월드 이동·판정 시간 제한으로 바꾸지 않는다.

## 필요한 경우 전달

- 스킬 수치/재화 → systems-level-designer; 조명/머티리얼 → technical-artist.
- 서버 권위/계약 → network-server-dev; HUD 입력 배치 → ui-ux-dev.

## 완료 시 남길 것

수정 심볼, 입력→상태→표시 흐름, 관련 회귀 및 Side25D/QuarterView 실제 확인 결과.
