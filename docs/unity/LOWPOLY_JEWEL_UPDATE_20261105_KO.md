# 로우폴리 전투·주얼 성좌 Unity 적용과 Android 테스트 빌드

최신 통합 브랜치: **assets/unity-lowpoly-combat**. 모델 제공 커밋 `d9cf41fbe12a5a72c1283fc099ce5e4be4fe5b73` 위에 이번 Unity 적용·검증 결과를 기록한다. 모델 바이너리 두 개는 그 커밋에 이미 있으며 다시 업로드하지 않는다. main/운영 서버는 변경하지 않았다.

## 결과 상태와 실제 프로젝트

**PASS:** 실제 Unity 임포트/클립 변형, Editor 전투와 성좌 렌더, 노드/연결·주얼 확장·입력·서버 할당 검사, Development APK 생성/서명/정렬 검증. **UNAVAILABLE:** Android 설치·실기기 플레이/터치·S25 CPU/GPU/FPS/발열. 연결된 adb 기기가 없다. 미술·사용성 최종 승인은 별도다.

실제 프로젝트는 `G:\new_project\IslandGame`, Unity **6000.0.62f1 / Built-in / Spine 4.2**다. `Assets/Island/Scenes/Island.unity`는 저장·수정하지 않았다. 런타임에 기존 씬에서 화면을 구성한다. 기존 로비 UI와 서버 전투/성장·저장 권한을 유지한다. 전투 Stage-Sync 두 패킷 전환은 이번에도 포함하지 않았다.

## 모델과 전투 표시

| 모델 | Unity 정점 | 삼각형 | 본 | 임포트 클립 |
|---|---:|---:|---:|---:|
| PinkGlass_5000 | 2,808 | 5,000 | 65 | 18 |
| Slime_300 | 149 | 299 | 3 | 1 |

GLB SHA256은 [원본 manifest](assets/lowpoly-combat/manifest.json)와 실제 G 드라이브 파일까지 동일했다. PinkGlass `ae1bdeb9be983b95c20eb67416ca5391d53f31ee83a484f7fd71a4c41eaec42d`, Slime `246b867b44baa0733bd155b16d1e9d2cb5a61bd1cd8ab705e973361ffaf066bf`.

새 폴더 `Assets/Island/Art/Battle3D/LowPoly/`에 기존 glTFast로 가져왔다. Import animation method는 기존 프로젝트와 같은 Mecanim이며 AnimationClip.legacy는 false다. 이것을 실패로 보지 않았고, **전체 19클립에서 실제 샘플링 후 스킨 메시 변형을 확인**했다. Actor의 Animator는 꺼 두고 기존 표시 시계가 SampleAnimation을 제어한다. 기존 hero/slime 재질, 높이 1.3/0.62와 yaw 90은 유지했다.

`Resources/Battle3DAssets.asset`가 실제 새 모델/클립을 참조한다. idle은 기존과 같이 idle_loop다. 기존 런타임 16개 hero 필드와 slimeIdle을 새 GLB 서브 에셋으로 연결했다. sword_idle/walk_loop도 임포트·변형 검사했지만 기존 런타임 필드에서는 사용하지 않는다. 원본 비교 설정은 로컬 `Art/Battle3D/LowPoly/Battle3DAssets-Original.asset`에 보존했다.

앞선 로컬 최적화도 이번 APK와 소스 스냅샷에 포함했다. Battle3DView의 런타임 BakeMesh/정점 순회/개체별 baked Mesh 0, 애니메이션별 오프라인 접지 캐시, 전용 전투 카메라 frustum 컬링, 60/30/15Hz ID 분산 샘플, 비활성 슬라임 pool 상한 16, 서버 표시 좌표 보간을 유지한다. GPU skinning은 GPUBatched다. 이는 판정용 로컬 AI/피격 시뮬레이터가 아니다.

`Resources/BattleGroundingProfile.json`은 새 저폴리 메시로 다시 생성했다. 16 hero + 1 slime 클립을 240 samples/sec로 저장하며 런타임 테이블 조회는 O(1)이다. 실제로 240fps 재생하는 것이 아니다. 1,168개 별도 시점에서 최대 접지 오차 **약 1.85mm**. 원래 고폴리용 캐시를 재사용하지 않았다. 모델·바인드포즈·클립 변경 시 다시 생성해야 한다. 현재 정점 수/길이 호환 검사는 같은 길이의 커브 수정까지 감지하지 않는다.

## 주얼 성좌 적용 범위

검토한 표시 배치를 `Resources/SkillTreePresentationV2.json`로 가져왔다. 원본 서버 좌표/ID/스탯/실제 연결/비용/저장은 그대로다. 기본은 780/907, 실제 서버 함수가 만든 중첩 예시는 **832/965**이며 모두 빠짐없이 표시했다. 시안과 Unity 위치 최대 오차는 약 0.0000077 월드 단위다.

