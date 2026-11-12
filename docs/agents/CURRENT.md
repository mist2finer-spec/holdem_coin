# 현재 기준 — 2026-11-12 확인

이 문서는 짧은 시작 요약이다. 세션마다 전체 인계를 다시 읽지 않는다. 아래 SHA는 **게임 내용의 확인 기준**이며 이후 문서 커밋 HEAD와 다를 수 있다.

| 대상 | 확인 기준 |
| --- | --- |
| GitHub 통합 | `main`, 게임 기준 `cbeed3e2` |
| 최신 Unity 게임 작업 | `codex/genshin-environment-20261110`, 게임 기준 `8bce23b7` |
| 과거 로컬 전투 | `codex/local-combat-20261109`, `9f2c4336` — 기본 읽기 제외 |
| 실제 로컬 Unity | `G:/holdem_coin-workspace/island/branches/current-10zone/unity/IslandGame` |
| 작업물/증거 | `G:/holdem_coin-workspace/island/maintenance` |
| 환경 | Unity 6000.0.62f1 / URP 17.0.4 |

**main과 최신 게임 작업 브랜치는 게임 내용이 다르다.** 새 역할 문서의 존재만으로 최신 게임이 main에 병합됐다고 판단하지 않는다. 역할 파일이 현재 checkout에 없으면 위 게임 작업 브랜치에서 해당 경로만 확인한다. 자동 checkout/pull은 하지 않는다.

최신 게임 작업 브랜치의 핵심 상태:

- 일반 1~9구역 Side25D. 10구역은 Side25D 입장 후 보스 등장과 함께 QuarterView.
- MountZone10 원형 초원 전장/2000 HP 보스. 처치 후 바위가 내려가고 마을 진입 시 종료.
- 도트 렌더: 가로640/세로360, 최종32색, 포즈12fps. 설정과 포즈 제한이 결합되어 있다.
- 길티기어풍 3D-to-2D는 준비 단계. 현재 도트 표현을 새 셀 셰이딩 완성으로 간주하지 않는다.
- Craft Anything/ComfyUI는 로컬 연결 확인만 완료. 캐릭터 변형·셰이더 이식·새 게임 빌드는 미실행.
- 세부 참조/도구는 관련 역할만 [REFERENCES](REFERENCES.md)를 읽는다.
- 현재 branch/HEAD/diff로 위 기준 이후 변화가 있는지 **담당 경로만** 확인한다. 실제 실행 여부는 별도 검증한다.

업데이트: 게임 진행·아트 기본값·작업 브랜치가 바뀌면 해당 행만 갱신한다. 긴 일지·검증 로그는 기존 분야 문서에 남긴다.
