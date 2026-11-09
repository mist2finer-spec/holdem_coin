> 콘텐츠 확장 전 확인: [현재 성능 구조·영상6개 주제·에셋/이펙트 예산·측정/다음 작업](../../docs/unity/PERFORMANCE_ARCHITECTURE_20261109_KO.md). 2026-11-09 정적 감사 문서이며 런타임 최적화 적용 완료를 뜻하지 않습니다.

> 최신 2026-11-09.4: [세 공격 독립 접촉·S20 접속 경로·main 운영 배포·최종 APK·후속 작업](../../docs/unity/COMBO_DEPLOY_20261109_KO.md). 운영 서버 `2bdd5f1`, APK `2026110904`. 원격 Unity 폴더는 전체 프로젝트가 아니며 증분 스냅샷과 로컬 최신 상태를 대조합니다. 아래 미배포 서술은 과거 기록입니다.

> 최신 2026-11-08.2: [Mount Sunday 10구역 이식·스프린트·BlueStacks PASS/FAIL](../../docs/unity/MOUNT_SUNDAY_STREAM_PLAYTEST_20261108_KO.md). 실제 로컬 프로젝트에 우선 적용했으며 서버 변경과 에셋 패치는 작업 브랜치에 있다. 운영 배포·main 병합은 별도다.

> 최신 2026-11-07.4: [횡스크롤·쿼터뷰 액션/공통 접촉/보스 간격/전환 검증](../../docs/unity/COMBAT_VIEW_ACTION_20261107_KO.md). 기존 카메라·서버·수정 Nilo 룩을 확장. 새 참고 스냅샷으로 실제 로컬 후속 수정을 덮어쓰지 마세요.

> 최신 2026-11-07 후속: [보스 접촉 판정·URP 미리보기·테스트 APK](../../docs/unity/BOSS_CONTACT_DIORAMA_20261107_KO.md). 전투 안정화 유지, 사용자 승인한 수정 Nilo/URP 통합, 약한 Bloom 적용. 후속 작업도 같은 공격 ID/시간·실행 검증·고정 부하 전후 비교를 유지합니다.

> 2026-11-07 배포 완료: [main·Render LIVE·APK·운영 Unity 연결 검증](../../docs/unity/COMBAT_STABILITY_DEPLOY_20261107_KO.md). 운영 소스 7adb404, APK 2026110701.

> 최신 2026-11-07: [전투 끊김 안정화·Unity 실측·변경 소스](../../docs/unity/COMBAT_STABILITY_20261107_KO.md). 사용자 요청으로 Editor 렉을 우선 검증했으며 Android 실기 수치는 미검증입니다. 아래 이전 기록보다 이 결과를 먼저 확인하세요.

# IslandGame 에이전트 안내

작업을 시작하기 전에 Git 저장소 루트의 [AGENTS.md](../../AGENTS.md)를 읽고 적용합니다. Unity MCP를 사용하는 에이전트에도 같은 규칙이 적용됩니다. 이 안내 파일은 공통 정책의 위치를 알려줍니다.

Pink Glass 공격 모션 작업은 [지시서.md](지시서.md)에서 로컬 원본 경로와 확인 절차를 찾습니다.

최신 실제 로컬 상태·검증·코드 참고 스냅샷: [통합 인계](../../docs/unity/LOCAL_UNITY_HANDOFF_20261105_KO.md). Unity 작업 전 먼저 확인하고 로컬 후속 변경을 덮어쓰지 않습니다.

캐릭터 처리 흐름·성능 연구: [Savage Wind 연구 인계](../../docs/unity/SAVAGEWIND_RESEARCH_HANDOFF_20261106_KO.md). 고정 소스와 측정 계획을 먼저 읽고, 기존 풀링·샘플링 최적화를 중복 구현하지 않습니다. 연구본은 런타임에 자동 편입하지 않습니다.

RPG 전투 렉 안정화 우선 작업: [전투 안정화 작업지시서](RPG_COMBAT_STABILIZATION_20261107_KO.md). 2026-11-07 사용자 결정은 현재 서버 유지·교체 보류, RPG 실기 안정화 후 다음 콘텐츠 진행입니다. Android 측정 도구와 단계별 완료 조건도 이 문서에서 확인합니다.
