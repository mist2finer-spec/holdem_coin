# 화면 상단 낙뢰와 젬 연결별 지면 전기 — 2026-11-11

메인 Island 전투의 4~6번 번개를 수정했다. `ScreenTopLightning`, `LightningStrikeVfx`가 실제 전투 이벤트를 받아 사이드뷰와 10구역 보스 쿼터뷰에 같은 규칙으로 표시한다. 별도 효과 실험실만 수정한 작업이 아니다.

## 화면과 지면

- 활성 전투 카메라의 `WorldToViewportPoint(target)`에서 X ±0.04, Y=1.15, 동일 Z로 역투영한다. 최종 카메라 추적/흔들림 적용 **후** 매 프레임 다시 계산한다. 카메라 전환·줌 중에도 타격 지점은 그대로이며 시작점은 화면 위에 있다.
- 굵은 흰색 코어, 청백색/보라 글로우와 확산광, 중간 3개 잔가지를 사용한다. 위쪽이 굵고 지면 쪽으로 가늘어진다. 굴절은 카메라 right/up 평면에 정렬한다.
- 첫 2/60초는 거의 직선인 섬광, 이후 4/60초는 지그재그 떨림, 0.32초까지 감쇠한다. 전투 시각에 종속하므로 일시정지 중에는 잡음/파티클도 정지한다. Unity 전역 난수 상태를 소비하지 않는다.
- 타격 지점에 방사형 스파크, 팽창 링, 짧은 바닥 섬광을 더했다. `ViewPresentationCoordinator.FlashStrength`와 기존 카메라 Shake/FovPunch 피드백을 사용한다. 별도 전역 Bloom 설정은 변경하지 않았다.
- 지면 가지와 링은 맵 높이를 따라간다. 저층 풀에도 빛이 보이도록 깊이 텍스처로 표면을 검사하고, 0.65m 이상 높은 몸체/지형이 앞을 가리면 숨긴다. 첫 검증에서 풀에 가려지던 바닥 이펙트를 이 방식으로 보완했다. 실제 보스 몸체 뒤 낙뢰는 정상적으로 가려진다.
- 모바일에서 지면 셰이더가 깊이를 읽기 전에 깊이 복사가 끝나도록 `DioramaForwardRenderer.copyDepthMode`를 AfterTransparents에서 **AfterOpaques**로 옮겼다. 부분 전투 viewport의 UV는 clip-space에서 계산한다. 유효하지 않은 깊이 값(0/1)은 바닥 전체를 숨기지 않도록 제외한다.

## 젬 연결과 판정

| 유효하게 연결된 보조 젬 | 낙뢰 한 번의 지면 가지 | 기존 피해 반경 대비 시각적 반경 |
|---|---:|---:|
| 0 | 0 | 타격 링만 |
| 1 | 3 | 60% |
| 2~3 | 6 | 80% |
| 4~5 | 9 | 100% |

`compileSkill` 결과의 유효 `supportIds`를 중복 제거하여 센다. 소지품 개수나 빈 소켓 수로 단계를 올리지 않는다. 로컬 커널과 서버 전투 양쪽에 전달하며 시전 시작 때 연결 수를 고정한다. 시전 도중 장비를 바꾸면 다음 시전부터 반영된다. 연쇄와 뇌우의 후속 낙뢰도 시전 당시 값을 유지한다.

피해/충돌 권한은 기존 고정 틱 전투 엔진에 있다. 지면 가지는 기존 2.4m 타격 반경 안에서만 확장하며 장애물에서 멈춘다. 별도 Collider나 중복 피해는 만들지 않는다. 기존 범위 내 다중 타격, 장애물 차단, 회피, 젖음 연계 및 시전당 중복 타격 방지를 보존했다. 젬에 따른 **실제 피해 반경 성장/추가 감전 판정은 이번 변경에 포함하지 않았다**.

