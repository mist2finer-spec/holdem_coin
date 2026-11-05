# 전투 표시 Collider 제거·홀덤 UI/오디오 이식 인계

2026-11-05 요청의 최종 결과. 실제 검증/빌드 완료 시각은 UTC 2026-11-06 02:35:33이다.

## 결과와 실제 대상

- **PASS**: 코드·Editor Play 렌더·격리된 실제 Node 서버 액션·Android Development APK 생성/아티팩트 검사.
- **UNAVAILABLE**: 연결된 Android 기기가 없어 설치 후 전투 진입, CapsuleCollider 로그 재발 여부, 실기기 터치/성능/스피커 청취는 미확인이다. 미술 최종 승인도 별도다.
- 실제 열린 프로젝트 `G:\new_project\IslandGame`, Unity 6000.0.62f1, Built-in, Spine 4.2 유지. 요청의 `G:\Unity\IslandGame`은 존재하지 않았다.
- 씬 `Assets/Island/Scenes/Island.unity` 파일은 수정하지 않았다. 기존 씬에 런타임 UI를 붙인다. 로비 `DrawLobby()` 본문은 이전 백업과 동일하다.
- 라이브 `https://holdem-coin-tavern.onrender.com/api/release` 리비전 `a92b9bde8ed507dd18b77574760dc89e3e191364` 및 주점→싱글 플레이 테이블을 실제 브라우저 390×844에서 확인했다. 서버 규칙/배포 변경은 없다.

## CapsuleCollider 수정

실제 로컬 manifest에는 `com.unity.modules.physics: 1.0.0`이 **이미 있다**. 모듈 누락으로 단정하지 않는다. `CreatePrimitive()`가 메시뿐 아니라 Collider를 자동 생성하므로, 표시용 코드의 해당 의존성을 제거했다. 기존 APK의 정확한 스트리핑 원인은 확정하지 않았다.

- `IslandDisplayMeshes.cs`: Cube/Cylinder/Sphere/Quad 메시를 직접 생성. Unity 기본 형태 크기/UV/정상 법선·와인딩 검사 통과.
- `Battle3DView.Shape()`: MeshFilter/MeshRenderer만 생성하고 타입별 메시 공유. 소유 메시/재질 정리 유지.
- `NativeBattle`: 대체 Spine 바닥의 Quad 생성도 같은 방식으로 변경. Clear 시 메시 캐시 참조 해제.
- Runtime 전체 `CreatePrimitive` 호출 0. 서버/RpgSession 판정, 실제 충돌·피격 규칙은 변경하지 않았다.
- 공식 근거: [Unity CreatePrimitive](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/GameObject.CreatePrimitive.html).

## 홀덤 UI와 오디오

기존 포커 IMGUI 대신 `IslandPokerHud`, `IslandPokerBridge`, `IslandPokerPanel`, `IslandPokerTableSurface`를 추가했다. 루트 Overlay Canvas, 가로 기준 CanvasScaler, SafeArea 내부 균일 스케일로 세로 기기에 대응한다. 기존 로비/전투 Canvas는 유지한다. Graphic 클래스와 파일 이름을 일치시키고 CanvasRenderer를 명시해 실제 메시 콜백/렌더를 검증했다.

- 웹의 청록 펠트·금색 테두리·레일을 uGUI 메시로 표현하고 6/8인 좌석 좌표와 내 좌석 회전을 반영했다. 기존 프로필 9종과 딜러 PNG를 재사용한다. 이름/레벨/칩/폴드/턴·D/SB/BB·베팅·공용/내 카드·타이머·토너먼트 정보를 표시한다.
- 폴드/체크/콜, 배수·올인·팟 비율·직접 칩/BB 입력, 예약 액션/취소, 리바이, 기존 공개 핸드 기록과 쇼다운 상위 5장 강조를 연결했다. 최소 베팅 미만 팟 버튼은 비활성화한다. 중복 전송은 서버의 다음 상태/거절까지 잠근다.
- 판정과 금액 권한은 기존 Socket.IO 서버에 있다. 공개 응답 외 비공개 카드/관리자 분석 API는 조회하지 않는다. 실제 패킷의 `preAction:null`을 JObject로 오인하던 문제를 수정하고 명시적 JSON null fixture로 재검증했다.
- 웹의 실제 `lobby_jazz`를 로비 .24/테이블 .06, 효과음 .65/버튼 .45로 맞췄다. 셔플 루프→배분 효과 전환, 콜/레이즈/올인, 영속 음소거, 배경 전환과 장면 종료 정리를 반영했다. MP3 원본은 기존 Resources를 재사용한다. 포커 베팅 액션에는 중복 버튼 소리를 더하지 않는다.
- `IslandApp.StartRpg()`에서 이전 포커 안내를 초기화해 전투 안내에 남지 않도록 했다. 기존 로비 레이아웃은 그대로다. 기존 `lastDeal` 미사용 필드 컴파일 경고 1건은 남아 있으며 빌드 오류는 0건이다.

## 검증 증거와 재현

