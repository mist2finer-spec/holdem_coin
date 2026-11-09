> 최신 2026-11-09.4: [세 공격 독립 접촉·S20 접속 경로·main 운영 배포·최종 APK·후속 작업](COMBO_DEPLOY_20261109_KO.md). 운영 서버 `2bdd5f1`, APK `2026110904`. 원격 Unity 폴더는 전체 프로젝트가 아니며 증분 스냅샷과 로컬 최신 상태를 대조합니다. 아래 미배포 서술은 과거 기록입니다.

> 2026-11-07 배포 완료: [main·Render LIVE·APK·운영 Unity 연결 검증](COMBAT_STABILITY_DEPLOY_20261107_KO.md). 운영 소스 7adb404, APK 2026110701.

> 최신 2026-11-07: [전투 끊김 안정화·Unity 실측·변경 소스](COMBAT_STABILITY_20261107_KO.md). 사용자 요청으로 Editor 렉을 우선 검증했으며 Android 실기 수치는 미검증입니다. 아래 이전 기록보다 이 결과를 먼저 확인하세요.

> 최신 상태: [보스 모션·360° 조작·Nature 맵 수정 및 APK 검증](BOSS_CAMERA_20261106_KO.md). 코드/배포 ffde9d1, APK 버전 2026110602. 아래는 이전 시점의 기록입니다.

**2026-11-06 최신 Unity: [2.5D/거대 보스 카메라 및 다리 적용](BOSS_CAMERA_20261106_KO.md), [배포·APK 결과](BOSS_CAMERA_DEPLOY_20261106_KO.md)를 먼저 확인하세요. 현재 일반 사냥은 Unity 전용 두 구역 훈련 API `/api/rpg/unity-boss`를 사용하며 웹 게임은 유지합니다. 모델·애니메이션을 포함한 자산 스냅샷은 Git 인증 확인 후 함께 반영했습니다.**

# IslandGame — 최신 로컬 Unity 통합 인계

**2026-11-06 연구자료 추가:** [Savage Wind 캐릭터 흐름·최적화 인계](SAVAGEWIND_RESEARCH_HANDOFF_20261106_KO.md). 지정 릴리스의 소스·라이선스와 Unity 대응 분석을 보관했습니다. 연구 준비이며 아래 실제 프로젝트/운영 적용 상태를 대체하지 않습니다.

**최신 Unity 적용·APK: [구역 통신/로컬 전투 인계](STAGE_SYNC_20261105_KO.md). assets/unity-lowpoly-combat 브랜치, 버전 .4 / 2026110504. 운영 서버 `774c9d6` 배포 및 구역 통신 검증 완료. [운영 배포 기록](STAGE_SYNC_DEPLOY_20261105_KO.md) 참조. 아래 이전 기록보다 이 인계를 우선합니다.**

기록일: 2026-11-05. **다음 에이전트는 이 문서부터 읽고 실제 Editor/파일 상태를 확인하세요.**
이 문서는 3D 표시, 모바일 전투 UI, 성장 성좌 및 후속 노드 겹침 수정을 합친 상태입니다. 최신 상태는 [Android APK·CI 인계](ANDROID_TEST_BUILD_20261105_KO.md), 노드 배치 경계는 [성좌 후속 인계](TREE_DENSITY_20261105_KO.md)를 확인하세요.

## 1. 먼저 알아야 할 경계

- 실제 작업 프로젝트: `G:/new_project/IslandGame`. 이 폴더에는 `.git`이 없습니다.
- 참조 서버 체크아웃: `G:/new_project/holdem_coin-reference`. 기존 `prepare_assets.py` 수정은 보존했습니다.
- 이번 게시용 체크아웃: `C:/Users/SHK/island-3d-review`.
- 원격 기준 main 및 확인한 배포 리비전: `a92b9bde8ed507dd18b77574760dc89e3e191364`.
- 후속 브랜치 `fix/unity-tree-spacing-20261105`는 문서·Unity 참고 스냅샷 및 실제 주얼 효과를 최대 8개로 제한하는 공유 서버 코드를 포함합니다. main 병합과 운영 배포는 하지 않았습니다.
- 원격 `unity/IslandGame`은 로컬의 모든 후속 변경·에셋이 반영된 프로젝트가 아닙니다. [현재 소스 참고 스냅샷](client-source-snapshot/2026-11-05/README.md)과 구분하세요.
- 이전 인계의 일부 3D 절에 문자 인코딩 손상이 있어, 현재 상태는 이 문서와 SHA-256/검증 JSON을 우선합니다.

## 2. Editor, 서버, 씬

