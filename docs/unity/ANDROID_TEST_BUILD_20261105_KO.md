# Android 테스트 APK 및 server CI 수정 — 2026-11-05

## 결과

- 테스트 APK: `G:/new_project/IslandGame/Builds/Android/IslandGame-Test-20261105.apk`.
- 파일 크기: 94,761,540 bytes (90.4 MiB), SHA-256 `9bb88ae186a81c084087f973fbaed44542ec6762fda54d1a26b785b7122b4df7`.
- 패키지 `com.mist2finer.islandgame.dev`, 버전 `0.1.0-test.20261105`, versionCode `2026110501`.
- ARM64 / IL2CPP / OpenGLES3 / Portrait / Development APK. Android 6.0(API 23) 이상, target API 36. 기본 Android 디버그 키로 서명했으며 배포용 릴리스 서명이 아닙니다.
- 서버 `https://holdem-coin-tavern.onrender.com`. 실제 서버 배포는 하지 않았고, 지난 주얼 효과 8개 제한도 운영 반영 대기입니다.
- 최종 빌드 결과 `Succeeded`, 오류 0, 경고 0. 실제 APK 파일 크기와 BuildReport의 총 출력 크기(심볼 등 포함)는 구분해야 합니다.
- [검증 JSON](evidence/2026-11-05-android/validation-summary.json), [APK 패키지 정보](evidence/2026-11-05-android/apk-badging.txt), [서명 검사](evidence/2026-11-05-android/apk-signature.txt).

USB 디버깅 장치가 연결되어 있다면 `adb install -r "G:/new_project/IslandGame/Builds/Android/IslandGame-Test-20261105.apk"`로 설치할 수 있습니다. APK를 휴대폰으로 옮겨 파일 관리자에서 설치해도 됩니다. 이 작업에서는 연결된 adb 장치가 없어 실기기 설치·실행을 확인하지 못했습니다. Android 에뮬레이터도 실행하지 않았습니다.

## server 실패의 실제 원인과 수정

