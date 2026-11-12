# Island / holdem_coin

**역할로 바로 시작:** [13개 역할 안내](docs/agents/README.md) · [현재 게임 기준](docs/agents/CURRENT.md) · [gameplay-dev](.agents/roles/gameplay-dev.md) · [reverse_eng_designer](.agents/roles/reverse_eng_designer.md)

`gameplay-dev를 읽고 작업준비`처럼 요청하면 공통 규칙·현재 요약·선택 역할만 읽습니다. 로컬에서는 `node scripts/agents/context.mjs gameplay-dev`로 같은 묶음을 출력합니다.


게임의 공통 시점은 **일반 구역 Side25D, 보스전 QuarterView**입니다. 최신 Unity 게임 작업과 main의 게임 내용은 다르므로 [현재 기준](docs/agents/CURRENT.md)에서 대상 브랜치와 진행 상태를 먼저 확인합니다. 역할 문서 정리는 게임 브랜치를 main에 병합하는 작업이 아닙니다.

| 작업 | 시작 위치 |
| --- | --- |
| 실제 Unity 프로젝트 | [unity/IslandGame](unity/IslandGame) · [현재 인계](unity/IslandGame/UNITY_HANDOFF_KO.md) |
| 작업 규칙 | [AGENTS.md](AGENTS.md) |
| 웹 클라이언트·공유 게임 코드 | [src](src) |
| 홀덤 서버 | [mini-services/poker-server](mini-services/poker-server) |
| 현재 웹 리소스 | [public](public) |
| 정리·브랜치·과거 자료 조회 | [GitHub 통합 기록](docs/maintenance/GITHUB_CONSOLIDATION_20261110_KO.md) |
| 11월 10일 통합 기준 APK | [10구역 테스트 릴리스](https://github.com/mist2finer-spec/holdem_coin/releases/tag/island-current-10zones-20261110.3) · 최신 작업 빌드는 해당 브랜치 인계 확인 |

## 브랜치

- `main`: 검증된 통합 기준. 이 브랜치에 실제 Unity 프로젝트와 웹·홀덤 소스가 함께 있습니다.
- `codex/genshin-environment-20261110`: 현재 10구역 Unity 작업 브랜치. 로컬에서 실행 중인 Editor가 사용합니다.
- `codex/local-combat-20261109`: 11월 9일 로컬 전투 기준점. 과거 low-poly 일반 맵을 현재 기준으로 다시 사용하지 않습니다.

과거 브랜치는 `history/20261110/` 태그에서 확인합니다. [브랜치별 커밋 목록](docs/maintenance/branches-20261110.csv)에 원래 이름, 정확한 SHA, 보존 위치를 기록했습니다. 고유 이력은 보존하며 과거 실험 기능을 현재 게임에 일괄 적용하지 않습니다.

## 로컬 작업

작업 루트는 `G:/holdem_coin-workspace/island`, 실제 Unity는 `branches/current-10zone/unity/IslandGame`입니다. 루트의 `Open-Unity.ps1`로 엽니다. Unity 버전은 프로젝트의 `ProjectSettings/ProjectVersion.txt`를 따릅니다.

바르디안 단일 분석 ZIP, 비공개 DB·환경 설정, Unity Library/빌드 캐시는 로컬 작업 루트에서 관리합니다. GitHub 소스에 중복 압축본이나 비공개 설정을 추가하지 않습니다. Unity 최신 APK와 해시·검증 요약은 릴리스에 둡니다.

이동속도는 이전 대비 2/3이며, 장애물 앞에서도 이동 입력 중에는 달리기 모션이 진행됩니다. 최신 APK의 Unity·블루스택 검증 기록은 프로젝트 인계를 확인합니다. 원신 원본 대비 90% 일치율은 아직 측정하지 않았습니다.

## 검증과 운영

GitHub Actions는 홀덤·공유 RPG 회귀 검사를 실행합니다. APK/Unity 실행 검증과 자동 회귀 검사는 별도 결과로 기록합니다.

이번 저장소 통합 커밋은 `[skip render]`로 운영 배포를 제외했습니다. `main` 소스와 실제 운영 중인 Render 리비전은 다를 수 있습니다. 운영 배포는 별도 요청과 실행 검증을 따릅니다.