| 항목 | 실제 상태 |
|---|---|
| Unity | 6000.0.62f1 |
| 프로젝트 | `G:/new_project/IslandGame` |
| 씬 | `Assets/Island/Scenes/Island.unity` |
| 렌더 파이프라인 | **Built-in 유지**. URP 전체 전환은 하지 않음 |
| 서버 | `https://holdem-coin-tavern.onrender.com` |
| 사냥 API | `/api/rpg/rogue` |
| 성장 사냥 API | `/api/rpg/session` |
| 제어 경로 | Unity CLI → Pipeline → 열린 Editor, 포트 7800 |
| Spine | 로컬 4.2 패키지 유지, 임의 업그레이드/중복 설치 금지 |
| 추가 패키지 | glTFast 6.20.0 및 Physics2D built-in 1.0.0 |

Play를 시작한 뒤 로비의 미궁 사냥 입장으로 확인합니다. 씬에 전투 카메라가 미리 없어도 정상입니다. 기존 IslandApp이 런타임에 카메라·월드·Canvas를 생성합니다.

## 3. 현재 데이터와 표시 연결

`IslandApp → RpgSession → 서버 snapshot → NativeBattle → Battle3DView`

- 전투·성장·저장·장비 판정은 기존 Node 서버 권한을 유지합니다.
- `NativeCombatClock/NativeCombatPresentation`의 표시 시계와 서버 좌표·모션 시작/길이를 재사용합니다.
- 3D 모델이 준비되면 플레이어는 Pink Glass, Slime 계열은 제공된 GLB를 사용합니다. 나머지 몬스터는 기존 Spine 외형을 유지합니다.
- `IslandBattleHud`는 기존 스킬·쿨타임·스틱·물약·하단 메뉴를 표시합니다.
- `IslandGrowthPanel`은 훈련/특성/성좌를 별도 uGUI로 표시하며, 해당 화면에서 기존 IMGUI가 중복 렌더되지 않습니다.
- `IslandRpgPresentation`은 장비/소환/기존 패널과 캠페인 경로를 계속 담당합니다.
- 독립 10보스 시험장과 표시명 모듈도 로컬에 있습니다. 이전 인계의 검증 기록이며, 이번 UI 작업에서 10종 전투를 다시 완주한 것은 아닙니다.

## 4. 3D 원본과 현재 아트 수준

- `G:/new_project/attack_motion_ref/pink-glass-attacks-v4`는 Spine JSON/atlas/PNG와 모션 미리보기 자료입니다. 당시 CSV/FBX는 이 폴더에서 발견되지 않았습니다.
- 실제 3D 모션은 새로 제공된 `attack_motion_ref/3d_modeling_pink/pink_3d_sword.zip`에서 필요한 GLB 18개를 선별했습니다.
- 플레이어 모델은 65본이며, 대기/걷기/조깅/점프/구르기/슬라이드/피격/사망/검 공격/주문 클립을 가져왔습니다.
- `slime_rigged_animated.glb`는 3본, `Slime_RigAction` 1개입니다. 실제 미리보기상 약 2.5초 squash/wobble이며 전진·공격 클립이 아닙니다.
- `Slime_1.glb`는 정적 비교용 메시이며 본/애니메이션이 없습니다.
- 원본 GLB에는 텍스처가 없어 플레이어는 단색 핑크, 슬라임은 녹색 재질입니다. 완성 아트가 아닙니다.
- Nature Free / LOWPOLY MEDIEVAL 패키지 두 종은 프로젝트에서 확인되지 않아 숲길은 임시 절차적 배경입니다.
- 모델·원본 zip은 원격에 전송하지 않았습니다. [모델 경로·해시](client-source-snapshot/2026-11-05/source-manifest.json)를 사용하세요.
- 타격 포즈는 클립의 45%를 임시 접촉점으로 사용합니다. 원본 2D 모션과의 정확한 타격 포즈 동등성, 모든 무기/스킬 외형은 미완료입니다.

## 5. 최신 전투 카메라와 모바일 비율

이 절은 이전의 “전투 RenderTexture / 화면 64%” 설명을 대체합니다.

