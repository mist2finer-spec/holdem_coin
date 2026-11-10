Island / holdem_coin — 현재 시작점 (2026-11-10 정리)

최상위 규칙: 일반 10구역 = 사이드뷰(Side25D), 보스전만 = 쿼터뷰(QuarterView).
현재 맵 기준은 새 10구역이다. 초기 low-poly 일반 맵은 기준점이 아니다. 현재 사용 중인 보스 맵은 유지한다. 홀덤 코드·데이터·리소스는 보존한다.

폴더
branches/current-10zone : 활성 Git 작업본, codex/genshin-environment-20261110
branches/current-10zone/unity/IslandGame : 실제 Unity 프로젝트 (이제 소스 스냅샷이 아님)
branches/main : 공통 Git 저장소 및 main 작업본. 기존 미커밋 scripts/unity/prepare_assets.py 보존.
branches/local-combat-base : 11월9일 로컬 전투 기준 브랜치 작업본.
builds : 현재 검증한 APK (진행 중에는 이전 정상 APK를 임시 보존).
records : 현재/과거 인계, 검증, 삭제 근거.
archives/Vardian_Analysis_Reference.zip : 바르디안 실제 코드·최종 근거·복원DB 보관본 하나.
private-state : 과거 작업본의 고유 로컬 DB/설정. 비공개이며 Git에 추가하지 않는다.
maintenance/cleanup-20261110 : 이번 정리의 계획·해시·삭제 기록·검증 결과.
tools/validation : 재사용 가능한 로컬 검증 도구.

Unity 6000.0.62f1을 사용한다. 기존 Library/패키지 캐시를 이동하여 재사용한다.
진입 씬 Assets/Island/Scenes/Island.unity. 빌드 씬은 Island + MountZone01~10의 11개.
보스 맵의 NatureAuthoredMap 및 관련 기존 리소스는 현재 빌드에 필요하므로 남긴다. 파일명이 lowpoly라는 이유로 보스 맵 의존성을 지우지 않는다.
이동속도는 이전 대비 2/3, 장애물에 막혀도 이동 입력 동안 달리기 모션 진행, 입력 해제 시 idle. Nilo 스타일과 기존 전투/액션/풀·돌·나무·그림자 유지.

Git 이력
2026-11-10 이전 정상 검증 커밋: 9ea817b73b45b54e13190a1553309553253cb177.
옛 독립 작업본의 로컬 브랜치는 공통 Git의 history/* 브랜치에 보존했다.
island-contact-diorama의 미커밋 838개와 holdem_coin-boss-test의 미커밋 7개는 history/*/uncommitted-preserved에 보존했다. 원래 상태 목록과 staged patch는 maintenance/cleanup-20261110/evidence에 있다.
옛 G:/new_project 및 C:/Users/SHK 호환 경로를 다시 만들지 않는다. Git 명령이 소유권 경고를 내면 해당 실제 경로에 한정한 -c safe.directory=<경로>를 사용한다.

정리 한계/복원 작업 상태
미사용 원신 실험 프로젝트·원본 추출물·반복 다운로드·옛 APK/리뷰 프로젝트는 현재 빌드 의존성을 확인한 뒤 제거한다. 과거 원신 해독 구조/작업 진척은 records/historical/genshin-SESSION_HANDOFF_KO.txt에 기록한다. 현재 적용된 에셋은 실제 Unity 프로젝트에 있다.
원본 90% 일치율은 측정된 적이 없으며 완료된 목표가 아니다. 원본 물/조명/셰이더/이동 계수/동일 카메라 정렬은 미해결 이력이 있다. 현재 사용자 기준은 10구역 게임과 Nilo 표현이다.
바르디안은 정적 분석 보관본이며 실제 실행/서버 규칙 검증 완료본이 아니다. records/VARDIAN_ANALYSIS_STATUS_KO.txt와 ZIP의 READ_FIRST_KO.txt를 읽는다.

노멀맵 경고
재질의 normal 슬롯에 연결된 텍스처가 Default로 수입된 경우 Unity가 내는 경고이다. 이번에 확인한 13개 텍스처/78개 연결은 모두 미사용 GenshinOriginal 실험 리소스였고 현재 빌드 사용 항목은 0개였다. 해당 실험 리소스를 제거했으며 현재 사용 재질을 일괄 변경하지 않았다.

검증 결과는 maintenance/cleanup-20261110/evidence의 최신 build-result.json, apk-validation.json, android-motion.json, route-camera-validation.json 및 최종 CLEANUP_RESULT_KO.txt를 확인한다. 단순 추출 수나 빌드 성공을 원본 일치율로 해석하지 않는다.

?? ???? ??: ?? ???? Unity ?? ??? ??? island? ????. ??? Island? ??? Unity 6.0? ??? ???? ??? ?? ??? ?? MonoScript ??? ??? ???? ??? ????. ?? Library ??? ?? ?? ??/?? ?? ???? ????.

??: Open-Unity.ps1? ??? ??? ??? Unity? ?? ?? ??? island/.tmp? ??. Start-Island-Codex.ps1? ? ?? ???? ? Codex ??? ????.
main/local-combat-base ???? Git sparse-checkout?? ?? archive/rpg ? Unity ?? ???? ??? ???. Git ??? ?? .git? ???? ??. ?? ?????? ???? ?? ?? ??? ???? ?? unity/IslandGame? ?? ??/????. archive/poker? ?? ??? ????.
