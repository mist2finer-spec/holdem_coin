# 도트 렌더링 작업 일지 — 2026-11-12

결과 상태: **PASS — 도트 렌더링 초안 구현, Editor 실행 및 Android 테스트 빌드 검증 완료.** 미술 최종 승인과 실물 휴대폰 검증은 미완료다.

## 요청과 현재 기준

- 최초 요청: 기존 Unity 게임을 제공한 5단계 명세에 따라 도트화하고 원본 백업과 테스트 빌드까지 진행.
- 후속 요청: “작업한거 우선 푸쉬하고 어디까지되있는지 일지작성해둬.”
- 저장소: `mist2finer-spec/holdem_coin`, 작업 브랜치: `codex/genshin-environment-20261110`.
- 구현 시작 커밋: `acb0037717c758bb570f2b5148900423c883175b`.
- 실제 Unity: `G:/holdem_coin-workspace/island/branches/current-10zone/unity/IslandGame`.
- 일반 1~9구역 Side25D, 10구역 사이드 입장 후 보스 등장 때 QuarterView를 유지했다. 보스 처치 후 바위 하강 → 마을 문 도착 종료도 유지했다.

## 구현된 범위

| 단계 | 구현 상태 |
| --- | --- |
| 저해상도 | 전투 카메라의 실제 RenderTexture를 세로 디스플레이 너비360px / 가로640px로 렌더링. Point 확대, mipmap/MSAA 제거. UI는 원래 해상도 유지. |
| 계단식 명암 | 주요 커스텀 지형·풀·잎·환경 및 Nilo 캐릭터 조명에 3단계 분기 추가. 두 URP 설정의 소프트 섀도우 비활성화. 일부 표준 URP/Lit 재질은 기존 조명 후 최종 팔레트만 적용. |
| 외곽선 | 깊이 차이 기반 내부 1픽셀 외곽선과 기하 법선 변화 하이라이트. 기존 커스텀 셰이더의 DepthNormals 패스 부재에 대응해 법선은 깊이에서 복원. |
| 색상 | 외곽선·하이라이트 후 4×4 Bayer 디더링과 지정32색 최근접 변환. Render Graph의 AfterRenderingPostProcessing 단계에서 적용. |
| 포즈 | 뼈대와 절차적 자세 보정을 함께12fps로 유지. 위치·카메라·전투시간은 계속 갱신하며 클립 전환은 즉시 반영. |

설정은 `Assets/Island/Resources/PixelArtSettings.asset`이다. `enabled=false` 후 Play를 다시 시작하면 도트 후처리·툰 분기·포즈 제한을 끌 수 있다. 이 스위치가 전역 섀도우/AA까지 원복하는 것은 아니다. `portraitWidth`는 최대640, `landscapeWidth`는 최대960으로 조정할 수 있다.

렌더링은 `PixelArtCamera`가 표시된 전투 카메라에 한정한다. 홀덤·성장 UI·계정 데이터·권위 전투 코드는 이번 변경 대상이 아니다.

## 코드·테스트로 확인한 것

- 관련 전투 회귀43개 PASS. 실행 명령:

  ```powershell
  node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs --test scripts/rpg/test-unity-boss.ts scripts/rpg/test-unity-boss-route.ts scripts/rpg/test-boss-contact.ts scripts/rpg/test-combat-view-contract.ts scripts/rpg/test-hero-combo.ts
  ```

- Editor: 3,894프레임, 진행15지점 PASS, Unity 오류0, 네트워크 요청0.
- Android9 BlueStacks: 3,839프레임, 진행15지점 PASS, Unity 오류0, 네트워크 요청0.
- 검사 흐름: 사이드 입장, 보스 공개, 쿼터 이동, 걷기·대기·공격, 번개, 사망, 출구 하강, 달리기, 전장 이탈, 마을 도착.
- 포즈 계측: 6.008초/356관찰프레임 중 뼈대75회·위치101회 변화, 자세 유지281프레임. 클립 전환을 포함하므로 정확히72회로 제한하는 검사가 아니다.
- 최종 전투 RT 샘플: 360×320, 사용색31개로 지정32색 상한 이내. 전체 HUD 화면의 색상 수를 제한했다는 뜻은 아니다.
- Android IL2CPP ARM64 개발 빌드: 오류0, 기존 `IslandApp.lastDeal` 미사용 경고1. ZIP 무결성·APK 서명·16KB 정렬 PASS.
- 이번 푸시 준비에서는 렌더링 코드를 추가 수정하지 않았으며, 위 검증과 동일한 구현의 기록을 재사용했다.

