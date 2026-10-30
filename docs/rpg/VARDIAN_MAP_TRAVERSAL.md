# 바르디안 이동 연결 → 웹 고저차 구역

2026-10-30. 평평한 점프/슬라이드 교대 통로를 고저차가 있는 전투 구역으로 변경했다.

## 원본에서 확인한 내용

`MapEntityReactorActionMove`는 출발점에서 waypoint로 이동한 뒤 linkedReactor의 destination으로 이동한다. `MapEntityReactorActionMoveType`은 None=0, Slide=1, Jump=2, JumpClimb=3이다. 동일한 Jump 타입으로 상승·하강·수평 이동을 처리한다.

업로드된 `vardian-map-graph-20261027-104034 (2).zip`의 **serialized-file까지 포함한 참조**로 684개 방향 연결을 해소했다. Jump 457, JumpClimb 141, Slide 86개다. 활성 계층이고 deactivate가 아닌 출발점은 각각 145, 48, 32개다. 양방향 링크는 두 건으로 집계된다. 활성 상태는 모든 스테이지에서 실제 발동한다는 뜻이 아니다.

| 동작 | 원본 사례의 월드 좌표 (X,Y,Z) | 웹에서 적용 |
|---|---|---|
| 틈 점프 | (-4,-5,9) → (-4,-5,15) | 같은 높이의 끊어진 바닥 |
| 하강 점프 | (-4,3,-5) → (-4,-5,-1) | 192px 낮은 착지대 |
| 상승 점프 | (-4,11,-35) → (-4,15,-32) | 96px 높은 착지대 |
| 연속 상승 | (-4,21,-29) → (-4,29,-25) | 192px 상승, 중간 발판 2개 |
| 슬라이드 | (-4,21,-45) → (-4,21,-39) | 낮은 석조 통로 |

전체 출발/도착 객체 ID, 부모 Transform 합성 결과, 번들/ZIP 해시는 [추출 근거](vardian-traversal-evidence.json)에 있다. 씬 이름은 기존 config index의 보조 라벨이다. 컨테이너 누락을 무시하고 정확한 씬 이름이라고 확정하지 않는다.

### 코드 근거와 한계

- C# export의 `MapEntityReactorActionMove.cs`: JumpHeight=3, Gravity=9.8, JumpTimeScale=3, JumpClimbStepHeight=3.5, JumpClimbStepStayTime=0.1, SlideSpeed=15.
- 네이티브 `ProcessJump` 토큰 `0x6000392`: 경과 시간 ×3, Y의 이차식 이동, 목적지 도달 시 위치 고정과 점프 애니메이션 상태 갱신.
- `ProcessJumpClimb` `0x6000393`: 중간 지점의 위치/속도 재계산, 0.1초 대기, 단계별 애니메이션 갱신.
- `MoveToDestination` `0x6000390`: 원본은 충돌 레이캐스트로 상승 경유 지점을 찾는다. 웹에서는 생성한 유효 발판을 명시적으로 사용한다.
- `ProcessSlide` `0x6000391`: 속도 ×dt, 목적지 도달 시 좌표 고정.
- `CalculateVelocity` `0x6000396`의 제공된 네이티브 덤프는 빈 결과다. 웹의 초기 속도 계산은 위 상수와 표준 탄도식을 이용한 어댑터이며, 해당 함수 전체를 복원했다고 주장하지 않는다.

## 적용 구조

- `traversal.ts`: 24px/Unity 단위 투영, 탄도/속도/중간 대기 평가. 서버가 이동 위치·높이와 공중 높이를 결정한다.
- `map.ts`: 10개 전투 구역의 높이를 분리하고 틈은 비보행 지형으로 지정한다. 열린 출구는 서버가 지정한 이동으로만 건넌다.
- `engine.ts`: 전멸 → 출구 접근 → 해당 점프/슬라이드 → 착지 확인 → 다음 구역 생성. AUTO와 수동 입력이 같은 경로를 사용한다. 중간 발판에서는 다음 구역을 미리 생성하지 않는다.
- `renderer.ts`: 바닥·몬스터·발 접점을 같은 구역 높이로 투영한다. 카메라는 지형 높이를 부드럽게 따라간다. 출구 개방 후에는 틈 너머 착지대를 보여준다. 홍의 jump1~5/sliding1~2를 재사용한다.
- 기존 점프/슬라이드 버튼과 하단 UI는 유지한다. 점프 버튼으로 틈·상승·하강·연속 상승을 수행한다.

10구역의 순서, 구역 폭, 수평 통로 폭, 중간 발판의 세부 배치는 **웹 테스트용 구성**이다. 원본 Map002_001의 3D 메시/충돌/레이캐스트 전체를 그대로 이식한 것이 아니다. 원본의 동작 종류·고저차 사례·이동 상수를 근거로 적용했다. 원본 파일은 수정하지 않았다.

## 검증과 재현

```sh
python scripts/rpg/extract_action_move.py --graph-zip INPUT.zip --legacy-audit ORIGINAL_AUDIT --output docs/rpg/vardian-traversal-evidence.json
npm run test:rpg:rogue
npm run test:rpg
npm run check:rpg
node node_modules/next/dist/bin/next build --webpack
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/rpg/preview-rogue.mjs OUTPUT_DIR
```

이동/전투 테스트 22개, 기존 RPG 135개, 타입 검사와 운영 빌드 통과. 100개 시드의 발판 연결·바닥 충돌, 30개 시드의 AUTO 전체 완주, 수동 완주, 5종 이동의 정확한 착지/중간 대기/생성 시점, 잘못된 버튼·보행 우회 차단, 중복 요청을 검사했다. 실제 렌더러로 5종 통과 화면도 확인했다.

형식 검증은 실행하지 않았다. 기존 동기 서버/요청 순서 계약은 유지하며 새 유한 이동 상태와 중복 착지를 결정론적 단위·회귀 테스트로 확인할 수 있어 별도 모델의 실익이 낮다고 판단했다.

## 횡스크롤 수정 — 사용자 피드백 반영

이전 배포는 타일 기반 2D 구역에 높이만 추가하여 바르디안 회랑처럼 보이지 않았고 일반 상하 이동도 남아 있었다. 이를 수정했다.

- 기본 테스트 화면은 원본 Map002_001의 `background.webp`/`foreground.webp`(메시·UV·Transform 복원 결과)와 원본 불꽃 좌표를 사용한다. 기존 바둑판식 바닥/벽 렌더링은 제거했다.
- 원본 70 Unity 단위 길이를 웹 1,680단위로 투영하고 현재 구역 높이에 발 접점을 맞춘다. 10구역은 회랑의 부분을 연결한 웹 테스트 구성이다. 다른 원본 씬의 전체 메시/충돌을 복원한 것은 아니다.
- 플레이어와 몬스터의 일반 이동은 X축 한 줄이다. 서버가 상하 입력을 무시하며, 스틱 표시도 좌우 전용이다. 자동 추적 역시 좌우로 이동한다.
- 일반 지면의 Y는 고정하고 연결 구간에서만 점프 높이와 착지 고도를 변경한다. 상승/하강/발판 오르기/낮은 통로의 기존 검사도 유지한다.
- 상하 입력 무시/대각 입력 속도/몬스터 같은 줄 배치/점프 입력 방향을 회귀 검사한다. 이동 테스트22개, 기존 RPG135개 통과.