실패한 [run 42088698457](https://github.com/mist2finer-spec/holdem_coin/actions/runs/42088698457)의 job `127460664338` 로그를 읽었습니다. checkout/setup-node 및 서버·포커·hybrid 검사는 통과했고, `npm run test:rpg:idle`의 `unique cluster and devotion options change only their explicitly allocated live totals`에서 `assert.ok(withEffect.devotion>0)`가 실패했습니다.

이전 8개 제한 도입 후 기존 테스트 경로에 변환 대상이 아닌 노드만 할당되어 헌신이 0이 된 것입니다. `test-equipment-combat.ts`가 서버가 실제 변환한 헌신 노드 하나를 연결 경로로 습득한 뒤 고유 장비의 속도 증가를 검사하도록 고쳤습니다. 효과 검증이나 8개 제한을 제거하지 않았습니다. Windows의 `test-idle-items.ts` 자식 프로세스 loader 경로도 `pathToFileURL`로 보정했습니다.

사용자가 보낸 Node 20 및 Ubuntu 메시지는 종료 코드 1의 직접 원인이 아닌 경고였습니다. [checkout v7](https://github.com/actions/checkout/blob/v7/action.yml)과 [setup-node v7](https://github.com/actions/setup-node/blob/v7/action.yml)은 내부 Node 24 런타임을 사용합니다. workflow를 이 버전들로 갱신하고 `ubuntu-24.04`로 실행 환경을 고정했습니다. 앱/테스트의 `node-version: 22`는 유지했으며 액션 내부 런타임과 구분합니다. `npm run test:rpg:build`도 CI 단계에 추가해 관련 성장 검증이 빠지지 않게 했습니다.

CI 수정 커밋 `dc1a3970e2790b29ca255100794e45fdacf613f6`의 [run 42099785213](https://github.com/mist2finer-spec/holdem_coin/actions/runs/42099785213)은 **전체 success**입니다. 새 로그에서 Node 20 액션 경고와 ubuntu-latest 이전 경고가 모두 사라진 것도 확인했습니다. 로컬 idle 65개, growth 58개, `npm run check:rpg`도 PASS입니다. main 병합과 Render 운영 배포는 수행하지 않았습니다.

## Android용 변경

- Unity 6000.0.62f1 및 기존 Built-in/Spine 4.2를 유지했습니다. 설치된 Android SDK(36), NDK r27c, OpenJDK 17을 사용했습니다. CLI는 1.0.0-beta.16으로 갱신했습니다.
- `IslandFonts.cs`와 번들 Noto Sans CJK KR 글꼴을 추가했습니다. 기존 Windows OS 글꼴 의존성을 HUD/성장/IMGUI/보스 UI에서 제거했습니다. TMP는 48pt, padding 5, 1024×1024 동적 SDF와 필요한 경우 다중 atlas를 사용합니다. 글꼴 원본 데이터가 빌드에 포함되는 것을 BuildReport로 확인했습니다.
- 최종 실행 검사에서 발견한 동적 Font 복제 오류를 수정했습니다. GUI는 Resources 글꼴을 공유하며 자기가 만든 OS fallback만 해제합니다. TMP가 생성한 atlas/material/font asset은 기존 HUD 수명에 맞춰 해제합니다. 공유 원본을 Destroy하지 않습니다.
- 원본 글꼴은 [Noto CJK 고정 커밋](https://github.com/notofonts/noto-cjk/tree/f8d157532fbfaeda587e826d4cd5b21a49186f7c)에서 제공하는 `Sans/OTF/Korean/NotoSansCJKkr-Regular.otf`이며 SIL OFL 1.1입니다. [라이선스](client-source-snapshot/2026-11-05/Resources/Fonts/OFL.txt)와 [경로·해시](client-source-snapshot/2026-11-05/source-manifest.json)의 `localOnlyFonts`를 확인하세요. 원격 스냅샷에 글꼴 바이너리는 넣지 않았습니다.
- 테스트 앱 식별자/이름/버전, ARM64 IL2CPP, OpenGLES3 및 인터넷 권한을 설정했습니다. 원래 ProjectSettings는 `.island-backups/android-test-20261105/ProjectSettings.asset.before`에 보존했습니다. 현재 설정은 테스트 빌드용이며 기존 릴리스 빌드 설정과 혼용하지 마세요. 전체 PlayerSettings는 플랫폼 패스코드를 포함하므로 자동 승인 검토에서 게시가 거부되어 제외했습니다. 원격에는 재현에 필요한 Android 설정만 명시적으로 기록했습니다.
- `BattleHudReview.SetSize`가 Android 타깃에서는 Android Game View 해상도 그룹을 사용하도록 고쳤습니다. 이전에는 Standalone 그룹을 참조하여 Android 전환 뒤 가로 해상도를 잘못 골랐습니다. 이 수정은 Editor 전용입니다.
- 최초 빌드 뒤 글꼴 오류 수정본으로 재빌드했으며, 위 경로에는 최종 APK를 복사했습니다. 최초 파일은 로컬 검토 폴더의 `.first.apk`로 구분하며 최종 검증 해시와 다릅니다.

## 검증과 제한

- APK ZIP 무결성, v1/v2 서명, ARM64 libunity/libil2cpp, 실행 Activity, 인터넷 권한, 16KB zip alignment 검사 PASS.
- 번들 글꼴의 한글 glyph 생성 및 GUI 공유 원본이 해제 후에도 유지되는 것을 확인했습니다.
- 최종 런타임 코드로 Editor Play 프레임 418→419 이후 지속 진행. 1080×2340 Android Game View에서 전투 배치 45개·성좌 입력 18개 PASS, Console 현재 오류/경고 0. 실제 전투·성장 화면을 확인했으며 PNG는 `C:/Users/SHK/island-android-review/`에 보관합니다.
- 초기에 프레임 1에서 대기가 시간 초과됐고 Play 전환 중 Pipeline socket hang up도 한 차례 있었습니다. Editor ready 상태 확인 후 다시 연결하고 Game View 포커스/PlayerLoop 갱신을 통해 후속 프레임 진행을 확인했습니다. 일시 실패를 통과로 기록하지 않았습니다.
- 현재 Android 실기기 및 GPU/발열/물리 멀티터치 검증은 미실행입니다. Editor 검증과 APK 패키지 검사를 기기 실행 결과로 취급하지 않습니다.
- 기존 씬은 변경하지 않았습니다. SHA-256 `7ad746ca1498a7623219d8e6ddd3873472b1ee61982eac0f4cd3ede71f5b71e1`.
- Play 종료, 백그라운드 실행 override 및 auto tick 해제, 메모리 테스트 서버 종료. Android 빌드 타깃과 1080×2340 Game View를 유지합니다.

## 다음 에이전트

로컬 프로젝트와 [참고 스냅샷](client-source-snapshot/2026-11-05/README.md)의 경계를 유지하세요. 스냅샷은 폰트·모델·Spine 원본을 모두 포함한 독립 빌드 프로젝트가 아닙니다. 한글 글꼴을 누락한 채 코드만 가져오지 마세요. 다음 실기기 검사에서는 설치→시작→서버 연결→전투 표시→성장 트리 팬/핀치→백그라운드 복귀를 확인하면 됩니다. 서버의 실제 주얼 8개 제한 배포는 별도 단계입니다.