## 실제 화면으로 확인한 것

일반 구역과 보스전에서 도트 격자·팔레트·하드 섀도우가 적용되고 HUD/체력바/조작 버튼이 표시되는 것을 확인했다. [Android 보스 화면](pixel-art-20261112/android-boss.png), [Editor 사이드 입장](pixel-art-20261112/editor-side.png)을 보관했다. 청음 검사는 이번 도트화 범위에 포함하지 않았다.

## 빌드·백업·증거 위치

- APK: `G:/holdem_coin-workspace/island/builds/IslandGame-PixelArt-20261111.apk`
- 버전: `0.1.0-test.20261111.9` / code `2026111109`, 150,208,790bytes.
- APK SHA256: `fccb18795c61f94ed687ac180a960de0d1cf0815960d3dcf794f7dedc4dbc960`.
- 작업 기록 루트: `G:/holdem_coin-workspace/island/maintenance/pixel-art-20261111`.
- `backup/Unity-source-before.tar`: 변경 직전 Assets·Packages·ProjectSettings·인수인계·AGENTS. 264,714,240bytes, SHA256 `e7dd8804c9fdb9bb198a39fc526c23d41abc757d5aaeb55573367ba7ccbf7db9`.
- `backup/IslandGame-before.apk`: 직전 정상 BossPresentation 테스트 APK.
- `backup/head.txt`, `backup/local-before.patch`: 시작 커밋 및 기존 로컬 수정.
- 상세 자료: `evidence/editor-arena`, `evidence/device`, `evidence/pose-audit.json`, `build-result.json`, `RENDER_REVIEW.txt`, `BACKUP_AND_SETTINGS_KO.txt`.
- Git에는 구현·Unity 메타·설정·일지와 소규모 검증 요약/화면을 보존한다. APK와 전체 백업은 위 로컬 경로에 보존하며 이번 소스 푸시로 GitHub Release에 업로드하지 않는다.

복원할 때는 현재 후속 변경을 먼저 보관하고 tar를 별도 폴더에 풀어 필요한 파일만 비교 복원한다. 활성 프로젝트에 무조건 덮어쓰거나 `git reset/clean`으로 초기화하지 않는다.

## 남은 작업과 제약

1. 사용자 화면 검토 후 해상도·색상·외곽선 강도 조정. 미술 승인은 아직 받지 않았다.
2. 실물 Android에서 GPU 프레임 시간·발열·메모리 확인. 에뮬레이터 통과를 실물 성능 보장으로 해석하지 않는다.
3. 전체10구역을 장시간 이동하며 잔디·얼굴의 서브픽셀 깜빡임 확인. 현재 완전 제거를 보장하지 않는다.
4. 필요하면 얼굴 텍스처/머리 비율 또는 해상도 조정. 이번에는 머리 메시 확대와 12×12 얼굴 텍스처 교체를 하지 않았다.
5. 표준 URP/Lit 일부 재질의 조명을 별도3단계 셰이더로 통일할지 검토. 투명 VFX는 깊이를 쓰지 않아 독립 기하 외곽선이 없다.
6. 두 YouTube 링크 직접 열람은 실패했다. 영상과 프레임 단위 일치를 검증한 것이 아니라 사용자가 제공한 상세5단계 명세를 기준으로 구현했다.

## 푸시 범위와 작업 종료 상태

이번 후속 요청에 따라 현재 작업 브랜치에 구현·일지를 커밋해 푸시한다. `main` 병합과 운영 배포, GitHub Release 게시는 포함하지 않는다. 구현 전부터 있던 `Unsafe.dll.meta`, 개인 `.agents/`, MobileURP의 기존 공백 변경은 로컬에 보존하고 이번 커밋에서 제외한다.

Unity는 Play 종료, MountZone10 씬, `runInBackground=false`, 임시 자동 틱 종료 상태로 마무리했다. 이어서 작업할 때 이 일지와 [Unity 인수인계](../../unity/IslandGame/UNITY_HANDOFF_KO.md)를 먼저 확인한다.
