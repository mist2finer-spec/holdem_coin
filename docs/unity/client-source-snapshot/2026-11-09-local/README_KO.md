# 2026-11-09 로컬 전투 증분 소스

전체 Unity 프로젝트가 아닌 변경 파일 스냅샷이다. 실제 프로젝트 `G:/new_project/IslandGame`의 `Assets/Island` 기준으로 경로를 대응한다. [before/after 해시](manifest.json)를 대조하고 이후 변경을 덮어쓰지 않는다.

- `RpgLocalTrainingSession.cs`: 마을길/독립 보스 훈련 입장과 계정 메타데이터만 HTTP, 전투는 로컬 worker. 영구 전투 보상 없음. 구역 결과 서버 검증은 아직 없음.
- `RpgSession.cs`, `RpgLocalStageSession.cs`: 해당 모드 실행 경로 연결. 기존 일반 미궁 Stage Sync, 성장 사냥, 포커 경로는 그대로.
- `StageCombatWorker.cs`: 기존 단일 소유 Jint worker를 재사용하고 훈련 상태 발행 간격 20ms/부하 시 40ms. 고정 시뮬레이션 스텝은 20ms.
- `CombatSnapshotBuffer.cs`, `NativeBattle.cs`: 로컬 표시 지연 40ms, 원격 경로 160ms. 접촉 프레임 보존, 로컬에서 원격 이동 예측 제외.
- `MountDeviceProbe.cs`: 로컬 실행 여부·HTTP 횟수·worker 스텝/시간 계측 추가.
- `Resources/TrainingCombatKernel.js.txt`: 현재 MountSundayEngine/UnityBossEngine을 함께 번들한 JS. 기존 Jint 패키지 사용. 새 외부 런타임 설치 없음.

번들 재생성: 저장소 루트에서 `npm run unity:training:kernel`. 생성한 `Resources/TrainingCombatKernel.js.txt`를 실제 프로젝트의 동명 경로에 복사한다. `npm run test:rpg:local-training`은 번들 최신성 및 원래 엔진과 구역/보스 실행 결과를 검사한다. 새 에셋·원본 모델·애니메이션·씬 배치는 변경하지 않았다.

[전체 변경·검증·후속 작업](../../LOCAL_COMBAT_BUILD_20261109_KO.md).