- 기본 대형 소켓 12개 모두 실제 차수 1을 유지한 **바깥 말단**이다. 각 소켓에 대형 10 + 중형 2×5 + 소형 2×3 = 추가 26노드의 완전 확장 공간을 고정 예약했다. 기본 노드를 장착 순간 밀지 않는다.
- 핵심은 중간/마지막 목표로 배치했다. 도끼 Bloodless Covenant는 중간, Resolute Technique는 끝 목표다. 노드별 빈자리/표시상 8개 밀도 제한을 새 배치의 원리로 사용하지 않는다.
- 실제 clusterId/tier와 부모 소켓 edge로 대형→중형→소형을 해석한다. 52개 추가 노드가 독립 검토 시안 위치와 일치했고, 장착·해제/배열 순서/이름·설명 변화에 기본 좌표가 유지됐다. 알 수 없는 형식은 경고와 별도 추가 레인에 표시하며 버리지 않는다.
- 기본 선은 실제 edge별 경로를 쓰고, 동적 선은 실제 edge를 테두리에서 잘라 배치 메시로 그린다. 선택 경로는 PreviewPath의 **연속한 쌍**만 강조한다. 선을 합쳐 가짜 접점을 만들지 않았다.
- 속성 채움과 상태 테두리를 공유 atlas의 SpriteRenderer로 분리했다. STR/DEX/INT/혼합/ALL 색, 일반:주요:핵심 1:1.6:2.2, 시작점 이중 원과 소켓 마름모를 적용했다. 새 Material을 노드마다 만들지 않는다. renderer 수가 늘어난 비용은 실기기에서 추가 측정해야 한다.
- 군집 범위 기반 내 시작점, 전체 보기, 확대 상태에서 작은 노드 탭 후 확대, 기존 팬/핀치/탭·ScrollRect 복원을 유지했다. 선 두께는 줌 버킷 변화 때 재사용 버퍼로 갱신한다.
- 성장 요약/안내를 줄이고 트리 영역을 확대했다. 도움말과 상세 접기/펼치기를 추가했고 배우기/경로/회수는 접힌 상태에도 보인다. 전체 회수는 상세 펼침에 있다. 훈련/특성 UI 전체를 다시 만들지 않았다.

**아직 남은 표시 품질:** 도끼 109개/135개 edge 기준 proper 교차는 기존 225→12, 다른 노드 관통 38→0이다. 말단/공간 조건을 적용하면서 초기 시안의 3교차보다 증가했다. 최장 연결은 18.346 표시 단위로 남고 P95 7.807이다. 전체 다른 영역/중앙의 최종 통로 가독성과 전체 그래프 교차 0을 보장하지 않는다. 표시 데이터는 기존 검토 시안을 적용한 첫 Unity 버전이다.

기존 서버의 무궁한 주얼 최대 8개 대상/장착 order 우선순위는 변경하지 않았다. 표시 좌표로 효과 대상을 재계산하거나 운영 응답을 임의로 8개로 자르지 않는다. 기존 인계상 이 제한은 운영 미배포 상태였으므로 이 클라이언트 빌드를 서버 배포로 오해하지 않는다. **주얼 구매/보관/장착 전체 신규 UI는 이번 작업 범위가 아니며, 서버 응답의 확장 표시를 적용했다.**

## 검증과 실제 화면

[검증 요약](evidence/2026-11-05-lowpoly-jewels/validation-summary.json), [모델 임포트](evidence/2026-11-05-lowpoly-jewels/model-import.json), [그래프 검사](evidence/2026-11-05-lowpoly-jewels/tree-geometry.json), [빌드](evidence/2026-11-05-lowpoly-jewels/build-summary.json).

- 19개 임포트 클립 변형 검사 38개 PASS. 메시/본 수와 clip curve 바인딩을 확인했다.
- 그래프 2,423 assertions PASS: 기본/확장 ID·edge 수, 실제 표시 위치, 모든 대형 말단, 기본 좌표 장착/해제 불변, 입력 순서·이름·설명 변경 시 캐시 유지, 원본 데이터 불변.
- 1080×2340 / 360×640 / 1080×2520: 입력 18개씩 총 **54개**, UI 19개씩 총 **57개** PASS. uGUI raycast, 좌표 역투영, 드래그/핀치, 취소/부모 스크롤 복원, pan/zoom clamp, SafeArea 버튼, 접힘/펼침을 검사했다.
- 격리 메모리 RogueService HTTP에서 실제 UI 배우기 클릭 후 `attr_0_0` 할당, 포인트 12→11, 서버 확인/중복 대기 보호 PASS. 운영 계정·DB는 건드리지 않았다.
- 최적화 검사 1,215 assertions PASS. 반복 20웨이브×12모델 재사용, 화면 밖 60프레임 SampleAnimation 0회, 가장자리 16회, 새 메시 접지 참조 검사 포함. FPS/GC/발열 측정치로 보고하지 않는다.
- 실제 Play 화면에서 새 캐릭터/슬라임 전투, 기본 성좌와 대형·중형·소형 중첩을 확인했다. local screenshots는 `C:\Users\SHK\island-lowpoly-jewel-review`의 battle-lowpoly.png / tree-default.png / tree-expanded.png. PNG를 텍스트 API로 우회 업로드하지 않았다.
- 마지막 코드 변경은 요약의 안내 2줄을 한 줄로 정리한 것뿐이며 그 뒤 컴파일을 통과하고 빌드했다. 빌드 오류 0, 기존 IslandApp.lastDeal 미사용 경고 1. 공유 서버 코어 미변경이므로 전체 회귀/형식 검증을 추가하지 않고 관련 UI·실제 액션 검사를 적용했다.

