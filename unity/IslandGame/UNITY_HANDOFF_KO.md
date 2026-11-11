Island / holdem_coin — 통합 작업 시작점 (2026-11-11)

최상위 기준(2026-11-11 최신 요청): 일반 1~9구역 = 사이드뷰(Side25D). 10구역 = 보스 지역, 사이드뷰로 걸어서 입장 후 보스 등장 때 쿼터뷰(QuarterView).
현재 게임 기준은 새 10구역 맵이다. 초기 low-poly 일반 맵으로 되돌리지 않는다. 현재 사용하는 기존 보스 맵과 홀덤 게임은 보존한다.

2026-11-11 화면 상단 낙뢰 / 지면 확산 (최신)
- 실제 4~6번 번개는 활성 카메라 viewport Y=1.15, 대상과 같은 깊이에서 시작한다. 카메라 추적 후 재계산하여 Side25D/QuarterView 모두 상단 절단을 없앴다.
- 흰 코어·청백/보라 글로우·3개 잔가지, 2/60초 섬광→4/60초 떨림→감쇠, 지면 링·스파크·Shake를 연결했다.
- 연결된 유효 보조 젬 0/1/2~3/4~5개에 따라 지면 전기 가지 0/3/6/9개. 기존 2.4m 피해 반경 내 시각적 확산이며 실제 피해 반경 성장/추가 중복 판정은 없다.
- 실제 장비는 compileSkill 결과를 사용한다. 개발 연습 4/5/6번은 계정에 저장하지 않는 임시 0/2/4 연결 예시다.
- 전투/커널/API 26개, 카메라 36조건, 10회 풀 검사 PASS. Editor 834프레임 / Android9 에뮬레이터 762프레임, 각각 18개 캡처, 오류0. 실제 휴대폰 미검증.
- APK: builds/IslandGame-Lightning-20261111.apk, 0.1.0-test.20261111.3(code2026111103), 146778074 bytes. 오류0/경고0, 서명·16KB 정렬 PASS.
- SHA256 ca5f80570932e8614c2d0d1f7a3fa2f3ab5d7b54fd176e5a894585998ae93714
- 10구역 보스 처치 즉시 미궁 탈출, 완료 후 추가 보스맵 없음 유지. Editor는 Play 종료 상태.
- 상세/증거: ../../docs/unity/LIGHTNING_SCREEN_TOP_20261111_KO.md

2026-11-11 원소 VFX 본게임 연결 / 10구역 보스
- 기존 Island 메인 게임에 검기 5단계, 물방울/번개 각 3종 및 실제 다중 판정·반사·넉백·젖음 연계를 연결했다. 범위 성장은 보류하고 고정 반경을 사용한다.
- 진행은 일반 9구역 + 10번째 Nature 보스 전장이다. 보스 전장에서 walk_loop로 3m 이동 후 1.25초 등장, 1.2초 카메라 전환. 추격은 Boss_AdaptedWalk의 이동 거리 기준 걷기이다. 기존 MountZone10 에셋과 빌드 씬은 보존했다.
- 개발 로비: 원소 전투 연습(4구역), 10구역 보스 연습(입장부터). 임시 에르텔 6종은 계정에 저장하지 않는다.
- 10구역 보스 처치 즉시 미궁 탈출 모달을 표시한다. 완료 후 이전 보스맵이나 11번째 구역으로 이동하지 않는다.
- 전투 회귀91/타입 검사/Unity 컴파일 PASS. 실제 Editor 9→10구역 1497프레임 PASS. Android9 BlueStacks 1980프레임, 19개 기록, 검기5단계·스킬6종·걷기3샘플·탈출 팝업, 오류0 PASS. 실제 휴대폰은 미검증.
- Android 기본 Medium 품질은 단일 샘플 DioramaMobileURP를 사용해 화면 MSAA 샘플 불일치를 해결했다.
- APK: builds/IslandGame-ElementalBoss-20261111.apk, 0.1.0-test.20261111.2(code2026111102), 178673135 bytes. 빌드 오류0/경고1, 서명·16KB 정렬 PASS.
- SHA256 3104f2b2da32218ca653f463e57aec57803296943d94abd88116e7a188b57650
- Editor는 현재 메인 Island 게임을 열었다. 아래 실험실 단독/기존 일반10구역 설명은 이전 기록이다.
- 상세/증거: ../../docs/unity/ELEMENTAL_BOSS_INTEGRATION_20261111_KO.md

