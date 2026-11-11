# 원소 VFX 본게임 연결 / 10구역 보스 — 2026-11-11

사용자 요청: 실험실의 VFX를 실제 프로젝트에 적용하고 10번째 구역을 보스 지역으로 설정. 사이드뷰로 입장하여 조금 전진한 후 보스 등장과 쿼터뷰 전환. 보스 추격에는 일반 걷기. 범위 성장은 이후 젬/노드에서 구현. GitHub 푸시와 테스트 빌드.

## 적용 범위

- 메인 `Island.unity`의 마을길 전투(`MountSundayEngine`)와 기존 보스 전투(`UnityBossEngine`)에 연결했다. 별도 실험실에만 있는 기능이 아니다.
- 일반 1~9구역은 기존 지형·사이드뷰·팩 전투를 유지한다. 기존 Nature 보스 전장을 **10번째 구역**으로 사용한다. 기존 MountZone10 에셋은 보존하며, 10개 일반 구역 뒤에 11번째 보스 구역이 추가되는 진행은 제거했다. 빌드 씬 목록은 Island + 보존된 MountZone01~10, 총 11개다.
- 보스 전장 로딩 완료 전에는 전투/시간 진행이 멈춘다. 로딩 후 보스를 숨긴 사이드뷰에서 1.5m/s로 3m 걷고, 1.25초 등장 연출 중 카메라를 1.2초에 걸쳐 쿼터뷰로 보간한다. 등장 중 공격·스킬 입력을 막는다. 같은 전장 안에서 전환하며 전환 시 캐릭터를 순간이동시키지 않는다.
- 입장 캐릭터는 기존 `PinkGlass_5000.glb`의 실제 `walk_loop`를 사용한다. 보스는 `Boss_AdaptedWalk`를 사용하며 이동 거리로 재생 시각을 진행시킨다. 원신 걷기 수치를 복원했다는 의미가 아니다.
- 최신 추가 요청: **10구역 보스 처치 즉시 미궁 탈출 팝업**을 표시한다. 화면 전체의 입력을 막는 모달에서 마을 복귀 / 다시 도전을 선택한다. 완료 이후 이전 보스맵이나 11번째 구역으로 넘어가지 않는다. 추가 10초 동안 이동·공격·자동 입력을 넣어도 완료 상태와 맵이 그대로 유지되는 회귀 검사를 통과했다.

## 전투와 VFX

- 기본 공격은 5단계 검기 패턴으로 순환한다. 실제 보유한 공격 모션 1/2/3/2/1을 사용하며 기존 무기 궤적 판정과 저공 검기를 유지한다. 검기 반경은 1.05m로 고정한다.
- 실험실의 발광 코어·가는 안쪽 궤적·잔광, Fresnel 물방울과 꼬리, 번개 코어·가지·충격파를 실제 전투용 고정 풀로 옮겼다. 세계 좌표로 표시하므로 사이드뷰/쿼터뷰가 판정을 바꾸지 않는다.
- 물방울 3종: 원형 8발 / 6발씩 두 물결 / 16발 순차 회전. 반경 0.18m, 초기 속도 5.2m/s, 중력 1.1m/s², 수명 1.5초. 이동 구간 전체의 스윕 충돌과 처음부터 겹친 경우를 처리한다. 벽에 한 번 반사하고 지면 충돌 시 사라진다.
- 번개 3종: 고정 지점 낙뢰 / 주변 대상 연쇄 / 5회 뇌우. 시전 때 정한 지점에서 회피 가능하며 장애물 차단을 검사한다. 각 낙뢰의 피해 반경은 2.4m로 고정한다. 종류별 투사체 수/연쇄 배치는 다르지만 레벨에 따라 범위를 늘리는 기능은 추가하지 않았다.
- 시전당 대상 중복 피해 방지, 범위 내 여러 대상 타격, 지형 경계를 보존하는 넉백, 물방울의 젖음 4초 → 번개 피해 25% 증가를 적용했다. 보스 넉백은 작게 제한했다.
- 판정 권한은 기존 20ms 로컬 전투 커널에 있다. Unity는 해당 투사체 위치와 확정 타격 이벤트를 그린다. 실험실의 독립 PhysicsScene을 본게임에 중복 실행하지 않는다. 신규 물리·피해 계수는 Island의 자체 값이다.
- 젬/노드에 의한 범위 성장은 보류했다. 실제 장착 여부·마나·재사용 대기·일시정지 조건을 유지한다. 성장 사냥의 별도 RogueStageKernel 및 계정 보상 규칙을 변경하거나 운영 서버에 배포하지 않았다.

## 테스트 빌드 사용