개발 로비의 원소 전투 연습(4구역) / 10구역 보스 연습에서 슬롯 4·5·6은 각각 보조 젬 0·2·4개인 임시 예시를 보여준다. 이 연습 fixture는 현재 계정의 장비/소켓 제한을 바꾸거나 저장하지 않는다. 실제 장착 장비는 기존 컴파일·유효성 검사를 거친다. 1~3번 물방울 및 기본 검격은 유지한다.

## 검증

- `npm.cmd run check:rpg`: PASS.
- 연결 젬, 원소 통합, 로컬 번들, 마을길/보스 API 검사 **26/26 PASS**. 원본 엔진과 번들의 전체 진행 동치 및 10구역 완료 뒤 맵 전환 금지 회귀 포함. 연결 수 변화가 피해량/반경을 바꾸지 않음을 검사했다.
- Unity 컴파일 PASS. 실제 Camera를 이용한 투영 **36조건 PASS**: 원근/직교, pitch 10/24/40°, 두 줌, 세 화면비 및 부분 viewport. 시작 Y=1.15, 동일 깊이(부동소수 오차 허용 2mm), 고정 끝점, 카메라 이동, 일시정지 결정성, 카메라 뒤 대상 거부를 확인했다.
- 10회 연속 낙뢰 풀 검사 PASS: 최대 8개 겹침, LineRenderer/ParticleSystem 수 증가 없음, 시간 경과 뒤 모두 만료. 이 검사는 효과 풀을 직접 호출하는 수명 검사이며 실제 전투 입력 검증과 구분한다.
- 최종 Editor 실제 스킬 입력: **834프레임, 18개 캡처, 오류 0, 네트워크 요청 0, PASS**. 사이드/쿼터 각각 4~6번 섬광·아크·바닥 프레임, 연결 수 0/2/4, 시작점/끝점/지면 높이/반경과 고정 렌더러 수 확인.
- Android 빌드 및 실행 최종 결과는 아래 완료 기록과 `evidence/lightning-screen-top-20261111`에 보관한다.

처음부터 정상 실행된 것처럼 실패를 감추지 않았다. 초기 투영 검사의 0.1mm 허용치는 Unity 역투영 오차 약 0.21mm보다 작아 2mm로 조정했다. 초기 바닥 표현은 풀에 가려졌으므로 셰이더를 보완하고 실제 Editor 검사를 다시 실행했다. 첫 Android APK는 수치 검사 PASS였지만 실제 캡처에서 바닥 링/가지가 보이지 않아 시각 검증 실패로 판정했다. 투명 효과 렌더링 뒤에 복사되던 깊이 텍스처의 순서와 부분 viewport UV를 수정한 뒤 APK를 재빌드했다. 첫 실패 캡처는 로컬 작업 폴더의 `evidence/device-first`에 보존했다.

## 실제 화면 평가

기존 미술/UI를 유지하는 범위에서 최종 플레이 캡처를 평가했다. 자동 PASS와 미술 승인을 구분한다.

Palette discipline: 4/5 — 의도한 흰 코어와 청백/보라 발광을 녹색 지형에서 구분.
Style uniformity: 3/5 — 기존 캐릭터·보스·배경에 양식화된 번개 적용.
Lighting depth: 3/5 — 기존 조명/그림자와 몸체 가림을 보존하고 바닥 섬광 추가.
Silhouette: 3/5 — 거인 실루엣을 유지하며 핵심 낙뢰가 화면 상단부터 보임.
UI intentionality: 3/5 — 기존 HUD와 전투 영역 보존, 상단 UI 밖에서 낙뢰 시작.
Feedback visibility: 4/5 — 섬광→떨림→지면 확산이 구분되며 풀 위에서도 가지 확인.

소리는 별도 청취 평가하지 않았다. 물리 Android 휴대폰 및 장시간 열/배터리 검사는 미실시다. 지면 가림의 0.65m 기준은 이 프로젝트 지형/풀/보스에서 검증한 값으로, 향후 낮은 장애물·다른 식생 추가 시 재평가해야 한다.