- 메인 3D 전투는 **직접 화면 렌더링**입니다. Native battle camera의 `targetTexture=null`과 실제 UI 영역의 [`Camera.rect`](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Camera-rect.html)를 사용합니다.
- 전투 RawImage는 3D 직접 출력 시 비활성화합니다. 기존 `Output` RenderTexture는 캠페인/기존 패널/Spine 호환 경로를 위해 남겨둡니다.
- 성장/던전/다른 패널로 나가면 호환 출력으로 되돌리고, 사냥으로 돌아오면 직접 출력으로 복원합니다.
- `CameraHorizontalWidthLock.targetHorizontalWidth=12`: 어떤 종횡비에서도 보이는 가로 월드 길이가 같습니다.
- [`orthographicSize`](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Camera-orthographicSize.html) `= 12 / (2 × camera.aspect)`. 세로 Size를 상한 Clamp하여 긴 폰을 다시 줌인시키지 않습니다.
- 바닥 기준점은 카메라 viewport Y=0.18, 플레이어 X=0.38입니다. 9도 기울어진 카메라의 right/up/forward로 프레이밍을 계산합니다.
- 전투 루트 CanvasScaler는 1080×2340, Match Width=0입니다. 기존 폰트/아이콘의 390 디자인 단위는 하나의 균일한 프레임 스케일로 유지합니다. 중첩 CanvasScaler로 비율을 고치지 않습니다.
- Safe Area 내부의 비율 앵커: 전투 0.50~1.00, 스킬/상태 0.35~0.50, 조작 0.08~0.35, 메뉴 0~0.08. 상단 HUD는 전투 위에 겹칩니다.
- 스킬 6칸은 HorizontalLayoutGroup으로 균등한 정사각형을 유지하며, 굵은 조작부 액자 테두리는 제거했습니다.
- 성좌는 다음 절의 독립 RT를 계속 사용합니다. 직접 전투 카메라와 성좌 카메라를 혼동하지 마세요.

## 6. 성장 성좌 아키텍처

- `SkillTreeViewportInput`: RawImage 포인터 소유, 1지 팬, 2지 핀치, 탭→UV→2D Raycast, 부모 ScrollRect 잠금/원상복구.
- `SkillTreeCameraController`: Orthographic 줌/팬 스무딩, 경계 제한, 포커스.
- `SkillTreeNode/SkillTreeManager`: 서버 그래프, 습득 상태, 선택 이벤트, 경로 미리보기와 회수 연결성 판단.
- `IslandGrowthPanel`: RawImage를 포함한 ScrollRect와 하단 정보/습득/회수 버튼, 훈련/특성/방치 보상.
- 별도 SkillTree 레이어(현재 31), 원점 `(10000,10000,0)`, 노드 SpriteRenderer 및 단일 연결선 메시입니다. 노드 780개를 uGUI 오브젝트로 그리지 않습니다.
- 서버 `build.tree.nodes/edges`와 원본 x/y를 사용합니다. 군주얼 동적 노드와 변환 이름을 정적 좌표 캐시로 덮지 않습니다.
- 할당/경로/회수/초기화는 `core-allocate-ID`, `core-path-ID`, `core-refund-ID`, `core-reset` 명령을 보내며 서버 응답 전 습득 상태를 임의 변경하지 않습니다.
- 닫히면 성좌 카메라는 꺼지고 RT는 재사용합니다. 반복 열기 시 불필요한 RT 재할당을 고친 상태입니다.
- [씬·입력 설정 가이드](SKILL_TREE_VIEWPORT_GUIDE_KO.txt). 주얼 소켓 표시/군주얼 데이터 바인딩과 전체 주얼 장착 패널은 별개입니다.

## 7. 실제 검증과 구분

### 이번 마지막 수정 후 PASS

- 컴파일: 오류 0, 경고 0. 마지막 Play Console 현재 오류 0, 경고 0.
- 1080×1920 / 1080×2340 / 1080×2400 / 1080×2520 / 1536×2048 / 360×640: 각 45건, 총 270건.
- 모든 프로필의 가로 월드 폭 12, 월드 투영 가로/세로 픽셀 비율 1:1, 카메라와 UI 영역 일치, Safe Area 내 버튼, 스킬 정사각형 확인.
- 성좌 입력 18건 재확인. 전투↔성장 24회 및 던전 메뉴 복귀 확인.
- 검증에 사용한 변경 명령은 원본 RogueService를 사용하는 별도 메모리 서버에서 실행했습니다. 저장된 운영 URL은 바꾸지 않았습니다.
- 종료 상태: Play 중지, auto-tick 끔, 배경 실행 override 해제, Game View 원래 선택 복원, 트리 월드 0개.
- [최신 검증 요약](evidence/2026-11-05-mobile/validation-summary.json).

### 이전 작업에서 PASS — 이번에 전부 재실행한 것은 아님

- GLB 20개/클립 19개/포즈 95개 샘플 검사.
- 780노드 × 할당·회수·경로 = 원본 TypeScript와 2,340건 대조.
- 메모리 서버에서 단일 할당, 경로 3P(11→8), 끝 노드 회수, 중간 연결 차단, 초기화, 훈련 레벨 0→1.
- 3개 모바일 해상도에서 성좌 입력 각 18건, 창 12회 열기에서 동일 RT 재사용.
- 이전 자료: [3D 기록](evidence/2026-11-05-mobile/previous-3d-validation.json), [성장 기록](evidence/2026-11-05-mobile/previous-growth-validation.json).

