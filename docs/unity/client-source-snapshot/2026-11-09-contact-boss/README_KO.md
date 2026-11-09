# 일반 공격 접촉 · 보스 진입 증분 패치

기준은 `7f47d5675af46892afffc6524c75e51b99d5c5b8`의 `2026-11-08-mount-combat-fix` 적용 상태다. 전체 Unity 프로젝트가 아니다. 실제 작업 경로는 `G:/new_project/IslandGame`이다.

`manifest.json`의 before 해시를 로컬 파일과 대조하고 일치하면 백업 후 ProjectPatch의 같은 상대 경로로 반영한다. 다르면 후속 사용자 변경과 병합한다. 신규 CombatSnapshotBuffer는 before=null이다. 기존 meta는 보존했고 신규 meta도 포함한다. ProjectSettings는 덮어쓰지 않는다.

동일 브랜치의 서버 `src/lib/rpg-{mount-sunday-engine,unity-boss-engine,unity-boss-service,hero-contact,traversal}.ts`, `src/lib/generated/mount-sunday-zones.json`도 함께 배포해야 한다. 신규 준비 신호 readyBoss가 없으면 보스는 대기한다. 예전 서버/APK를 섞으면 전환·점프·접촉 시점이 일치하지 않는다.

이번 빌드 버전은 `0.1.0-test.20261109.2` / Android code `2026110902`. Unity6000.0.62f1, URP17.0.4, ARM64 IL2CPP Development. 신규 아트, 모델, 저장된 씬, 패키지는 추가하지 않았다. 기존 KeepTerrain 재질의 인스턴싱을 켜고, 빌드 시에만 비활성 Terrain 의존성을 포함하는 Editor 후크를 추가했다.

검증 도구는 Tools에 있고 결과는 [인계 문서](../../CONTACT_BOSS_HANDOFF_20261109_KO.md)에 있다. VerifyContactPlayback은 Play의 실제 HeroTarget이 있는 상태에서 실행해야 한다. 화면 포즈를 일시 조작하므로 검사 후 세션을 재시작한다. ExportObstacleHeights는 기존 씬 오브젝트의 높이 계약을 추출하는 참고 도구이며 현재 지형을 변경하지 않는다.

격리 테스트 서버: Tools/local-server.cjs(18108), boss-server.cjs(18110), traversal-server.cjs(18111). `MOUNT_REPO`는 체크아웃 경로, `MOUNT_DEPENDENCIES`는 설치된 node_modules와 mini-services/poker-server/node_modules가 있는 루트다(기본=MOUNT_REPO). 필요한 의존성 설치 후 Node로 실행하고 adb reverse를 설정한다. 후자의 두 파일은 검증 fixture이며 운영 실행 스크립트가 아니다. `mount_probe=1`, `mount_server=http://127.0.0.1:포트` Intent extra를 Development APK에 넘겨 실행한다.
