# Unity 보스 모션·조작·Nature 맵 수정 — 2026-11-06 최종

상태: **PASS** — 실제 Unity 프로젝트 적용, PC 독립 Player 본 변화, 세로 Play 조작, 서버 배포, Android APK 빌드·서명 검증 완료. **UNAVAILABLE** — Android 실기기 실행·발열·장시간 성능 검증(ADB 기기 미연결).

작업 프로젝트는 `G:/new_project/IslandGame`, Unity 6000.0.62f1, Built-in 렌더러다. 웹 화면·웹 RogueEngine·경제 규칙은 변경하지 않았다. 서버 수정은 Unity 전용 `/api/rpg/unity-boss` 엔진에 한정한다.

## 적용 결과

- 보스의 T포즈 원인은 실제로 `rig_v001/Root/...` 클립 바인딩과 `Root/...` 프리팹의 불일치였다. 원본 GLB는 보존하고, 바인딩 접두부를 제거한 별도 `_Bound.anim`을 생성했다.
- `RuntimeAnimationPlayer`가 대상 루트에 Animator를 확보하고 수동 PlayableGraph로 서버 시간의 자세를 평가한다. 플레이어·슬라임·보스의 런타임 `SampleAnimation` 호출을 제거했다. 두 입력 AnimationMixer로 공격 전환을 0.18초(보스) / 0.12초(일반 모델) 동안 블렌딩한다.
- 기존 검증은 클립 이름만 확인했으므로 실제 본 재생의 증거가 부족했다. 이번에는 Editor와 독립 Player 모두 본 Transform의 변화 및 누락 바인딩을 검사했다. 이전 문서의 ‘보스 모션 확인’ 주장은 이 결과로 대체한다.
- 제공된 hook combo와 throw 모션을 사용한다. 원본에 없는 Idle/Walk는 공격 준비 자세에서 파생한 임시 호흡·걷기 모션이다. 별도 Hit/Death/Roar 원본을 추가했다고 주장하지 않는다.
- 보스 높이 13 → **6.5m**, 충돌 반경 2.8 → **1.4m**, 훅 도달 거리 9 → **4.5m**, 폭발 반경 2.4 → **1.2m**로 줄였다. 훅은 2.2초 동안 0.85/1.55초에 일반 공격 두 번이다.
- 투척은 노란 원을 표시하고 **2초 후** 원 안의 플레이어에게 스킬 피해를 준다. 0.45초 비행, 1.2초까지 넘어짐, 총 1.8초에 기상한다. 기존 Pink Glass 리타깃 피격 클립을 사용한다. 체력은 플레이어 100만(최소 1), 보스 10억의 훈련 설정이며 영구 보상은 지급하지 않는다.

## 2D / 쿼터뷰 조작

Side25D에서는 스틱의 X 성분만 이동에 사용한다. 좌상/좌하로 밀어도 깊이 방향으로 움직이지 않는다. QuarterView에서는 스틱을 카메라 기준 좌우·전후의 평면 벡터로 변환한다. 대각선 속도는 정규화하고, 공격·구르기·점프·슬라이드·넉백에도 평면 방향을 전달한다. 보스의 추적과 폭발 판정도 X/Z 두 축을 사용한다.

보스 구역 진입 시 `360°` 스틱으로 전환한다. 중앙 스틱과 11시/1시 구르기, 7시 점프/5시 슬라이드의 넓은 배치는 유지했다. 보스에서 멀어지면 카메라의 보스 가중치를 점차 줄여 플레이어가 맵을 돌아다닐 때 화면 밖으로 벗어나지 않도록 했다.

## 원본 Nature 맵과 구역 흐름

`Low Poly Environment - Nature Free - LOWPOLY MEDIEVAL FANTASY SERIES`의 `Environment_Free.unity` 중앙 Terrain, 원래 다리·강·소품·나무 배치를 사용한다. 주변에 반복된 Terrain 타일 8개는 제외한다. 원본 패키지와 원본 씬은 보존했다. Unity 보스 모드에서는 임시 상자 지형, 생성 절벽·바닥, 배경 블록 및 임의 나무 배치를 만들지 않는다.

플레이어 시작 X=12m → 슬라임 평지(좌우 이동) → 원본 다리 X=21.758~26.242m → X=26.7m에서 보스 생성·QuarterView 전환. 다리를 늘리거나 별도 무대를 연결하지 않는다. 보스 구역 이동 범위는 원본 동쪽 맵 **X=26.7~87m, Z=-38~53m**다. 원본 Terrain 높이와 나무 기둥 장애물을 서버 판정에 연결했다.

