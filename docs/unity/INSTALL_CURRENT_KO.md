# 현재 웹 RPG 반영본 설치

Unity Editor를 먼저 닫습니다. 준비 ZIP은 기존 프로젝트에 덮어쓸 때도 새 프로젝트로 열 때도 사용할 수 있습니다. 기존 저장 데이터와 포커 서버는 이전하지 않습니다.

## 기존 `G:\Unity\IslandGame` 업데이트

ZIP을 다운로드 폴더에 풉니다. ZIP 안의 `IslandGame` 폴더를 기존 프로젝트 안에 다시 넣지 마세요. 압축을 푼 폴더에서 PowerShell을 열고 실행합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install_project.ps1 -ProjectPath 'G:\Unity\IslandGame'
```

현재 `Assets/Island` 코드와 준비된 에셋을 실제 프로젝트 루트에 복사하고 기존 덮어쓰기 대상은 `IslandUpdateBackups`에 보관합니다. 기존 `.meta`, 다른 Assets, ProjectSettings는 유지합니다. 공식 고정 커밋에서 Spine C#·Unity 두 런타임을 함께 받아 로컬 패키지로 설치합니다. Git 설치가 필요하지 않습니다. 의존성 설치가 실패하면 복사된 코드는 남고 오류와 백업 위치를 표시합니다. 전체 업데이트를 원자적으로 되돌리는 스크립트는 아닙니다.

Unity Hub에서는 **Assets / Packages / ProjectSettings가 바로 보이는 `G:\Unity\IslandGame`**을 선택합니다.

## 새 프로젝트로 열기

ZIP 안의 `IslandGame` 폴더를 원하는 위치로 옮깁니다. 다음 명령으로 의존성을 준비한 뒤 Unity Hub의 **Add project from disk**로 그 폴더를 추가합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\repair_project.ps1 -ProjectPath 'G:\Unity\IslandGame'
```

패키지 임포트가 끝나면 **Island → Create integration scene → Play**를 실행합니다. 새 Unity 프로젝트를 안쪽에 다시 만들지 않습니다.

## Spine 네임스페이스 오류

화면의 `Spine`, `Spine.Unity`, `SkeletonAnimation` 오류는 런타임 패키지 해결 실패로 생길 수 있습니다. 기존 manifest의 두 Git URL과 고정 커밋은 실제로 유효합니다. 에디터의 상세 Package Manager 로그가 없어 최초 실패 원인까지 단정하지 않습니다.

수정 스크립트는 Git 의존성을 없애고 두 공식 패키지 전체 파일을 고정 Git tree 해시로 검증한 뒤 함께 설치합니다. 이미 `Assets/Spine` 방식으로 런타임을 설치했다면 중복 설치를 멈추고 안내합니다. 해당 파일을 임의로 지우지 않습니다. 인터넷이 없는 PC에서는 공식 런타임 ZIP을 다른 PC에서 받은 뒤 압축을 푼 루트를 넘길 수 있습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\repair_project.ps1 -ProjectPath 'G:\Unity\IslandGame' -SpineSourceRoot 'G:\Downloads\spine-runtimes-5cb78e77d3711ddcd80c7bd043bb11cf70fcc88c'
```

데이터 버전은 **Spine 4.2**입니다. 기존 4.2 JSON을 4.3 런타임에 바로 넣지 않습니다. 공식 호환 표는 4.2에 대해 Unity 6000.3까지를 명시하므로 사용 중인 **6000.6.6f1은 이 환경에서 검증하지 못했습니다**. 패키지 복구 후 실제 Editor 컴파일·Play 확인이 필요합니다. 출처: https://esotericsoftware.com/spine-unity-installation

## 반영한 RPG 기능

- 기본 액티브 6개는 창고 소유만 유지하고 장착하지 않습니다. 액티브 해제 즉시 전투 칸의 아이콘과 입력이 사라지며 단축키 번호는 그대로입니다.
- 과거 자동 장착과 완전히 같은 미수정 시작 장비만 1회 비웁니다. 커스텀 장비·홈·연결·보조·추가 보관함은 보존하고, 이행 후 직접 장착한 것은 다시 비우지 않습니다.
- 장비 6칸·강화·액티브 35/보조 30 창고·0~6홈·홈 색상·연결·세공·소환·훈련·특성·780개 공용 트리 화면과 기존 서버 명령을 연결했습니다.
- 새 웹 스냅샷의 생략 필드는 같은 세션/빌드 버전에서만 보존합니다. 무기 변경 시 네이티브 Spine 리그를 교체합니다. HP는 막대로, 피해는 정수 라벨로 표시합니다.

권한 서버는 기존 Node 서비스입니다. 현재 Unity 화면은 기능용 IMGUI이며 웹의 모든 아트/VFX/주얼 상점/터치 UX까지 완성된 제품으로 간주하지 않습니다. 원본에서 찾지 못한 몬스터 그래픽 17종도 그대로 명시합니다. 과거 별도 브랜치에 있던 오프라인/전용 8인 싱글 기능은 현재 서버에 없어 버튼을 비활성화했습니다. 새 영구 DB를 추가하지 않았습니다.

이 환경에서는 Unity Editor와 .NET SDK를 실행할 수 없어 전체 컴파일·PlayMode·Windows/Android 빌드는 미실행입니다. 동봉 코드·에셋·웹 서비스 검증과 실제 Unity 실행 검증을 구분합니다.