테스트 C#과 생성기는 같은 evidence 폴더에 있다. `unity command script run --file <파일> --entry ValidateTreeV2.Models` / `.Geometry`, `ValidateTreeInput.Main`, `ValidateTreeView.Main`, `ValidateOptimizations.Main` 등을 사용했다. --project-path G:/new_project/IslandGame --caller plugin --skill unity-cli를 붙인다. fixture 경로/출력은 이 검토 PC의 C 경로이므로 다른 체크아웃에서는 바꿔야 한다. 테스트 중 임시 DTO를 쓰는 Expanded 검사는 운영 플레이 중 실행하지 않는다. 서버 생성 예시 fixture는 export-expansion.cjs로 재생성할 수 있다.

## Android APK

- 파일: `G:\new_project\IslandGame\Builds\Android\IslandGame-Test-LowPoly-Jewels-20261105.apk` (검토 폴더에도 동일 파일).
- 버전 **0.1.0-test.20261105.3**, versionCode **2026110503**, package `com.mist2finer.islandgame.dev`.
- ARM64 / IL2CPP / OpenGLES3 / Portrait / API 23~36 / Development + DetailedBuildReport / 디버그 서명.
- 실제 파일 **95,829,167 bytes** (약 91.39 MiB). SHA256 **4da03684186dabd1e64459aea50dc9d37bfece6379093d9a4fff139e74c37d10**.
- ZIP 무결성·v1/v2 서명·16KB zipalign·실행 Activity·INTERNET 권한 PASS. BuildReport의 uncompressed totalSizeBytes를 APK 크기로 쓰지 않았다. 기존 테스트 APK는 보존했다.
- [APK 검사 기록](evidence/2026-11-05-lowpoly-jewels/apk-validation.json). 실제 Android 기기가 없어 설치/게임 입장/로그캣·S25 속도는 아직 UNAVAILABLE이다. `adb install -r <파일>` 후 전투 재입장, 슬라임 다수 웨이브, 성장/주얼 전개와 로그캣을 확인해야 한다.

**APK는 GitHub에 첨부하지 못했다.** Git CLI 쓰기 인증을 dry-run으로 확인했지만 자격 증명이 없고, 연결된 GitHub 도구는 UTF-8 텍스트 커밋만 제공하며 release-asset 업로드 기능이 없다. 바이너리를 Base64/Blob으로 우회 업로드하지 않았다. 이번 GitHub 게시 범위는 코드·설정 메타·표시/접지 데이터·검증·문서이며 APK는 위 로컬 경로에 있다.

## 다음 에이전트의 기준

1. 이 문서와 [source-manifest.json](client-source-snapshot/2026-11-05/source-manifest.json)을 먼저 읽는다. Runtime/Resources/LowPoly meta의 source→snapshot 경로와 SHA256을 갱신했다. **저장소 unity/IslandGame은 전체 최신 로컬 프로젝트가 아니므로 덮어쓰지 않는다.**
2. GLB는 이 브랜치 assets/lowpoly-combat 원본에서 manifest의 실제 Assets 경로로 복사하고 메타 GUID를 유지한다. Battle3DAssets.asset가 새 GUID/clip fileID를 참조한다. 전체 ProjectSettings는 게시하지 않고 안전한 Android·GPU 설정만 manifest에 기록했다. 원래 모델/폰트/오디오 경계도 유지한다.
3. 이번 작업 전 현재 로컬 변경(이전 전투 최적화)을 보존했고, 추가 백업은 `.island-backups/lowpoly-jewels-20261105/`다. 원본 비교 설정과 원래 접지 캐시는 함께 복원해야 정확한 비교가 된다.
4. 완료 상태: Play 중지, auto-tick/백그라운드 override 해제, 테스트용 prefs(서버/이름/토큰) 원래 값 복원, 메모리 서버 종료. Scene SHA256은 `7ad746ca1498a7623219d8e6ddd3873472b1ee61982eac0f4cd3ede71f5b71e1`로 불변이다.
5. 다음 우선순위는 **S25 실측**과 남은 연결선/전체 영역 가독성이다. 이 빌드로 S25 렉 해결을 확정했다고 보고하지 않는다. Stage-Sync는 별도 서버 재검증 계약/입력 로그가 필요한 후속 작업이다.
