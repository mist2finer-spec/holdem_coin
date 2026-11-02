# Unity 연결 에이전트에게 전달할 작업 지시

아래 블록을 **현재 로컬 Unity에 연결된 Codex의 같은 세션**에 붙여 넣는다.
이 클라우드 작업은 Unity Editor를 직접 실행하지 않았다. 실제 컴파일/셰이더/카메라/터치 검증을 로컬에서 마쳐야 한다.
원격 기본 브랜치의 기존 Unity 파일을 현재 프로젝트에 통째로 덮어쓰면 안 된다.

```text
현재 프로젝트 G:\new_project\IslandGame의 AGENTS.md와 UNITY_HANDOFF_KO.md부터 읽고,
이미 구현한 로컬 uGUI·JSON null 처리·카메라/AudioListener 수정들을 보존해줘.

이번 목표:
Unity 전용 표시 이름 적용 + 던전→10보스 선택→독립 시험 전투→결과/재도전/복귀.
웹 운영판은 수정하거나 배포하지 마. GitHub main에도 병합하지 마.

원본 저장소 https://github.com/mist2finer-spec/holdem_coin
작업 브랜치 feat/unity-ten-boss-test

1. 현재 프로젝트, 참조 저장소의 git status와 백업 상태 확인.
   새 브랜치 소스는 G:\new_project\holdem_coin-boss-test 같은 별도 폴더에 받기.
   기존 폴더가 있으면 임의 삭제·reset하지 말고 브랜치와 변경분부터 확인.
   저장소 루트 및 하위 AGENTS.md 적용 규칙을 읽기.

2. 다음 문서를 읽고 실제 추가/변경 파일 diff 확인:
   docs/unity/BOSS_TRIALS_KO.md
   docs/unity/BOSS_ASSET_COORDINATES.md
   docs/unity/DISPLAY_NAMES_KO.md
   docs/unity/BOSS_FRAMEWORK_REFERENCE.md

3. 준비는 별도 소스 체크아웃에서만 수행:
   python -m pip install Pillow
   python scripts/unity/prepare_assets.py --no-checkout --skip-catalog
   python scripts/unity/validate_export.py
   committed RpgCatalog는 기존 공개 Unity 스냅샷 그대로다.
   주얼49종의 이름 사전은 포함되지만 새 주얼 수치 배열은 이 업로드에 포함하지 않는다.
   카탈로그를 새로 생성해야 하면 필요한 Node/tsx/수학 라이브러리 의존성을 먼저 확인.
   이 단계에서 prepare.ps1 -ProjectPath 현재프로젝트 또는 전체 install_project.ps1을
   실행해 기존 로컬 Runtime/Editor를 덮어쓰지 마.

4. scripts/unity/install_boss_trials.ps1을 읽고 적용:
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/unity/install_boss_trials.ps1 -ProjectPath "G:\new_project\IslandGame"
   새 전투 모듈·표시명 helper·시험 데이터·원본 맵·홍/몬스터 리소스를 추가한다.
   기존 캐릭터/몬스터 파일과 다른 내용도 덮어쓰지 않고 병합 후보로 남긴다.
   기존 내용과 다른 파일은 .island-incoming/boss-trials-*에 병합 후보로 남는다.
   install-report.json의 staged-conflict/manual-merge를 읽고 각 변경을 병합.
   기존 .meta GUID와 uGUI를 유지하고 새 파일에만 Unity가 .meta를 생성하게 한다.
   필수 built-in physics 모듈이 없을 때만 manifest에 추가하며 기존 Spine 경로와 패키지 핀은 보존한다.
   NativeBattle.cs의 null 처리도 기존 로컬 수정과 비교해 수동 병합한다.
   Install 보고만으로 실제 사용 가능하다고 판단하지 않는다.

5. 기존 UI에 진입 연결:
   소스 브랜치 IslandApp.cs / IslandRpgPresentation.cs의 변경을 참고하되,
   사용자의 로컬 uGUI 던전 패널에도 '보스 시험장' 진입 버튼을 연결.
   새 BossTrial UI/시험 화면과 기존 사냥 UI가 동시에 입력·렌더링하지 않게 한다.
   standalone Editor의 Island > Boss Trial Test (new unsaved scene) 진입도 확인.
   기존 씬의 진입은 IslandApp.OpenBossTrials()를 우선 사용해 온라인 세션을 먼저 정리한다.
   기존 패널로 돌아왔을 때 입력·일시정지·오디오 상태가 복원되는지 확인.

6. 이름은 UnityDisplayNames 표시 계층으로 적용:
   UnityDisplayNames.json을 읽어 기존 카탈로그의 표시 복사본에 적용.
   실제 서버 요청의 스킬ID/장비ID/노드ID/주얼변종 값은 바꾸지 마.
   실시간 transformed/cluster 노드는 helper의 NodeName을 사용.
   미장착 액티브6칸은 계속 비활성이고 임의의6개 스킬로 채우지 않는다.
   보스 시험의 전용 기술·스탯은 계정 에르텔/성장과 별개인 시험용임을 표시.

7. 원본 맵/좌표/카메라:
   Resources WebAssets/rpg/maps/candle-dungeon/scene과 textures를 이용.
   진행Z, 높이Y, depthX=-4, 실제 발바닥Y≈10. 기존 서버 x/100 좌표와 혼용 금지.
   staticBatch 정점에 instanceWorld를 다시 곱하지 않는다.
   원본 camera mode와 시험용 follow mode를 각각 확인하고 스크린샷 비교.
   바닥 충돌은 원본 시각 메시에서 파생한 제한된 스트립이며
   원작 전체 Collider/Navigation/CameraFollow가 복원됐다고 보고하지 않는다.

8. 실제 검증:
   Console 오류→컴파일→PlayMode 순서로 해결.
   10보스 모두 선택/입장/패턴/페이즈/피격/승리/패배/재도전/복귀 확인.
   B08은5개 독립 본체 전부 처치해야 승리.
   예고 중 무피해, 노란 표식과 실제 판정 일치, 저탄 점프·상단 공격 슬라이드,
   바닥 공격 좌우 이동, 회피, 일반 이동 몬스터 통과 방지 확인.
   반복 재입장/메뉴 복귀/일시정지 후 위험·소환수·카메라·RenderTexture 누수 확인.
   통신 중단 상태에서도 독립 보스 시험이 가능하며 계정 보상이 지급되지 않는지 확인.
   9:16,9:19.5,9:20에서 기존uGUI/새시험UI 안전영역과 터치 조작 확인.
   자동화 테스트·코드로만 확인한 항목과 실제 플레이 확인한 항목을 분리해 기록.

9. 실패하면 근본원인을 고치고 같은 검사를 다시 수행.
   경고를 숨기거나 검증 조건을 낮추어 통과시키지 않는다.
   스크린샷·Console·테스트 결과와 미완성 항목을 UNITY_HANDOFF_KO.md에 남긴다.
   이번 범위의 읽기/수정/백업/컴파일/테스트는 매번 진행 여부를 묻지 말고 완료까지.
   원격 main 푸시·운영배포·원본 삭제·유료서비스 도입은 하지 않는다.
```

## 전달 결과에서 받을 것

- 실행된 브랜치/커밋, 실제 Editor 버전과 Spine 버전.
- 로컬 변경 병합 결과와 보존한 GUID/백업 위치.
- 10보스별 실제 검증 체크표, 실패·미실행 항목.
- 이름 적용 전후 및 원본/추적 카메라 스크린샷.
- 보스 시험이 온라인 RPG 보상·지갑을 변경하지 않는다는 확인.
