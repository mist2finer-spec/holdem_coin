Island / holdem_coin — 통합 작업 시작점 (2026-11-10)

최상위 기준: 일반 10구역 = 사이드뷰(Side25D), 보스전만 = 쿼터뷰(QuarterView).
현재 게임 기준은 새 10구역 맵이다. 초기 low-poly 일반 맵으로 되돌리지 않는다. 현재 사용하는 기존 보스 맵과 홀덤 게임은 보존한다.

현재 위치
- 작업 루트: G:/holdem_coin-workspace/island
- 실제 Unity: branches/current-10zone/unity/IslandGame
- 활성 Git 브랜치: codex/genshin-environment-20261110
- 공통 Git 저장소: branches/main/.git
- 11월 9일 기준 브랜치: branches/local-combat-base
- 최신 APK: builds/IslandGame-Current-10Zones.apk
- 인계/검증: records 및 maintenance/cleanup-20261110/evidence
- 바르디안 단일 보관본: archives/Vardian_Analysis_Reference.zip
- 과거 고유 로컬 DB/설정: private-state (비공개, Git에 추가하지 않는다)

Open-Unity.ps1로 Unity 6000.0.62f1을 연다. 실제 폴더와 실행 경로는 소문자 island를 사용한다. 대소문자가 섞였을 때 Unity의 생성된 스크립트 경로가 절대 경로로 남아 클래스 연결이 비는 현상을 확인했고, 실제 폴더/실행 경로를 일치시켜 해결했다. 전체 Library 재설정이나 재설치는 하지 않았다. Start-Island-Codex.ps1은 이 통합 폴더에서 세션을 시작하고 임시 파일도 G:에 둔다.

Unity 진입 씬은 Assets/Island/Scenes/Island.unity이며 빌드 씬은 Island + MountZone01~10의 11개다. 기존 보스 NatureAuthoredMap과 관련 low-poly 리소스는 현재 보스 맵에 필요하므로 유지한다. 일반 맵의 기준으로 혼동하지 않는다.

이동속도는 이전 대비 2/3이다. 장애물에 막혀도 이동 입력 동안 달리기 모션이 진행되고, 입력을 놓으면 idle로 전환된다. 점프·구르기·슬라이딩, 기존 전투 규칙, Nilo 스타일, 원신에서 이식한 잔디·돌·나무와 그림자는 유지했다.

이번 검증
- Android APK v0.1.0-test.20261110.3 / code2026111003, 138941520 bytes.
- SHA256: cea69654af2dece84f910939b3ef5b1ff9c479da4d276c712dbc13b4b194ab38
- 빌드 오류 0개, 기존 미사용 필드 경고 1개. 서명·ZIP·16KB 정렬 통과.
- 빌드 씬 11개의 누락 스크립트 0개, 재질 154개의 노멀맵 설정 불일치 0개.
- Unity/블루스택 이동 검사 오류 0개. 장애물 앞 0m 이동 동안 자세가 각각 69/46회 갱신됐다. 점프·구르기·슬라이딩도 확인했다.
- 블루스택 일반 10구역→보스 승리까지 514.616초, 실행 오류 0개, 확인된 공격 접촉 600회, 잘못된 공격 자세 0회.
- 로딩 완료 후 일반 10구역 모두 Side25D, 보스 QuarterView. boss-loading의 Update 스냅샷 1개를 3회 읽은 기록은 로딩 상태로 별도 보존했다.
- 전투 검사 11개와 타입 검사 통과. 홀덤 단위 검사 245개, 프로필 검사 3개, 20핸드 시뮬레이션 통과. Windows에서는 Unix 문법의 기존 검사 명령 대신 같은 검사 파일을 직접 실행했다.

정리/보존
현재 Git 작업본이 실제 Unity 프로젝트를 포함한다. 과거 docs/unity/client-source-snapshot과 중복 RPG 분석/아트 사본, 옛 Unity 리뷰/실험/다운로드 폴더는 제거했다. main/base는 sparse-checkout으로 과거 RPG 분석과 Unity 스냅샷을 펼치지 않으며 Git 이력은 공통 저장소에 남아 있다. archive/poker 및 홀덤 src/mini-services/public/db/prisma는 변경하지 않았다.

과거 정상 검증 커밋은 9ea817b73b45b54e13190a1553309553253cb177이다. 옛 독립 작업본의 로컬 브랜치는 history/*에 보존했다. contact-diorama의 미커밋 838개와 boss-test의 미커밋 7개도 보존 브랜치로 남겼다. main의 scripts/unity/prepare_assets.py 미커밋 변경은 그대로 유지했다. 세부 기록은 evidence/git-before.json 및 git-preserved.json을 읽는다. 옛 G:/new_project 및 C: 호환 폴더를 다시 만들지 않는다.

노멀맵 팝업은 재질의 normal 슬롯에 연결된 텍스처가 Default로 수입되어 발생했다. 확인한 텍스처 13개/재질 연결 78개는 모두 현재 빌드에서 쓰지 않는 GenshinOriginal 실험 자료였다. 해당 자료를 제거했으며 현재 사용하는 재질을 일괄 변경하지 않았다.

바르디안은 실제 C#/Native 분석 본문, 최종 검토·CFG·호출 근거, 복원 DB·스키마, libil2cpp.so/global-metadata.dat와 관련 스크립트를 ZIP 하나에 보관했다. records/VARDIAN_ANALYSIS_STATUS_KO.txt와 ZIP의 READ_FIRST_KO.txt를 먼저 읽는다. 정적 분석 완료 수는 실제 실행이나 서버 규칙 검증을 뜻하지 않는다.

과거 원신 해독 구조와 진행 상황은 records/historical/genshin-SESSION_HANDOFF_KO.txt에 남겼다. 현재 적용한 에셋은 Unity에 있다. 원본 90% 일치율은 측정한 적이 없으며 완료된 목표가 아니다. 추출 개수나 검사 통과를 일치율로 해석하지 않는다.

최종 삭제/공간 기록은 CLEANUP_RESULT_KO.txt를 확인한다. 현재 Unity Library/패키지와 개발 의존성은 재빌드를 위해 하나씩 재사용한다.