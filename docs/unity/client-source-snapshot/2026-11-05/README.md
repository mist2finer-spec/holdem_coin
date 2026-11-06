# 로컬 Unity 소스 참고 스냅샷

이 폴더는 실제 검증한 `G:/new_project/IslandGame`의 읽기·비교용 스냅샷입니다.
저장소의 `unity/IslandGame`을 이 스냅샷과 동일한 완성 프로젝트로 간주하지 마세요.
런타임/Editor C# 및 GUID, 패키지 상태, 레이어, 기존 씬, 3D 설정을 기록했습니다.
원본 모델/텍스처/Spine 패키지/내보낸 WebAssets/OS 글꼴 등은 포함하지 않습니다.
이 폴더만으로 재현 가능한 빌드라고 주장하지 않습니다.

`source-manifest.json`은 모든 포함 파일의 SHA-256과 로컬 모델 20개의 경로·SHA-256을 제공합니다.
실제 Windows 프로젝트에서 작업할 때는 인계 문서와 현재 파일 해시를 먼저 대조하세요.
폴더 전체를 기존 Assets나 원격 Unity 소스 위에 덮어쓰지 마세요.

최신 상태: [통합 인계](../../LOCAL_UNITY_HANDOFF_20261105_KO.md).

구역 통신/로컬 전투 추가: [설정·검증·Android 경계](../../STAGE_SYNC_20261105_KO.md).
`Plugins/StageRuntime`에는 관리 DLL의 메타데이터·라이선스·해시만 있다. 실제 DLL은
`python scripts/unity/restore-stage-runtime.py --project <실제 Unity 프로젝트>`로 공식 NuGet에서 복원한다.
Unity 커널과 서버의 `src/lib/generated/rogue-stage-kernel.json`은 같은 버전이어야 한다.