화면 PNG/JPEG 원본은 로컬 `.island-backups/portrait-framing-20261105/`에 보존합니다. Git CLI 인증이 없어 바이너리 파일별 Base64/Blob 전송으로 우회하지 않았습니다. 원격에는 텍스트 문서·코드·검증 수치만 게시했습니다.

## 8. 다음 에이전트 작업 순서

1. 로컬 `AGENTS.md`, `UNITY_HANDOFF_KO.md`, 이 문서 및 최신 검증 JSON을 읽습니다.
2. `unity status --json`으로 열린 프로젝트/Play 상태를 확인합니다. 사용자가 실행 중인 세션을 임의 종료하지 않습니다.
3. 현재 코드 해시를 스냅샷 manifest와 비교하고, 로컬 후속 변경을 초기화하지 않습니다.
4. 검증이 필요하면 Console → 컴파일 → Play → 프레임 진행 → 실제 화면 순서로 진행합니다.
5. 현재 아트·공격 접촉 포즈·경사지형 프레이밍·실기기 터치/폰트/성능 등 남은 작업을 좁혀 진행합니다.
6. 검증 후 문서와 hash/결과를 함께 갱신합니다. 이 스냅샷을 완성 프로젝트로 덮어 적용하지 않습니다.

## 9. 미검증/남은 작업

- 실제 Android/iOS, 노치, 물리 멀티터치, 발열·배터리·GPU 프레임 시간, 플랫폼 빌드.
- Android 후속 작업에서 OFL 한글 글꼴을 번들하고 TMP/GUI에 적용했습니다. 실제 기기별 폰트 표시·성능은 추가 확인이 필요합니다.
- URP 마이그레이션. 현재 Built-in이며 URP Camera Stacking이나 Render Graph를 구현한 것으로 보고하지 않습니다.
- 참조 아트의 질감/조명/배경, 장비별 무기, 전용 스킬/VFX, 정확한 타격 포즈.
- 완성된 주얼 구매·보관함·장착 UI 전체.
- 최신 카메라 하에서 모든 보스/모든 지형 전환을 끝까지 수동 플레이한 결과.

서버 판정/Spine 4.2/빈 기본 스킬 6칸/젬 제거 시 아이콘·시전 차단 정책은 유지합니다. 운영 배포와 저장 정책 변경은 별도 요청 전까지 하지 않습니다.


## 10. 후속 수정 — 성좌 겹침/변환 밀집

2026-11-05 후속 작업은 [노드 밀집 수정 인계](TREE_DENSITY_20261105_KO.md)를 우선 확인하세요. Unity 780개 노드 간격 및 군주얼 안정성 검증, 3비율 입력 54개, 서버 회귀 58개 PASS. 실제 변환 최대 8개 제한은 서버 소스에 준비했으며 **운영 미배포**입니다. Runtime 스냅샷과 manifest를 갱신했습니다.


## 11. Android 테스트 APK와 CI 실패 보정

[Android·CI 최신 인계](ANDROID_TEST_BUILD_20261105_KO.md)를 확인하세요. 테스트 APK 생성/서명/압축·정렬 검증, 번들 한글 폰트, Editor 63개, idle 65개, growth 58개, RPG 타입 검사 PASS. GitHub server run 42099785213 success. 실제 Android 기기 실행과 운영 서버 배포는 미실행입니다.


## 12. 전투 표시 Collider 제거·홀덤 UI/오디오·새 APK

[홀덤·표시 수정 최신 인계](POKER_UI_DISPLAY_FIX_20261105_KO.md)를 먼저 확인하세요. 로비 유지, 표시용 CreatePrimitive 제거, 네이티브 홀덤 UI/실제 웹 BGM 적용. 144 UI/오디오 검사와 실제 격리 서버 콜, 전투 Collider 0 및 새 Development APK 검증 PASS. APK는 IslandGame-Test-Poker-20261105.apk (versionCode 2026110502)입니다. Android 실기기 실행은 UNAVAILABLE. 이번 런타임 소스와 해시를 갱신했습니다.


## 13. 로우폴리 전투·주얼 성좌 적용과 APK .3

[최신 통합 인계](LOWPOLY_JEWEL_UPDATE_20261105_KO.md). GLB 실제 임포트/19클립, 기본 780/907·중첩 832/965, 말단 대형 12개·기본 위치 유지, 입력 54·UI 57·실제 서버 할당 PASS. 기존 전투 최적화도 포함한 Development APK .3 생성/서명/정렬 PASS. S25 실측 미실행. 원격에는 소스/데이터/검증을 게시하고 APK는 로컬 Builds/Android에 있습니다.