로비의 **원소 전투 연습**은 4구역, **10구역 보스 연습**은 보스 입장 연출부터 시작한다. 둘 다 계정에 저장하지 않는 무보상 임시 장비다. 일반 마을길은 실제 장착한 젬을 읽는다.

| 슬롯 | 임시 에르텔 | 전투 표현 |
|---|---|---|
| 1 | icespear | 원형 물방울 |
| 2 | icenova | 이중 물결 |
| 3 | frostshot | 회전 물방울 |
| 4 | stormcall | 낙뢰 |
| 5 | arc | 연쇄 번개 |
| 6 | spark | 뇌우 |

기존 `cleave`의 금빛 쪼개기도 유지한다. 스킬 번호는 슬롯 번호이며 젬을 제거하면 해당 슬롯을 사용할 수 없다. 연습 재시도는 선택했던 시작 구역을 유지한다.

## 검증

- TypeScript: `npm.cmd run check:rpg` PASS.
- 전투/이동/구역/원소/커널 동치/API 회귀 90개 PASS. 실제 1~9구역에서 270마리 처치 후 10구역 보스 승리까지 일반 자동 입력으로 진행하며, 번들 커널과 원본 엔진의 상태를 비교했다. 짝수 검기의 역방향 궤적과 실제 판정 위상도 일치시켰다.
- 이후 추가된 탈출 후 맵 전환 금지 검사까지 총 91개 PASS. 추가 요청의 영향 범위인 원소/10구역 검사를 다시 실행해 15/15 PASS를 확인했다.
- 별도 원소 검사에 스윕, 초기 겹침, 벽 반사·차단, 다중 명중/중복 방지, 젖음 만료, 낙뢰 회피, 30/100 FPS에서 동일한 고정 틱 결과, 6종 젬 매핑, 5단계 순환이 포함된다.
- Unity 컴파일 PASS. 실제 Editor에서 입장 `walk_loop`, 사이드→쿼터 전환, 보스 걷기, 6종 스킬의 실제 보스 피해, 보스 처치, 사이드뷰 물방울/번개를 캡처했다. 초기 실행 2,600프레임, 런타임 오류 0. 보스에게 물 120×3, 번개 225/225/180 피해를 기록했다. 젖음이 끝나면 번개 피해가 180으로 돌아왔다.
- Unity에서 실제 `RpgContracts.CanCast`와 카메라 정책을 실행해 일반 시전 허용 / 입장 중 시전 거부 / 입장 Side25D / 등장 QuarterView / walk 에셋 연결을 확인했다.
- 별도 실제 Editor 9→10구역 진행 PASS: 1,497프레임, 9구역 30마리 처치, 일반 씬 2개 → 보스 입장 시 0개, `walk_loop` 전진 → 등장 → QuarterWeight 1.0. 직접 보스 연습 진입 외에 실제 스트리밍 경로도 검증했다.
- 별도 .NET 계약 실행기는 SDK가 설치되어 있지 않아 UNAVAILABLE. Unity 안에서 실제 C# 헬퍼를 검증했다.
- 형식 검증은 추가하지 않았다. 동기적 고정 틱 엔진과 명시적 입장 상태 전이를 기존 회귀, 커널 동치, 실제 플레이 검증으로 검사한다.

빌드와 Android 실행의 최종 수치는 아래 완료 기록 및 `evidence/elemental-boss-20261111`을 참조한다.

Android 첫 실행에서 URP 최종 화면의 MSAA 1/2 샘플 불일치를 발견했다. 기본 모바일 Medium 품질에 단일 샘플 `DioramaMobileURP`를 연결했다. 다른 품질의 기존 2x MSAA 설정은 유지한다. 모바일에서는 가장자리 계단이 조금 더 보일 수 있다. 검사 도구의 Android 스크린샷 경로도 앱 저장소 기준 상대 경로로 수정했다. [Unity CaptureScreenshot 문서](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/screencapture/capturescreenshot)를 확인했으며 최종 판단은 수정 APK의 실제 실행 결과를 기준으로 한다.

검기 5단계 검사 도구가 공격 사이 JSON null 모션에 접근하던 예외도 수정했다. 빈 모션은 JObject로 변환하여 건너뛰고, 오류 계수 자체는 유지했다. 실패 보고서를 성공으로 바꾸지 않고 수정 APK에서 전체 Android 검사를 다시 실행했다.

## 실제 화면 평가 / 한계

기존 화면을 유지하는 범위에서 평가했다. 전투 중 실제 프레임을 확인했으며 자동 검사 통과가 미술 승인이나 장시간 밸런스 검증을 뜻하지 않는다.

