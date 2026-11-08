# Mount Sunday 현재 버전 적용 스냅샷

실제 작업 프로젝트는 `G:/new_project/IslandGame`이다. 이 폴더는 기존 IslandGame에 적용한 변경 파일과 필요한 맵 에셋만 담는다. 독립 실행 가능한 전체 Unity 프로젝트가 아니다. 기존 게임 캐릭터·HUD·폰트·패키지와 기존 아트 참조를 유지한다. 원격 `unity/IslandGame` 최소 프로젝트를 이 폴더로 대체하지 않는다.

`manifest.json`은 경로·크기·적용 후 SHA-256 및 확보된 적용 전 해시를 기록한다. `ProjectPatch/Assets`에는 런타임 씬 10개, 의존하는 지형·소품·재질·잔디, 스프린트 원본/리타깃 클립, 변경된 클라이언트 코드가 있다. `runtime-dependencies.json`의 씬 의존 파일 112개에 미해결 GUID는 0개였다. 기존 캐릭터 리소스 참조는 기존 프로젝트에 의존한다.

## 적용

1. 기존 프로젝트를 백업하고 `python Tools/apply_patch_to_project.py <프로젝트 경로>`로 해시를 검사한다. 일치하지 않는 후속 수정은 먼저 diff를 병합한다. 검사 후 `--apply`는 Assets만 적용하며 기존 파일을 `.island-backups`에 보관한다.
2. Packages/ProjectSettings는 비교용이다. manifest를 통째로 덮어쓰지 않는다. Unity Package Manager에서 `com.unity.modules.androidjni@1.0.0`을 추가한다. 나머지 버전은 기존 Unity 6000.0.62f1 / URP 17.0.4를 유지한다.
3. 연결된 Editor에서 `Tools/SetupMountBuild.cs`의 `SetupMountBuild.Run`을 실행한다. Island.unity와 MountZone01..10.unity를 빌드에 등록한다. `BuildMountAndroid.cs`는 이번 버전 설정 참고 자료다. 실제 빌드는 Unity Pipeline `build run`, Development/ARM64/IL2CPP로 수행했다.
4. 서버는 이 브랜치의 `/api/rpg/mount-sunday`를 사용한다. 운영 Render 서버에는 아직 배포하지 않았다. 로컬 검증 서버는 저장소에서 `node docs/unity/client-source-snapshot/2026-11-08-mount-stream/Tools/local-server.cjs`로 실행한다. 루트와 mini-services/poker-server의 의존 패키지를 설치해야 한다. `MOUNT_REPO`, `MOUNT_DEPS`로 별도 경로를 지정할 수 있다. 테스트 DB는 메모리에만 있다.
5. ADB `reverse tcp:18108 tcp:18108` 후 `am start -n com.mist2finer.islandgame.dev/com.unity3d.player.UnityPlayerGameActivity --es mount_probe 1 --es mount_server http://127.0.0.1:18108`로 실행한다. 디버그 빌드만 자동 계측하며, 결과는 앱의 외부 files/mount-report.json에 저장한다. 프로덕션 빌드에는 자동 테스트가 실행되지 않는다.

기본 게임 쿠키/성장/보상 규칙과 맵 테스트 서버 주소는 구분된다. 맵 버튼은 이 신규 엔드포인트가 실행 중인 서버가 필요하다. 최초 테스트 실행은 맵 서버 주소만 저장한다. APK를 다른 기기로 옮긴 경우 그 기기에서 접근 가능한 테스트 서버 주소를 지정해야 한다.

`BakeMountZones.cs`는 기존 MapMigration 검토 씬을 입력으로 받는 재생성 도구다. 실행하려면 이전 10구역 검토 씬과 원본 Mount Sunday 임포트가 필요하다. 일반 적용에는 이미 생성된 씬과 에셋을 사용한다. 원본 지형을 평탄화하거나 리깅 원본을 수정하지 않았다.

별도 형식 모델은 작성하지 않았다. 로더는 하나의 코루틴만 씬 작업을 수행하며, 실제 구역 전환/퇴장/재입장과 개수 계측으로 검증한다. 무제한 스레드 경합이나 모든 기기 상태를 증명한 결과로 해석하지 않는다.
