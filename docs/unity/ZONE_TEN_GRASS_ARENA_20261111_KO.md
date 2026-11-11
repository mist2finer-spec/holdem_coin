# 10구역 원형 초원 보스 전장 — 2026-11-11

현재 10구역은 실제 `MountZone10`이다. 입구의 짧은 사이드뷰 길이 잔디 전장으로 끝나고, 바위 31개가 원형 경계를 이룬다. 보스 등장 후 쿼터뷰 자유 이동으로 전투하며, 체력 2000 보스를 처치한 뒤 열린 출구를 따라 마을 문 안으로 들어가면 미궁 탈출 팝업이 열린다. 완료 뒤 11구역이나 이전 Nature 보스 맵은 없다. 별도 보스 연습용 Nature 에셋은 유지한다.

## 구현

- 기존 지형 메시를 구역 전용 에셋으로 복제해 중앙을 평탄화했다. 지형 정점 색의 길 마스크를 입구 이후 제거하고 잔디 배치를 다시 만들었다. 공유 지형/재질은 바꾸지 않았다.
- 중심 월드 X/Z `(24,3)`, 바위 배치 반경 11.5m, 전투 이동 반경 10.5m. 앞쪽 바위 높이를 낮춰 시야를 확보했다. 입구 양옆 틈은 실제 캡처 후 추가 바위로 보강했다.
- 지형 콜라이더에서 높이 그리드(89×69, 0.5m 간격)와 바위 장애물을 추출해 TypeScript 권위 판정과 Unity가 같은 데이터를 사용한다. 실제 메시 레이캐스트와 캐릭터 발 높이 차이: 초원 중앙 약 0.0000012m.
- 걷기/구르기/슬라이딩/점프가 원형 경계를 넘지 못한다. 보스 사망 후에만 마을 방향 통로가 열린다. 자동 이동과 수동 X/Z 입력 모두 기존 입력 경로를 사용한다.
- 3m 사이드뷰 입장과 기존 보스 등장·걷기 모션은 유지한다. 새 초원 맵의 빈 `rooms` 배열에서도 카메라 경계와 피해 숫자가 오류 없이 동작하게 수정했다.
- 보스 처치 직후 팝업을 띄우지 않으며, 잔여 원소 투사체/보스 공격을 종료한다. 출구 이동은 걷기이고 마지막 마을 진입 지점 도착으로 완료한다.
- 기존 검격·물방울·상단 낙뢰/젬 단계별 지면 확산을 같은 전장에 유지했다. 이번 작업은 젬 피해 범위 성장이나 새 VFX를 추가하지 않는다.

## 검증

결과: **PASS**(Editor 및 Android 에뮬레이터).

- `npm run check:rpg`, `npm run unity:training:kernel` 및 전투/권위/커널/API 회귀 **29/29 PASS**. 원형 이동 경계 4동작×5방향, 정상 입력 보스 처치, 정지 중 미완료, 마을 입장 완료, 완료 후 추가 진행 없음 포함.
- 소스와 Unity JS 번들 전체 10구역 진행 일치: 일반 몬스터 270마리, 마지막 보스, 마을 도착 완료.
- Editor 실제 9→10구역: 4942프레임, 8단계 PASS, 오류 0건, 네트워크 요청 0건. 임의 체력/좌표/카메라 주입 없이 포인터 스틱과 스킬 명령으로 검증했다.
- Android 9 / BlueStacks: 4814프레임, 8단계 PASS, 오류 0건, 네트워크 요청 0건.
- 보스 구간의 활성 Mount 씬 1개, 이전 Nature 환경 0개. 보스 처치 시 출구 개방·팝업 없음, 마을 도착 시 팝업 있음을 검사했다.
- APK `G:\holdem_coin-workspace\island\builds\IslandGame-ZoneTenArena-20261111.apk` · 147189014 bytes · ARM64 · 서명/ZIP 무결성/16KB 정렬 PASS. SHA256 `bbeeb0245ad7eb034075f29277e3a98556f31d60c6d9dcb65dba6ffb9b0f12c2`.
- 테스트 버전 `0.1.0-test.20261111.4`, code `2026111104`, 개발 패키지 `com.mist2finer.islandgame.dev`. 운영 배포는 하지 않았다. 실제 Android 휴대폰·장시간 발열/성능은 미검증이다.

## 화면 검토

기존 Mount 지형의 녹색 잔디·밝은 돌·복숭아색 하늘과 따뜻한 주광/푸른 보조광을 유지했다. 별도 팔레트, Cinemachine, 새 패키지는 도입하지 않았다. 기존 URP/커스텀 카메라에 맞춰 전장 프리셋만 조정했다. 첫 캡처에서 입구가 넓게 비는 것을 보고 양옆 바위를 보강했고, 로딩 직후 잘못된 프레임을 잡던 검증 타이밍도 수정했다.

palette discipline: 3/5 — 기존 잔디/바위/하늘 재질 유지; 돌의 밝은 면은 강한 편.
style uniformity: 3/5 — 기존 원경과 초원 재질을 연결; 기존 거인/플레이어 자산은 유지.
lighting depth: 3/5 — 따뜻한 직사광과 푸른 그림자, 바위와 거인 명암 확인.
silhouette: 3/5 — 분홍 머리 플레이어와 거인 식별 가능; 넓은 전장 카메라에서 플레이어는 작다.
UI intentionality: 3/5 — 기존 금색/암청색 HUD 유지, 입장/전투/마을 이동 안내와 완료 문구 변경.
feedback visibility: 4/5 — 하늘 끝 낙뢰, 지면 링, 피해 숫자와 열린 출구 확인.

Unity 스킬 `unity-cli`, `craft-game-floors`, `ui-ugui` 적용. 검토 참고: craft `art-direction.md`, `camera-rigs.md`, `visual-scorecard.md`. 기존 카메라/아트 방향을 유지했으며 전체 오디오·UI 재설계는 범위 밖이다. API 문서: [Mesh.colors](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/mesh/colors), [Camera.fieldOfView](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/camera/fieldofview), [runInBackground](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/application/runinbackground).

증거: [Editor 기록](evidence/zone10-grass-arena-20261111/editor-report.json), [입구](evidence/zone10-grass-arena-20261111/editor-side-entry.png), [원형 전장](evidence/zone10-grass-arena-20261111/editor-quarter-movement.png), [번개](evidence/zone10-grass-arena-20261111/editor-lightning-in-grass.png), [마을 도착](evidence/zone10-grass-arena-20261111/editor-village-arrived.png).

Editor에는 Play를 종료하고 MountZone10 Scene 뷰를 열어뒀다. 검사 전용 root 활성화·임시 조명은 씬 에셋에 저장하지 않았다. runInBackground=false 복구. 새 씬의 404개 렌더러에서 누락/기본/미지원 재질 0개: [검사 기록](evidence/zone10-grass-arena-20261111/scene-palette-check.json).

[지형 전체 보기](evidence/zone10-grass-arena-20261111/arena-overview.png) · [Android 검증 기록](evidence/zone10-grass-arena-20261111/device-report.json) · [APK 검증](evidence/zone10-grass-arena-20261111/apk-validation.json).
