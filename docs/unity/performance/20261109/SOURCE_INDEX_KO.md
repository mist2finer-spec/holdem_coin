# 정적 감사 근거와 소스 찾아가기

기준 main `de7a874c4beb4f39c0758aa306dfc6d598b209cf`, 전체 Unity 프로젝트 `G:/new_project/IslandGame`. 런타임 프로파일러 캡처가 아닌 정적 감사다. [집계/해시](audit.json), [162개 importer 원시 목록](texture-inventory.json). 큰 원시 JSON은 통째로 대화에 붙이지 말고 필요한 경로만 읽는다.

동일 해시로 저장소에 이미 존재하는 소스는 링크로 연결한다. `.cs.txt`는 최신 로컬과 동일한 **읽기 전용 감사 근거**이며 ProjectPatch/설치 파일이 아니다. 설정 파일은 전체 프로젝트 설정을 복사하지 않고 아래 선택 항목과 원본 해시를 기록했다. 현재 로컬 사용자의 후속 변경을 이 자료로 덮어쓰지 않는다.

| 로컬 경로 | GitHub 근거 |
|---|---|
|`Assets/Island/Runtime/NativeBattle.cs`|[NativeBattle.cs](../../client-source-snapshot/2026-11-09-contact-boss/ProjectPatch/Assets/Island/Runtime/NativeBattle.cs)|
|`Assets/Island/Runtime/Battle3DView.cs`|[Battle3DView.cs](../../client-source-snapshot/2026-11-09-combo/ProjectPatch/Assets/Island/Runtime/Battle3DView.cs)|
|`Assets/Island/Runtime/RuntimeAnimationPlayer.cs`|[RuntimeAnimationPlayer.cs](../../client-source-snapshot/2026-11-07-view-action/Runtime/RuntimeAnimationPlayer.cs)|
|`Assets/Island/Runtime/IslandFrameBudget.cs`|[IslandFrameBudget.cs](reference-source/IslandFrameBudget.cs.txt)|
|`Assets/Island/Runtime/MountZoneStream.cs`|[MountZoneStream.cs](../../client-source-snapshot/2026-11-09-contact-boss/ProjectPatch/Assets/Island/Runtime/MountZoneStream.cs)|
|`Assets/Island/Runtime/MountZoneEnvironment.cs`|[MountZoneEnvironment.cs](../../client-source-snapshot/2026-11-08-mount-stream/ProjectPatch/Assets/Island/Runtime/MountZoneEnvironment.cs)|
|`Assets/Island/Runtime/NatureAuthoredEnvironment.cs`|[NatureAuthoredEnvironment.cs](../../client-source-snapshot/2026-11-09-contact-boss/ProjectPatch/Assets/Island/Runtime/NatureAuthoredEnvironment.cs)|
|`Assets/Island/Runtime/NatureEnvironmentStream.cs`|[NatureEnvironmentStream.cs](reference-source/NatureEnvironmentStream.cs.txt)|
|`Assets/Island/Runtime/NaturePropCache.cs`|[NaturePropCache.cs](reference-source/NaturePropCache.cs.txt)|
|`Assets/Island/Runtime/BattleDioramaLook.cs`|[BattleDioramaLook.cs](../../client-source-snapshot/2026-11-07-contact/Runtime/BattleDioramaLook.cs)|
|`Assets/Island/Runtime/CombatFeedbackRouter.cs`|[CombatFeedbackRouter.cs](../../client-source-snapshot/2026-11-07-view-action/Runtime/CombatFeedbackRouter.cs)|
|`Assets/Island/Runtime/CombatSnapshotBuffer.cs`|[CombatSnapshotBuffer.cs](../../client-source-snapshot/2026-11-09-combo/ProjectPatch/Assets/Island/Runtime/CombatSnapshotBuffer.cs)|
|`Assets/Island/Runtime/RpgSession.cs`|[RpgSession.cs](../../client-source-snapshot/2026-11-09-contact-boss/ProjectPatch/Assets/Island/Runtime/RpgSession.cs)|
|`Assets/Island/Runtime/RpgContracts.cs`|[RpgContracts.cs](../../client-source-snapshot/2026-11-07/Runtime/RpgContracts.cs)|
|`Assets/Island/Runtime/IslandBattleHud.cs`|[IslandBattleHud.cs](../../client-source-snapshot/2026-11-09-contact-boss/ProjectPatch/Assets/Island/Runtime/IslandBattleHud.cs)|
|`Assets/Island/Runtime/BattleForegroundOcclusion.cs`|[BattleForegroundOcclusion.cs](../../client-source-snapshot/2026-11-08-mount-combat-fix/ProjectPatch/Assets/Island/Runtime/BattleForegroundOcclusion.cs)|
|`Assets/Island/Runtime/BattleOccluder.cs`|[BattleOccluder.cs](../../client-source-snapshot/2026-11-08-mount-stream/ProjectPatch/Assets/Island/Runtime/BattleOccluder.cs)|
|`Assets/Island/Runtime/MountDeviceProbe.cs`|[MountDeviceProbe.cs](../../client-source-snapshot/2026-11-09-combo/ProjectPatch/Assets/Island/Runtime/MountDeviceProbe.cs)|
|`Assets/Island/MapMigration/Runtime/MapReviewGrass.cs`|[MapReviewGrass.cs](../../client-source-snapshot/2026-11-08-mount-stream/ProjectPatch/Assets/Island/MapMigration/Runtime/MapReviewGrass.cs)|
|`Assets/Island/MapMigration/Shaders/ZoneGrass.shader`|[ZoneGrass.shader](../../client-source-snapshot/2026-11-08-mount-stream/ProjectPatch/Assets/Island/MapMigration/Shaders/ZoneGrass.shader)|
|`Assets/Island/Editor/IslandProject.cs`|[IslandProject.cs](../../client-source-snapshot/2026-11-05/Editor/IslandProject.cs)|
|`Assets/DioramaPreview/Settings/DioramaURP.asset`|[DioramaURP.asset](../../client-source-snapshot/2026-11-07-contact/ApprovedDioramaAssets/DioramaPreview/Settings/DioramaURP.asset)|
|`Assets/DioramaPreview/Settings/DioramaForwardRenderer.asset`|[DioramaForwardRenderer.asset](../../client-source-snapshot/2026-11-07-contact/ApprovedDioramaAssets/DioramaPreview/Settings/DioramaForwardRenderer.asset)|
|`ProjectSettings/QualitySettings.asset`|[선택 설정값·audit 원본 해시](settings-summary.json)|
|`ProjectSettings/GraphicsSettings.asset`|[선택 설정값·audit 원본 해시](settings-summary.json)|
|`ProjectSettings/ProjectVersion.txt`|[ProjectVersion.txt](../../client-source-snapshot/2026-11-05/ProjectSettings/ProjectVersion.txt)|
|`Packages/manifest.json`|[manifest.json](../../client-source-snapshot/2026-11-08-mount-stream/ProjectPatch/Packages/manifest.json)|
|`Packages/packages-lock.json`|[packages-lock.json](../../client-source-snapshot/2026-11-08-mount-stream/ProjectPatch/Packages/packages-lock.json)|
|`ProjectSettings/ProjectSettings.asset`|[선택 설정값·audit 원본 해시](settings-summary.json)|

## 집계 재현 범위

- WebAssets: `Assets/Island/Resources/WebAssets` 아래 `.meta` 중 `TextureImporter:`를 갖는 파일을 재귀 집계. 기본 플랫폼의 compression과 Android override 여부를 분리했다. 임포트된 픽셀의 런타임 bytes는 이 집계에 없다.
- Cubemap: `Assets/Island/MountRuntime/Backgrounds/*.asset`의 파일 헤더만 읽어 width/height/format/mip/readable을 기록. YAML/hex의 파일 크기를 GPU 메모리로 환산하지 않았다.
- 잔디: `MountZone*.unity`에서 MapReviewGrass의 저장 positions를 읽고 코드와 같은 floor(x/6), floor(z/6)로 셀 수를 집계. 런타임 DrawnCells/DrawnClumps와 구분한다.
- Atlas: `Assets`의 `.spriteatlas` 및 `.spriteatlasv2`만 집계. Spine atlas 텍스트·패키지 캐시·빌드 내부 런타임 texture는 별도다.
- graph/pool/material 상한과 정리 경로는 아래 대응 소스의 상수/호출을 확인했다. 프로파일링 결과나 실제 병목 확정으로 해석하지 않는다.
