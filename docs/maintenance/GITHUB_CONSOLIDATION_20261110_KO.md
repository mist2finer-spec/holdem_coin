# GitHub 통합·브랜치 정리 — 2026-11-10

사용자 요청: “깃허브도 같은 형식으로 정리해서 통합 및 브랜치 정리.”

현재 소스 기준은 새 일반 10구역 Unity 프로젝트다. 일반은 Side25D, 보스만 QuarterView이며 현재 보스 맵과 홀덤 게임을 보존한다. 루트 [README](../../README.md)에서 실제 프로젝트·서버·인계·APK를 찾을 수 있다.

## 브랜치 구성

기존 원격 브랜치 66개를 확인했다. `main`, `codex/genshin-environment-20261110`, `codex/local-combat-20261109` 세 개를 유지하고 나머지 63개를 정리한다. 통합 시 main과 현재 작업 브랜치는 동일한 검증 커밋을 가리킨다. 11월 9일 브랜치는 고정 기준점이다.

각 브랜치의 정리 직전 HEAD를 `history/20261110/<원래 브랜치 이름>` 태그로 먼저 보존하고, GitHub의 태그 SHA 일치를 검증한 뒤 브랜치를 삭제한다. [66개 브랜치 원장](branches-20261110.csv)에 이름·SHA·태그·현재 소스에 없는 커밋 수를 기록했다. 이력 연결이 없는 과거 별도 저장소 계열도 포함하며, 단순히 이름이나 날짜로 삭제하지 않았다.

현재 소스와 동일한 내용이 반영된 과거 문서 PR #9는 통합에 따라 닫는다. PR의 두 문서는 현재 파일과 말미 공백만 다름을 확인했다. 과거 문서에 제시된 일반 쿼터뷰 도입 제안은 현재 최상위 규칙으로 대체됐으며 실제 구현 지시로 사용하지 않는다.

과거 브랜치의 실험 코드·에셋은 태그로 조회하고 필요한 변경만 새 작업 브랜치에서 검토한다. 과거 모든 실험을 현재 게임에 병합하지 않는다.

복원 예시:

```sh
git fetch origin tag history/20261110/docs/unity-video-style-audit-20261109
git switch -c review/old-visual-plan history/20261110/docs/unity-video-style-audit-20261109
```

## 파일과 릴리스

- 실제 Unity 프로젝트는 `unity/IslandGame` 하나다. 빌드 입력은 이전 검증 커밋 `e460b37490265a523670b77b56756201007d9086`과 동일하다.
- 저장소 루트의 옛 테스트 캡처, 과거 문서의 미디어, `docs` 아래 중복 Unity 프로젝트 사본 317개(170,804,608 bytes)를 현재 트리에서 제거했다. [파일 원장](retired-files-20261110.csv)에 원래 경로·Git blob·크기·보존 커밋을 기록했다. 영향을 받는 Markdown 링크는 보존 커밋으로 연결한다.
- 현재 source-environment/side-view-motion 검증 화면과 모든 진행 문서는 유지한다. 홀덤 서버·웹 리소스·보존된 홀덤 아트는 그대로 둔다.
- 과거 릴리스 7개의 APK·ZIP·영상은 [진행·첨부 목록](retired-releases-20261110.json)으로 기록하고, 새 릴리스의 APK 업로드·SHA 확인 후 제거한다. 기존 소스 태그는 유지한다.
- 최신 테스트 APK는 `island-current-10zones-20261110.3` 릴리스 하나로 제공한다. v0.1.0-test.20261110.3, versionCode 2026111003, 138,941,520 bytes, SHA256 `cea69654af2dece84f910939b3ef5b1ff9c479da4d276c712dbc13b4b194ab38`.
- 로컬 바르디안 단일 ZIP과 비공개 DB·환경 설정은 이 GitHub 저장소에 새로 업로드하지 않는다. 위치는 로컬 통합 인계를 따른다.

Git 커밋 이력과 태그를 보존하므로 전체 Git 객체 크기가 삭제 파일 합계만큼 줄었다고 해석하지 않는다. 과거 리비전과 소스 태그는 조회할 수 있고, 과거 릴리스 첨부 다운로드 URL은 정리 후 사용할 수 없다. 최신 APK 링크는 루트 README를 따른다.

## 검증과 운영

이번 추가 정리는 문서·과거 사본·브랜치·릴리스 구성 변경이다. Unity Assets/Packages/ProjectSettings, 홀덤 및 공유 게임 런타임은 변경하지 않는다. 기존 APK의 Unity·블루스택 10구역→보스 승리 검증과 해시를 재사용하고, GitHub 통합 커밋의 전체 회귀 검사를 확인한다.

브랜치 푸시와 PR에서 회귀 검사를 실행하며, 보관 태그 생성은 CI 대상에서 제외한다. 런타임 변경 없이 중복 빌드 캐시나 APK를 새로 만들지 않는다.

Render의 `Test place / holdem-coin-tavern`은 main에 자동 배포가 연결돼 있다. 이번 통합 커밋에는 `[skip render]`를 넣고 운영 배포를 실행하지 않는다. 확인한 기존 live 리비전은 `2bdd5f18676e8fdb8a915ecddb5fdb30743ff360`이다. 소스 통합과 운영 배포 상태를 구분한다.

로컬 실행 작업본은 `G:/holdem_coin-workspace/island/branches/current-10zone`이며 Unity 실행 경로를 옛 G:/new_project로 되돌리지 않는다. 로컬 main 작업본의 사용자 수정은 별도 보존한다. 실행 로그와 최종 원격 대조 결과는 로컬 `maintenance/github-consolidation-20261110/evidence`에 있다.

원신 원본 대비 90% 일치율은 측정되지 않았으며 이번 정리의 통과 조건으로 주장하지 않는다.
