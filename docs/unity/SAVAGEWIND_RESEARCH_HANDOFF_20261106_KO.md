# Savage Wind 소스 연구 및 캐릭터 최적화 인계

작성일: 2026-11-06. 사용자 요청: 지정한 `Revivedx/SavageWindRecomp v0.2.0-alpha.2` 소스를 holdem GitHub에 옮겨 캐릭터 흐름·최적화를 연구하고 다른 에이전트가 볼 수 있도록 인계에 연결한다.

## 완료한 범위

- [연구 진입점](../research/savagewind-recomp/v0.2.0-alpha.2/README_KO.md)에 소스 보관 범위, 라이선스, 검증 경계를 기록했다.
- [upstream 소스](../research/savagewind-recomp/v0.2.0-alpha.2/upstream/)는 릴리스 커밋 `ad95614c2c90fc29f4a1ea40de38a70896666e15` 기준이다.
- 원본 430개 중 417개 텍스트/소스를 보관했다. 416개 바이트 일치, SMAA HLSL 1개는 가역 UTF-8 변환. 폰트/아이콘/사전 빌드 `.lib` 13개는 [manifest](../research/savagewind-recomp/v0.2.0-alpha.2/source-manifest.json)에 제외 사유·원본 해시를 남겼다.
- [캐릭터 흐름](../research/savagewind-recomp/v0.2.0-alpha.2/CHARACTER_FLOW_KO.md)에 입력/Npad→guest 실행→NVN/Vulkan과 Unity의 입력→Jint→snapshot→pose/카메라 경로를 대응시켰다.
- [최적화 계획](../research/savagewind-recomp/v0.2.0-alpha.2/OPTIMIZATION_PLAN_KO.md)에 소스 근거, 현재 구현과의 차이, 측정 순서·성공 조건을 작성했다.

## 다음 에이전트가 먼저 알아야 할 점

1. 이 소스에는 Link의 캐릭터 AI/공격/애니메이션 원본 게임 코드가 없다. 호스트 runtime과 recompiler를 연구하는 자료다. 원본은 BOTW 1.8.2 대상이며 이전 zeldaret 1.5.0 주소와 혼용하지 않는다.
2. 실제 Unity 프로젝트는 `G:/new_project/IslandGame`이다. 원격 `unity/IslandGame`은 전체 최신 프로젝트가 아니다. [통합 인계](LOCAL_UNITY_HANDOFF_20261105_KO.md), [구역 통신 인계](STAGE_SYNC_20261105_KO.md), 로컬 후속 변경을 먼저 확인한다.
3. 조사한 `Battle3DView`에는 이미 슬라임 풀 최대 16개, frustum culling, 위치별 60/30/15Hz pose sampling, shared mesh/material, 접지 cache가 있다. 재구현 전에 실제 효과를 측정한다.
4. 우선 조사: Jint step 비용과 JSON 전달/GC → 표시 시계·카메라·공격 접촉 동기 → 첫 shader/VFX 사용 hitch → GPU 그림자/overdraw/해상도.
5. 기존 `.02초` 고정 전투 step과 구역 경계 서버 확정을 유지한다. Savage Wind의 게임별 가변 VFR 주소 패치를 그대로 가져오지 않는다.
6. 자료의 함수/파일은 찾아보기용이다. 전체 10MB 소스나 큰 `exec.c`/manifest/스페인어 개발 문서를 통째로 읽지 말고, `rg`로 심볼을 찾고 필요한 구간만 읽는다.
7. 연구본을 Next.js, Unity Assets, 게임 서버 build에 연결하지 않는다. upstream setup/build를 이 경로에서 자동 실행하지 않는다.

## 검증 상태

| 항목 | 상태 |
|---|---|
| 소스 태그/커밋/경로/해시, 인코딩 변환, 링크 및 diff | PASS — 소스 보관 범위의 무결성 검사 |
| 게임/서버 런타임 코드 변경 | 없음 |
| 실제 화면·애니메이션·사운드 확인 | UNAVAILABLE — 이번 세션에서 Editor/게임 미실행 |
| Savage Wind 빌드, Unity/Android FPS·GC·발열 | UNAVAILABLE — 별도 환경 실측 필요 |

이번 작업은 연구 준비이며 성능 개선 적용 완료가 아니다. 에이전트는 개선 전후 측정값과 실제 화면을 남긴 뒤 평가한다.