- Palette discipline: 4/5 — 금빛 검기, 청록 물, 보라 번개를 기존 초록 지형과 구분했다.
- Style uniformity: 3/5 — 기존 캐릭터/보스/배경을 유지한 양식화된 표현.
- Lighting depth: 3/5 — 기존 조명과 그림자를 유지했다.
- Silhouette: 3/5 — 거인 보스와 작은 주인공의 크기 대비. 근접 시 일부 VFX가 보스 몸에 가려진다.
- UI intentionality: 3/5 — 기존 HUD를 유지하고 10구역/입장 안내/임시 스킬 안내를 수정했다.
- Feedback visibility: 4/5 — 실제 물방울, 낙뢰, 피해 숫자와 다중 타격 확인. 범위 성장을 대신하는 임의 확대는 하지 않았다.

소리는 별도 청취 평가하지 않았다. 물리 Android 실기와 장시간 열/배터리 검증은 하지 않았다. 보스 전투는 기존 무보상 연습 규칙이며 캐릭터 체력은 기존의 최소 1 보호를 유지한다.

## 작업 재현

빌드: Play Mode 종료 후 `IslandGame.Editor.ElementalBossBuild.Queue()`. 빌드 예약은 스크립트 재로드를 견디며 완료 후 기존 PlayerSettings 버전을 복원한다.

실행 검증: Development Player에 `elemental_probe=1` Android Intent를 전달하면 `ElementalIntegrationProbe`가 공개 연습 진입/명령 API만 사용한다. 위치·HP·명중 결과를 조작하지 않으며 계정 요청을 하지 않는다. 일반 앱 실행에는 자동으로 켜지지 않는다. 사진/결과는 앱의 `elemental-review`에 기록한다.

참고한 Unity 스킬: unity-cli(Play Mode verification), craft-game-floors(camera-rigs, character-motion, vfx, visual-scorecard), ui/ui-imgui/ui-ugui. 기존 커스텀 카메라를 유지했다. 확인한 공식 문서: [ObjectPool](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Pool.ObjectPool_1.html), [AnimationClip](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/AnimationClip.SampleAnimation.html), [Cinemachine camera](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineCamera.html).

## 완료 기록

- 결과: **PASS**. 최종 APK `IslandGame-ElementalBoss-20261111.apk`, 버전 `0.1.0-test.20261111.2` / code `2026111102`, ARM64, 178,673,135 bytes.
- 빌드: 오류 0, 경고 1, 157.5초. APK ZIP 무결성·서명·16KB 정렬 PASS.
- SHA256: `3104f2b2da32218ca653f463e57aec57803296943d94abd88116e7a188b57650`.
- Android 9 / BlueStacks 에뮬레이터: 업데이트 설치 후 보스 입장·걷기·6종 스킬·5단계 검기·보스 승리 및 미궁 탈출 팝업·일반 사이드뷰 2종 시전 PASS. 1,980프레임, 19개 상태/화면 기록, 런타임 오류 0, 전투 세션 네트워크 요청 0.
- Editor 실제 9→10구역 진행: 1,497프레임 PASS. 일반 씬은 보스 준비 시 모두 해제됨.
- 최종 Editor 2,171프레임 검사에서 5단계 검기·6종 스킬·탈출 모달까지 오류0 PASS. [Editor 실행 기록](evidence/elemental-boss-20261111/editor-integration.json).
- [Android 실행 기록](evidence/elemental-boss-20261111/android-integration.json), [구역 전환](evidence/elemental-boss-20261111/zone-transition.json), [APK 검증](evidence/elemental-boss-20261111/apk-validation.json), [90개 회귀 검사](evidence/elemental-boss-20261111/regression-90.txt).
- 화면: [사이드뷰 입장](evidence/elemental-boss-20261111/boss-approach.png), [보스 등장](evidence/elemental-boss-20261111/boss-reveal.png), [물방울](evidence/elemental-boss-20261111/boss-skill-0.png), [번개](evidence/elemental-boss-20261111/boss-skill-4.png), [5단계 검기](evidence/elemental-boss-20261111/boss-sword-5.png), [일반 구역](evidence/elemental-boss-20261111/side-skill-3.png).
- [미궁 탈출 팝업](evidence/elemental-boss-20261111/boss-victory.png), [추가 탈출 회귀 검사](evidence/elemental-boss-20261111/escape-regression-15.txt).
- 로컬 APK: `G:/holdem_coin-workspace/island/builds/IslandGame-ElementalBoss-20261111.apk`. 약 179MB APK는 Git에 포함하지 않았다.
- 작업/전체 증거: `G:/holdem_coin-workspace/island/maintenance/elemental-boss-integration-20261111`. 수정 전 Android 실패 기록도 여기에 보존했다.