[요약](evidence/2026-11-05-poker/validation-summary.json), [빌드](evidence/2026-11-05-poker/build-summary.json), [APK 검사](evidence/2026-11-05-poker/apk-validation.json).

- Editor 1080×1920/2340/2520 각 48개, 총 144개 PASS. 실제 Canvas 메시, 글자 가시성, SafeArea 버튼, 실제 EventSystem Raycast, 합법 액션/예약·입력·중복 방지, 공개 쇼다운 및 오디오 상태를 검사했다.
- Mesh 4종/686 triangles 검사 PASS. 최종 전투 13 actors, 표시 295개/공유 메시 3개/Collider 0, 바닥 오차 0, 프레임 912에서 확인. 현재 Console 오류/경고 0을 확인했다.
- 격리된 실제 Engine.IO/Socket.IO 서버에서 콜 200을 1회 전송, 스택 4800→4600 및 서버 상태 진행 PASS. 운영 사용자/DB는 건드리지 않았다. 기존 `npm run test:poker:profiles` 3개 PASS. 공유 코어 미변경으로 관련 UI/액션 검사를 적용했고 형식 검증은 추가하지 않았다.
- 검증 C#은 evidence의 `ValidatePoker.cs`/`ValidateBattle.cs`/`ValidateLivePoker.cs`에 보관한다. `unity command script run --file C:/Users/SHK/island-poker-review/ValidatePoker.cs --entry ValidatePoker.Main --project-path G:/new_project/IslandGame --caller plugin --skill unity-cli --json`으로 실행했다. 실제 로컬 서버 접속 후 ValidatePoker.Main을 실행하며, fixture가 UI 상태를 바꾸므로 운영 플레이 중 실행하지 않는다. 기존 에디터 스크립트 실행 명령의 `--entry ValidatePoker.Meshes`로 메시 검사도 가능하다.
- 화면은 로컬 `C:\Users\SHK\island-poker-review`의 `web-table.png`, `unity-table-final.png`, `battle-no-collider.png`. 육안으로 테이블·좌석·버튼·문자 표시를 확인했다. 물리 스피커 청취는 미확인이다. 바이너리 원본은 GitHub 텍스트 API로 우회 업로드하지 않는다.
- 마지막 상태: Play 중지, auto-tick/백그라운드 override 해제, 테스트 서버 종료. 테스트 동안 바꾼 서버/이름/토큰 PlayerPrefs는 원래 값으로 복원했다.

## 새 Android Development APK

- 로컬 `G:\new_project\IslandGame\Builds\Android\IslandGame-Test-Poker-20261105.apk` 및 `C:\Users\SHK\island-poker-review\IslandGame-Test-Poker-20261105.apk`.
- 버전 `0.1.0-test.20261105.2`, versionCode `2026110502`, `com.mist2finer.islandgame.dev`.
- ARM64/IL2CPP/OpenGLES3/Portrait/min API 23/target 36, Development + DetailedBuildReport, 디버그 서명.
- 실제 APK 96,264,128 bytes (약 91.80 MiB), SHA256 `978ada24ebb49912885037400f93d6ca0a531176c6acceecb94a99f58ffa466b`.
- ZIP 무결성, v1/v2 서명, 16KB zipalign, 실행 Activity, INTERNET 권한 PASS. Unity BuildReport의 uncompressed totalSizeBytes를 APK 파일 크기로 보고하지 않는다.
- 기존 APK는 보존했다. 동일 테스트 패키지에 `adb install -r <새 APK>`로 업데이트 후 로비→사냥 입장·재입장, 홀덤 입장/액션/음소거를 확인하고 `adb logcat`에서 CapsuleCollider/CreatePrimitive 오류가 없는지 확인해야 한다. 설치/런타임 결과는 아직 UNAVAILABLE이다.

## 다음 에이전트의 파일 기준

이 브랜치의 `unity/IslandGame` 최소 폴더는 로컬 전체 프로젝트와 같지 않다. [source-manifest.json](client-source-snapshot/2026-11-05/source-manifest.json)의 source→snapshot 매핑과 SHA256을 먼저 확인한다. 이번 Runtime C# 및 .meta를 갱신했고, 씬/원본 모델·폰트·오디오는 기존 로컬 자산을 유지한다. 전체 프로젝트 덮어쓰기는 금지한다.

새 프로필 PNG는 저장소 `public/poker/profiles/*.png`에서 로컬 `Assets/Island/Resources/WebAssets/poker/profiles/`로 복사할 수 있다. `localOnlyPokerArt`에 sourceRevision/원본 해시를 기록했고 PNG 메타와 JSON은 스냅샷에 보관했다. `SetupProfiles.cs`로 NPOT None, mipmap 없음, alpha, max512를 적용한다. 전체 PlayerSettings는 게시하지 않고 Android 안전 항목만 manifest에 기록한다. GitHub에는 이번 코드·문서·검증 텍스트만 게시하며 APK/PNG/폰트 바이너리는 로컬에 있다. 운영 배포와 main 병합은 하지 않는다.