원본 나무 525개는 원래 위치를 유지한 12m 단위 69개 프리팹으로 나눴다. 38m 안쪽 구역을 비동기 요청하고 52m 밖의 인스턴스를 해제한다. 프레임당 최대 한 묶음 생성과 10.83ms 예산 제어를 적용한다. 원거리 인스턴스 해제가 즉각적인 전체 에셋 메모리 해제를 보장하는 것은 아니다.

식생의 복사 재질에서 과한 투과광과 바람을 낮추고, 주요 광원·보조 광원을 조정했다. 보스 재질은 약간 따뜻하게 하고 광택을 줄였다. 결과 화면은 아래 증거에 첨부했다. 미술 완성도에 대한 최종 판단은 플레이 감상과 별개다.

## 카메라 및 바닥 세팅 가이드

전체 코드는 [BattleCameraController.cs](client-source-snapshot/2026-11-06/Runtime/BattleCameraController.cs)에 있다. `CameraPivot → Main Camera` 리그와 `ViewMode { Side25D, QuarterView, TopDown1945 }`를 유지한다.

- Side25D: Perspective 기준 FOV 18°, Pitch 10°, 거리 -28, 기본 피벗 Y +2. 실제 전투 viewport 하단 18%에 발밑 바닥이 놓이도록 보정한다. 9:16보다 좁은 화면에서도 가로 가시 폭을 보존하도록 수직 FOV를 역산한다.
- 좌우 선행 2.8m, 방향 확인 0.12초 또는 이동 0.35m, 속도 추가 선행 최대 2m. SmoothDamp 가속/감속 0.18/0.35초, 작은 점프 데드존 1.2m, 바닥 높이 추적 0.15초다.
- `SetChamberBounds(minX,maxX,active)`로 전투 구역을 제한한다. 다리 이동에서는 제한을 풀고 다음 구역으로 넘긴다.
- `SetViewMode(ViewMode.QuarterView,bossTarget)`는 1.2초 전환, Pitch 42°/Yaw 12°/FOV 35°, 피벗 (0,1.2,2.5)다. 근접 시 플레이어 0.65/보스 0.35 가중 중심과 렌더러 경계로 거리를 맞춘다. 이 6.5m 보스 씬의 최대 거리는 40m로 조정했다.
- 보스와 12m 이내에서는 듀얼 프레이밍, 12~24m에서는 보스 영향이 점차 줄고 먼 탐색에서는 플레이어를 따른다. `SetViewMode(ViewMode.Side25D)`로 좌우 선행 추적으로 돌아간다.
- Pitch 25° 이상에서 플레이어를 가리는 전경 식생·구조물의 렌더러를 일시 숨기고 복원한다. 원본 재질이나 충돌 판정은 변경하지 않는다.

**현재 씬:** Nature의 충분한 깊이를 가진 실제 Terrain을 사용하므로 별도 Skirt Mesh는 생성하지 않는다. 이전 절차식 바닥 보강은 이 모드에서 비활성화되어 있다. 하단 UI 뒤까지 Terrain이 보이는지는 Side/Quarter 실제 화면으로 확인했다.

**다른 얇은 Ground 메시를 다시 쓸 경우:** 지면 윗면은 유지하고 카메라 방향 Z 깊이를 확보한 후, 전면 가장자리 정점을 아래로 약 12m 복제해 세로 면과 양 끝을 연결한다. 법선·bounds를 갱신하고 길쭉한 세로 화면과 최대 줌아웃에서 확인한다. 장식용 치마에는 Collider가 필요 없다. 현재 Nature 맵에는 이 수동 절차를 중복 적용하지 않는다.

## 재생성 / 연결

실제 프로젝트의 기존 Pink Glass, glTFast, Polytope 패키지와 GUID를 유지한다. 원격 `unity/IslandGame` 최소 프로젝트로 전체 덮어쓰지 않는다. [소스 스냅샷](client-source-snapshot/2026-11-06/)은 독립 실행 프로젝트가 아니다.

1. Terrain 및 Terrain Physics 모듈을 사용한다. 스냅샷 `Packages`는 실제 프로젝트의 참고 설정이다.
2. `Editor/PrepareAnimations.cs`의 `PrepareAnimations.Main`으로 바인딩을 교정하고 임시 Idle/Walk 및 `UnityBossAssets` 참조를 만든다.
3. `Editor/PrepareMap.cs`의 `PrepareNatureMap.Main`, 다음 `PreparePalette.Main`을 실행한다. 원본 맵을 보존한 프리팹·나무 묶음·복사 재질을 생성한다.
4. 생성한 `nature-map.json`의 높이/다리/장애물 데이터를 서버 `src/lib/generated/unity-nature-map.json`에 함께 반영한다. 클라이언트와 서버의 좌표/높이 버전을 맞춘다.
5. 실행 예: `unity command script run --project-path G:/new_project/IslandGame --caller plugin --skill unity-cli --format json -- --file <스크립트 경로> --entry PrepareAnimations.Main`. CLI의 외부 success 외에 내부 스크립트 success도 확인한다.