보고서의 오류 수는 Unity Error/Exception/Assert 계수다. Android9의 `OnBackInvokedCallback` 클래스 탐색 및 에뮬레이터 GL 형식 메시지는 이전 APK의 logcat에도 존재한다. 모든 플랫폼 로그가 비어 있다는 의미는 아니며, 앱의 실제 실행과 최종 렌더 화면을 별도로 확인했다.

## 재현과 출처

- Unity CLI 최신 확인 버전 beta.17, Unity 6000.0.62f1. 사용 스킬: unity-cli, craft-game-floors의 VFX/실제 화면 검증 지침.
- Editor에서 `LightningIntegrationProbe.Begin(directory)`로 실제 6개 시전을 검증한다. 개발 Android에서 Intent `lightning_probe=1`로 실행하며 앱의 `files/lightning-review`에 캡처/보고서를 저장한다. 일반 실행에는 자동 검사하지 않는다.
- 빌드: Play Mode 종료 후 `IslandGame.Editor.LightningBuild.Queue()`. 기존 11개 씬과 개발 패키지 ID를 확인하고 빌드 후 PlayerSettings 버전을 복원한다.
- 전투 검사: `node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs --test scripts/rpg/test-lightning-supports.ts scripts/rpg/test-elemental-integration.ts scripts/rpg/test-local-training.ts scripts/rpg/test-mount-route.ts scripts/rpg/test-unity-boss-route.ts`.
- 작업/전체 원본 증거: `G:/holdem_coin-workspace/island/maintenance/lightning-screen-top-20261111`.
- 사용자 지정 [POE2 쇼츠](https://www.youtube.com/shorts/zktL4mJLN0w)를 로컬에서 확인했다. 밝은 청백 낙뢰와 바닥 전기 가지의 시각적 참고이며 원작 리소스·피해 계수 복제가 아니다. 영상/원작 프레임은 저장소에 넣지 않았다.
- [Unity Camera.ViewportToWorldPoint](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Camera.ViewportToWorldPoint.html), [URP 깊이에서 월드 위치 복원](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/writing-shaders-urp-reconstruct-world-position.html)을 참고했다.

10구역 입장/보스 등장/쿼터뷰 전환과 처치 즉시 미궁 탈출 흐름을 유지한다. 이전 보스맵이나 11번째 구역을 다시 추가하지 않는다.

## 완료 기록

- **PASS** — Android9 BlueStacks(SM-S908E 에뮬레이션), 실제 6개 스킬 입력, 762프레임, 18개 캡처, 오류 0, 네트워크 요청 0.
- APK: `G:/holdem_coin-workspace/island/builds/IslandGame-Lightning-20261111.apk`, `0.1.0-test.20261111.3` / code `2026111103`, ARM64 개발 빌드.
- 빌드 78.9초, 오류 0 / 경고 0, 146778074 bytes. ZIP 무결성·서명·16KB 정렬 PASS.
- SHA256: `ca5f80570932e8614c2d0d1f7a3fa2f3ab5d7b54fd176e5a894585998ae93714`.
- 새 번개 풀 재질/파티클 검사 PASS: 기본 회색 재질 없음, 의도한 HDR 청백색 파티클 그라데이션. 기존 HUD는 수정하지 않았다.
- Editor는 검사 전 상태인 Play 종료 / runInBackground=false로 복원했다. APK는 연결된 BlueStacks에 업데이트 설치했다. 물리 휴대폰은 미검증.
- [Android 사이드뷰 낙뢰](evidence/lightning-screen-top-20261111/device-side-skill-4-arc.png), [사이드뷰 지면 확산](evidence/lightning-screen-top-20261111/device-side-skill-6-ground.png), [쿼터뷰 섬광](evidence/lightning-screen-top-20261111/device-quarter-skill-4-flash.png), [쿼터뷰 지면 확산](evidence/lightning-screen-top-20261111/device-quarter-skill-6-ground.png).
- [Android 수치](evidence/lightning-screen-top-20261111/android-report.json), [Editor 수치](evidence/lightning-screen-top-20261111/editor-report.json), [빌드 결과](evidence/lightning-screen-top-20261111/build-result.json), [APK 검증](evidence/lightning-screen-top-20261111/apk-validation.json).
