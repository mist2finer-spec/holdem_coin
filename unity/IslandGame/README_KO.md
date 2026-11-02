# Island — 현재 웹 RPG를 연결한 Unity 클라이언트

준비 ZIP 최상위의 `START_HERE_KO.md`를 따라 설치합니다. 저장소에서는 `docs/unity/INSTALL_CURRENT_KO.md`가 같은 안내입니다.

현재 웹의 장비 6칸, 에르텔 35/30종, 0~6홈·색상·연결·세공·소환·훈련·특성·780개 공용 트리를 기능용 Unity IMGUI 화면과 기존 서버 명령에 연결했습니다. 기본 액티브는 소유만 하고 미장착이며, 액티브 해제 시 전투 칸이 비활성 빈칸으로 바뀝니다. `RpgCatalog.json`은 현재 TypeScript 원본에서 생성합니다.

**전투·가격·성장·저장·포커 규칙의 권한은 기존 Node 서버입니다.** 서버 없는 오프라인 C# 엔진이나 완성된 웹 아트/UX 복제본이 아닙니다. 기본 접속 서버는 `https://holdem-coin-tavern.onrender.com`이며 Server settings에서 변경할 수 있습니다. 서버도 같은 현재 소스를 실행해야 신규 정책이 반영됩니다. 새 영구 DB는 만들지 않습니다.

## 소스 체크아웃에서 기존 프로젝트 업데이트

Unity를 닫고 저장소 루트에서 실행합니다. Python3/Pillow, Node.js 및 저장소 npm 의존성이 필요합니다. 공식 Spine 런타임 설치에는 Git이 필요하지 않습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\unity\prepare.ps1 -ProjectPath 'G:\Unity\IslandGame'
```

준비 ZIP 사용자는 Node/Python으로 다시 내보낼 필요 없이 동봉 `install_project.ps1`을 사용합니다. Unity Hub에는 `Assets`, `Packages`, `ProjectSettings`가 바로 있는 폴더를 추가합니다. `My project (1)`처럼 프로젝트를 안쪽에 다시 만들지 않습니다. 에디터에서 **Island → Create integration scene → Play**를 선택합니다. 기존 수정 씬은 저장 여부를 확인하고, 이미 있는 Island 씬은 열기만 합니다.

## 의존성 복구

`Spine` / `Spine.Unity` / `SkeletonAnimation` 오류에 대한 복구 스크립트는 `scripts/unity/repair_project.ps1`입니다. 기존 Git manifest URL 두 개는 유효하므로, 잘못된 URL이었다고 단정하지 않습니다. 스크립트는 같은 고정 커밋의 공식 C#·Unity 패키지를 로컬 sibling 패키지로 설치하고 전체 파일을 Git tree 해시로 검증합니다. 이미 `Assets/Spine` 런타임이 있으면 중복 설치를 멈춥니다. 자세한 오프라인 경로는 설치 안내를 봅니다.

Spine 데이터와 런타임은 4.2를 유지합니다. 공식 호환 표는 4.2에 대해 Unity 6000.3까지이며 **6000.6.6f1의 실제 컴파일/렌더링은 미검증**입니다. https://esotericsoftware.com/spine-unity-installation

## 검증과 남은 범위

웹 회귀 340개와 RPG TypeScript 검사 통과. 실제 현재 Node 서버의 Engine.IO handshake/ack/6인 입장/비공개 카드/8인 캐시 제한 통과. 에셋 229개 해시·Spine4.2 JSON/atlas 참조·35/30/780 카탈로그·미장착 시작 상태 검사 통과. C#13개 소스 구문 파싱 통과.

실제 서비스에서 생성한 fresh/equip/remove 스냅샷으로 C# 계약 테스트를 추가했습니다. **.NET SDK 및 Unity Editor가 없어 C# 계약 실행, Unity semantic compile, PlayMode, Windows/Android 빌드는 실행하지 못했습니다.** 구문 검사로 이 결과를 대신하지 않습니다. PowerShell도 이 환경에서는 구문 검사만 수행했습니다.

```sh
python scripts/unity/prepare_assets.py --no-checkout
python scripts/unity/validate_export.py
python scripts/unity/check_csharp.py
node scripts/unity/contract_probe.mjs
dotnet run --project scripts/unity/contracts/Contracts.csproj
python scripts/unity/package_project.py --output IslandGame-current.zip
```

전체 VFX/장판/주얼 상점·초월·주얼 장착 UI, 최종 Canvas/UIToolkit 아트 배치, 실기기 터치 QA는 미완료입니다. 원본 파일이 없는 몬스터17종은 `AssetIndex.json.unresolvedMonsterAssets`로 명시합니다. 일부 월드/몬스터 표현은 이전 네이티브 표시 기반을 유지합니다. 맨손 외형은 도끼 리그 fallback입니다. 과거 다른 브랜치의 `UNITY_SOLO` 전용8인 모드는 현재 백엔드에 없어 버튼과 실행 스크립트를 비활성화했습니다. 온라인6인·8인 토너먼트의 서버 규칙은 바꾸지 않았습니다.