## 검증 증거

- [Editor 본 검사](verification/boss-runtime-20261106/editor-poses.json): 9개 클립 PASS, 누락 바인딩 0. 콤보/투척 각각 18개 본 변화.
- [Windows 독립 Player](verification/boss-runtime-20261106/player-poses.json): `isEditor=false`, 9개 클립 PASS, 오류 0. 콤보 18본/123.609°, 투척 18본/87.592° 변화. Editor에서만 작동하는지의 문제를 별도로 확인했다.
- [1080×2340 Play 검사](verification/boss-runtime-20261106/play-review.json): 68초·3,826프레임, 터치 대각선 Side 이동·Quarter 전후/좌우 이동·실제 보스 팔 회전·6개 전투 상태·오류 없음 검사 모두 PASS.
- PC Editor 계측 p95 CPU 4.990ms / GPU 4.551ms. 최대 CPU 359.878ms / GPU 135.334ms에는 초기 로드와 동기 화면 캡처가 포함되므로 모든 프레임이 10.83ms 이하라는 뜻은 아니다. Android 60fps·발열 목표는 실기기 계측이 남아 있다.
- Unity 서버 22개, 성장 58, 하이브리드 30, 방치 65, 스테이지 동기화 8, 포커 245, 프로필 3개 테스트 PASS. RPG/포커/UI TypeScript 및 실제 HTTP/Socket.IO smoke PASS.
- [GitHub CI](https://github.com/mist2finer-spec/holdem_coin/actions/runs/42332121025) PASS. Linux CI의 stage kernel 생성 일치 검사도 통과했다. 로컬 junction 경로 때문에 발생했던 메타데이터 차이는 런타임 번들 변경이 아니었다.
- [운영 서버 smoke](verification/boss-runtime-20261106/production-smoke.json): health 200, 151요청, 슬라임→다리→보스→경고→폭발→넘어짐→기상 PASS. 경고부터 폭발까지 2초. 체력 유지·훈련 모드·영구 보상 없음 확인.
- [APK 검사](verification/boss-runtime-20261106/apk-validation.json): Android ARM64 IL2CPP, Development, Portrait, 버전 `0.1.0-test.20261106.2` / `2026110602`. 빌드 오류/경고 0, ZIP CRC·서명·16KB ZIP 정렬·인터넷 권한 PASS. Android 실기기 실행은 ADB 기기 미연결로 미검증이다.

화면: [Side](verification/boss-runtime-20261106/side.png) · [다리](verification/boss-runtime-20261106/bridge.png) · [Quarter](verification/boss-runtime-20261106/quarter.png) · [경고](verification/boss-runtime-20261106/warning.png) · [넘어짐](verification/boss-runtime-20261106/knockdown.png) · [기상](verification/boss-runtime-20261106/getup.png).

## 배포 / 전달

[PR #7](https://github.com/mist2finer-spec/holdem_coin/pull/7)이 main에 병합되었다. 코드와 운영 서버 리비전은 `ffde9d1a33b1931c3aa09fe72bc5ef7f4df8213c`다. Render **Test place**의 `dep-dbn9bdm8bjmc73a1gq2g`는 live이며 `/api/release`에서 동일 리비전을 확인했다. 이 문서와 검증 증거의 후속 커밋은 런타임 변경 없이 `[skip render]`로 보관한다.

설치 파일: `G:/new_project/IslandGame/Builds/Android/IslandGame-Test-Boss-Nature-Fix-20261106.apk` — 116,909,567 bytes (약 111.5 MiB).

SHA-256: `ae8dc59086f1816d933462e93550f05d7bc5b4ae14ef7ee0e13c492c2daf713a`.

보고서: `G:/new_project/meele_ref/Unity_Boss_Runtime_Fix_20261106.pdf`. 전체 카메라 코드도 같은 폴더의 `BattleCameraController.cs`에 전달한다. 이전 APK/PDF는 기록으로 보존하고 이번 Nature-Fix APK를 사용한다.

변경 전 파일은 `.island-backups/boss-runtime-fix-20261106/`에 보관했다. 미저장 씬은 디스크 원본과 열린 상태를 각각 백업한 뒤 저장했다. 테스트 계정/서버 설정과 GameView 크기를 복원하고 Play를 종료했다. 강제 tick/background override도 해제했다.
