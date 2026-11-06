# Savage Wind Recomp — 고정 소스 연구본

사용자 요청일: 2026-11-06. 목적: 지정 릴리스 소스를 보관하고, 캐릭터 처리 흐름과 최적화를 다음 에이전트가 연구할 수 있게 한다.

- 원본: [Revivedx/SavageWindRecomp](https://github.com/Revivedx/SavageWindRecomp)
- 릴리스: [v0.2.0-alpha.2](https://github.com/Revivedx/SavageWindRecomp/releases/tag/v0.2.0-alpha.2), 2026-10-22 공개
- 고정 커밋: `ad95614c2c90fc29f4a1ea40de38a70896666e15`
- holdem 조사 기준: `0401c1d168dff6c8123f29a2c56efbe743b8e4d7`

## 먼저 읽기

1. [캐릭터 흐름과 소스 지도](CHARACTER_FLOW_KO.md)
2. [최적화 연구·측정 계획](OPTIMIZATION_PLAN_KO.md)
3. [Unity 에이전트 인계](../../../unity/SAVAGEWIND_RESEARCH_HANDOFF_20261106_KO.md)
4. 필요한 함수만 [upstream/runtime](upstream/runtime), [upstream/tools](upstream/tools)에서 읽는다.

이 저장소는 BOTW 1.8.2를 대상으로 하는 **정적 재컴파일 도구와 호스트 실행 환경**이다. Link의 캐릭터 컨트롤러, AI, 전투 수식, 애니메이션 그래프 원본은 포함되지 않는다. 생성된 게임 코드는 사용자의 게임 파일에서 로컬로 만들어지는 별도 자료다. 이전에 참조한 `zeldaret/botw`의 1.5.0 디컴파일과 버전·목적·주소를 혼용하지 않는다.

## 보관 범위와 무결성

원본 Git tree 430개 파일 중 **417개 소스·텍스트 파일**을 `upstream/`에 보관했다. `runtime/` 106개, `tools/` 59개와 루트/문서/third_party의 텍스트를 포함한다. 원본 소스 로직은 수정하지 않았다.

- 416개: 릴리스 커밋의 원본 Git blob 바이트 그대로.
- `third_party/smaa/SMAA.hlsl` 1개: ISO-8859-1 텍스트를 UTF-8로 가역 변환. CRLF는 유지한다. 원본/보관본 해시를 모두 기록했다.
- 아이콘 3개, 폰트 8개, 사전 빌드 GLFW `.lib` 2개: 총 13개 바이너리는 제외했다.
- Windows 릴리스 ZIP, 실행파일, 게임 ROM/ExeFS/RomFS, 생성된 게임 C 코드·DLL·shader cache는 가져오지 않았다.
- 전체 경로, 파일 크기, SHA-256, Git blob SHA, 제외 사유는 [source-manifest.json](source-manifest.json)에 있다. 이 파일은 40KB를 넘으므로 통째로 대화에 넣지 말고 필요한 레코드만 읽는다.

해시는 checkout의 줄바꿈 변환 전 **Git blob** 기준이다. 원본 `.gitattributes`도 보존했으므로 Windows 프로젝트 파일 등을 checkout하면 작업 폴더의 줄바꿈이 바뀔 수 있다. 엄밀한 재검증은 `git show <commit>:<path>`의 바이트로 수행한다.

이것은 **소스 열람용 스냅샷**이며 빌드 가능한 완전한 바이너리 미러가 아니다. 전체 원본이 필요하면 위 고정 커밋을 별도 작업 폴더에 checkout한다. 이 보관본 안에서 setup/build를 실행하거나 게임 자료를 추가하지 않는다.

## 라이선스와 경계

원본 프로젝트/LAS Recomp 코드는 [MIT LICENSE](upstream/LICENSE)를 유지한다. `third_party/`는 각각의 원본 라이선스가 적용되므로 해당 notice도 함께 보관했다. MIT 표시를 Nintendo 게임 코드나 third_party 전체의 라이선스로 확대 해석하지 않는다.

연구본은 `docs/`에 격리되어 있고 Next.js, Unity Assets, 게임 서버의 import/build 경로에 연결하지 않았다. 중첩된 `upstream/.github/`는 참고 원본이며 저장소 루트의 Actions 설정으로 등록하지 않았다. 런타임 성능 개선을 적용한 커밋이 아니다.

## 검증 상태

- **PASS**: 고정 태그/커밋 대조, 430개 원본 레코드와 417개 보관 파일 대조, 416개 바이트 일치 및 1개 인코딩 왕복 검증, 파일 경로/해시/문서 링크 검사.
- **UNAVAILABLE**: Savage Wind 게임 실행/빌드, 실제 Unity Editor/Android 렌더, FPS·GC·발열 측정. 원본 README의 PC 측정치를 holdem이나 Galaxy S25 성능으로 보고하지 않는다.

다음 에이전트는 아래 두 연구 문서에서 **소스로 확인한 사실**, **프로젝트 적용 가설**, **실측이 필요한 항목**을 구별한다. 라이브 코드/아트/카메라/서버 저장 계약 변경은 이 소스 보관 작업에 포함하지 않는다.
