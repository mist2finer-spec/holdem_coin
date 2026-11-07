> 2026-11-07 배포 완료: [main·Render LIVE·APK·운영 Unity 연결 검증](../../docs/unity/COMBAT_STABILITY_DEPLOY_20261107_KO.md). 운영 소스 7adb404, APK 2026110701.

> 최신 2026-11-07: [전투 끊김 안정화·Unity 실측·변경 소스](../../docs/unity/COMBAT_STABILITY_20261107_KO.md). 사용자 요청으로 Editor 렉을 우선 검증했으며 Android 실기 수치는 미검증입니다. 아래 이전 기록보다 이 결과를 먼저 확인하세요.

# IslandGame 에이전트 안내

작업을 시작하기 전에 Git 저장소 루트의 [AGENTS.md](../../AGENTS.md)를 읽고 적용합니다. Unity MCP를 사용하는 에이전트에도 같은 규칙이 적용됩니다. 이 안내 파일은 공통 정책의 위치를 알려줍니다.

Pink Glass 공격 모션 작업은 [지시서.md](지시서.md)에서 로컬 원본 경로와 확인 절차를 찾습니다.

최신 실제 로컬 상태·검증·코드 참고 스냅샷: [통합 인계](../../docs/unity/LOCAL_UNITY_HANDOFF_20261105_KO.md). Unity 작업 전 먼저 확인하고 로컬 후속 변경을 덮어쓰지 않습니다.

캐릭터 처리 흐름·성능 연구: [Savage Wind 연구 인계](../../docs/unity/SAVAGEWIND_RESEARCH_HANDOFF_20261106_KO.md). 고정 소스와 측정 계획을 먼저 읽고, 기존 풀링·샘플링 최적화를 중복 구현하지 않습니다. 연구본은 런타임에 자동 편입하지 않습니다.

RPG 전투 렉 안정화 우선 작업: [전투 안정화 작업지시서](RPG_COMBAT_STABILIZATION_20261107_KO.md). 2026-11-07 사용자 결정은 현재 서버 유지·교체 보류, RPG 실기 안정화 후 다음 콘텐츠 진행입니다. Android 측정 도구와 단계별 완료 조건도 이 문서에서 확인합니다.