2026-11-11 원신 관찰 기반 효과 실험실
- Unity 메뉴 Island > Elemental VFX > Open lab. ElementalVfxLab.unity에서 검격 5단계 / 원형 물방울 3종 / 번개 3종을 선택·반복 재생한다. Space 재생, 휠 확대, 속도·일시정지·판정 표시·시점 전환 지원.
- 별도 PhysicsScene의 20ms 시뮬레이션, 다중 타격·복합 콜라이더 중복 방지·스윕 충돌·벽 반사·지붕/벽 차단·넉백·젖음 연계. 실제 Play Mode 검사 60/60 통과. 65초 자동 재생에서 11종, Transform 368개/ParticleSystem 16개 유지.
- Play 중 스크립트 재로드 후에는 이 실험실만 자동 재시작한다. 실제 재로드와 이후 물리 60개 검사도 통과했다. 뷰어 목표 60 FPS, 게임 장면에는 재시작 정책을 적용하지 않는다.
- 현재 Editor는 이 장면을 자동 재생 중이다. 기존 게임 빌드 씬 11개와 실제 RPG 장비 연결은 변경하지 않았다. 이번 실험실의 새 APK는 만들지 않았다.
- 원신의 실제 공격 녹화와 로컬 프리팹 구조를 참고한 독립 구현이다. 원본 ParticleSystem 곡선·피해/물리 계수를 복원한 것은 아니다.
- 이 G: exFAT 경로의 대소문자 혼용에 따른 MonoScript 연결 오류는 생성된 컴파일 경로 정보 보정으로 복구했다. Open-Unity.ps1이 scripts/unity/watch-generated-path-case.py를 Editor 수명 동안 실행한다. 실제 폴더는 이동하지 않았다.
- 상세/증거: ../../docs/unity/ELEMENTAL_VFX_LAB_20261111_KO.md

2026-11-11 영상 기반 추가 적용
- 원경 파노라마/패럴랙스, 다리·강변 수면, 3줄 몬스터 팩(6마리/최대12), 일정 거리 접근 대시, 검격 다중 타격, 금빛 쪼개기·푸른 폭풍 부름과 시전 자세를 추가했다. 새 보스전은 추가하지 않았다.
- Development 빌드 로비의 "영상 전투 연습"은 4구역부터 임시 에르텔 2개로 시작하는 무보상 모드이다. 계정 장비는 변경하지 않는다. 일반 사냥에서는 실제 장착 젬을 사용한다.
- Unity MCP 1.10.0 / AI ParticleSystem 2.1.1 설치. 개인 인증 설정은 Git에 넣지 않는다.
- 전투 검사 76개/타입 검사/Unity 컴파일 통과. Play Mode에서 스킬별 6마리 명중과 QuarterView 시전 확인. 반복 공격 10회에서 VFX 풀은 12개로 유지됐다.
- APK 0.1.0-test.20261111.1(code2026111101), 146445039 bytes, 오류0/기존경고1, 서명·16KB 정렬 통과. 블루스택 Android9 업데이트 설치·진입·4→5구역·스킬 터치 확인.
- SHA256 b70995f63e2dcf381b78681f3315bde1bc76f12aaae24a4a1001f7c49cdbd6ae
- 상세: ../../docs/unity/REFERENCE_COMBAT_20261111_KO.md
- 증거/빌드 로그: G:/holdem_coin-workspace/island/maintenance/reference-combat-20261111
현재 위치
- 작업 루트: G:/holdem_coin-workspace/island
- 실제 Unity: branches/current-10zone/unity/IslandGame
- 활성 Git 브랜치: codex/genshin-environment-20261110
- 공통 Git 저장소: branches/main/.git
- 11월 9일 기준 브랜치: branches/local-combat-base
- 최신 APK: builds/IslandGame-Lightning-20261111.apk
- 인계/검증: records 및 maintenance/cleanup-20261110/evidence
- 바르디안 단일 보관본: archives/Vardian_Analysis_Reference.zip
- 과거 고유 로컬 DB/설정: private-state (비공개, Git에 추가하지 않는다)

Open-Unity.ps1로 Unity 6000.0.62f1을 연다. 실제 폴더와 실행 경로는 소문자 island를 사용한다. 대소문자가 섞였을 때 Unity의 생성된 스크립트 경로가 절대 경로로 남아 클래스 연결이 비는 현상을 확인했고, 실제 폴더/실행 경로를 일치시켜 해결했다. 전체 Library 재설정이나 재설치는 하지 않았다. Start-Island-Codex.ps1은 이 통합 폴더에서 세션을 시작하고 임시 파일도 G:에 둔다.

Unity 진입 씬은 Assets/Island/Scenes/Island.unity이며 빌드 씬은 Island + MountZone01~10의 11개다. 기존 보스 NatureAuthoredMap과 관련 low-poly 리소스는 현재 보스 맵에 필요하므로 유지한다. 일반 맵의 기준으로 혼동하지 않는다.

이동속도는 이전 대비 2/3이다. 장애물에 막혀도 이동 입력 동안 달리기 모션이 진행되고, 입력을 놓으면 idle로 전환된다. 점프·구르기·슬라이딩, 기존 전투 규칙, Nilo 스타일, 원신에서 이식한 잔디·돌·나무와 그림자는 유지했다.

이전 통합본 검증 (2026-11-10)
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
