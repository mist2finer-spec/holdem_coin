# Mount Sunday 독립 검토 — 2026-11-07

이 문서는 `review/mount-sunday-20261107` 작업 인계다. 실제 기존 프로젝트는 `G:/new_project/IslandGame`이며, GitHub의 `unity/IslandGame`은 그 전체 복사본이 아니다. 기존 전투·서버·플레이어·진행 구조에 Mount Sunday를 연결하지 않았다. 사용자의 마지막 지시에 따라 Android 실기 검사는 제외했다.

## 1. 결과 상태

- **PASS — 독립 스테이지 기술 검증:** 임포트·좌표·색상·소품 LOD·충돌 검사, 시작점부터 황금 전당까지 연속 보행, 실제 화면·성능 측정, Android APK 빌드 완료.
- **FAIL — 참고 영상 수준의 미술 품질:** 성능 우선의 1차 검토본이며 식생·지면 혼합·건축 마감은 목표에 미달한다.
- **UNAVAILABLE — Android 실기 색상·성능:** 사용자 요청으로 제외했다. 청록색 바닥 대응 패치는 빌드 취약점 수정 후보이며 실기 해결 판정은 보류한다.

[테스트 APK 2개·전체 프로젝트·영상·검사 자료 다운로드](https://github.com/mist2finer-spec/holdem_coin/releases/tag/mount-sunday-review-20261107)

| 파일 | 내용 |
| --- | --- |
| `MountSunday-Exploration-20261107.apk` | 독립 탐험 앱, `com.mist2finer.mountsunday.review`, 버전 `0.1.0-review.20261107` / `2026110701`, 약 279.5MB |
| `IslandGame-GroundReview-20261107.apk` | 기존 게임 지면 수정 테스트, `com.mist2finer.islandgame.dev`, 버전 `0.1.0-test.20261107.5` / `2026110705`, 약 107.1MB |
| `MountSunday-ReviewProject-20261107.zip` | FBX·생성 prefab·재질·씬을 포함한 전체 독립 프로젝트, 약 398.9MB |
| `MountSunday-Exploration-26s.mp4` | 실제 Unity 탐험 카메라 영상 26초. 연속 보행 검사는 별도 기록이며 이 영상은 비행 투어다. |
| `MountSunday-Evidence-20261107.zip` | 전후 화면, 원시 성능 표본, 보행·LOD·빌드 검사, 수정 파일 목록과 지면 패치 |

두 APK는 ARM64 / IL2CPP / OpenGLES3이며 ZIP 무결성·서명·16KB ZIP 정렬 검사를 통과했다. 독립 APK는 오류 0·경고 0, 기존 게임 APK는 오류 0·기존 `IslandApp.lastDeal` 미사용 필드 경고 1건이다. BuildReport의 totalSizeBytes는 APK 자체 크기가 아니므로 APK 검증 파일의 bytes를 사용한다. [배포 파일 해시](mount-sunday-20261107/artifacts.json)를 대조할 수 있다.

기존 프로젝트 Assets/Packages/ProjectSettings 2,780개 파일의 해시가 작업 전과 동일했다. 기존 Unity 창과 독립 검토 창은 Default 레이아웃으로 복원했고, 검토 씬을 Play 종료·미저장 변경 없음 상태로 열어 두었다.

## 2. 코드·데이터 검사

- Unity `6000.0.62f1`, URP `17.0.4`를 실제 프로젝트와 격리 프로젝트에서 확인했다. CLI만 승인에 따라 `1.0.0-beta.17`로 업데이트했다. 렌더 파이프라인 전환과 작업에 불필요한 패키지 업그레이드는 하지 않았다.
- `G:/new_project/map_forest/MountSunday_FullMap_Assets.zip`을 우선 사용했다. Props ZIP은 중복 임포트하지 않았다. Blender 원본은 보존했다. 입력 해시는 [source-manifest.json](mount-sunday-20261107/source-manifest.json)에 있다.
- `geometry_preview.png`는 개념도로, 한국어 황금 전당 경로 PNG는 목표 레벨 동선으로 구분했다. `comparsion.mp4`의 실제 프레임도 확인했다.
- Validate Coordinate Import → Build Asset Prefabs Only → Validate Package → Build Exploration Scene 순서로 실행했다. 212 prefab / 840 배치 / 9 주요 지점. 축 보정은 `(-1,1,1)`, 좌표 검사의 최대 오차는 0이었다.
- 색상은 동봉 `MountSunday/Environment` 셰이더의 버텍스 컬러를 사용한다. MeshCollider용 메시의 Read/Write를 확인했고, 풀·꽃·하천에는 충돌체가 없다. 나무는 줄기 CapsuleCollider만 사용한다.
- 근거리 지형 64개와 원경 16개는 원본 메시를 유지한다. 추가 지형 LOD 실험은 실제 화면에 타일 이음선이 남아 최종 구성에서 제거했다. 원본 지형의 프러스텀 컬링을 사용한다. 풀 군락은 `.7/.3/.15`, 나무는 `.25/.09/.012`, 바위·건축물은 `.18/.06/.004` 화면 비율에서 전환·컬링한다. 소품의 전체 LOD0를 항상 표시하지 않는다.
- 안뜰이 비탈 위에 떠서 보행을 막는 문제를 실제 검사로 찾았다. 검토용 메시와 충돌체를 지형에 맞췄다. 황금 전당은 진입 방향으로 회전하고 도착점을 문 앞에 두었다. 원본 경로의 다리 접근 곡선이 상판과 어긋나므로 별도 보행 경로를 다리 중심선에 맞췄다.
- 기준 재질·씬을 보존하며 검토용 재질·Volume을 복제했다. 풀 그림자를 끄고 Bloom 강도를 0으로 했다. 기존 바람·수면 셰이더는 유지한다. 고정 카메라의 두 실제 캡처에서 하늘은 동일하고 식생·수면 영역의 픽셀 변화와 프레임 진행을 확인했다(`animation-validation.json`).
- 시작점 외에 전투 검토 공간 4곳을 표시했다. 3곳은 반경 8m, 추가 평원은 반경 12m이며 장애물 3개를 비활성화했다. 지면 높이 편차는 각 0.029 / 0.897 / 1.800 / 0.378m다. 기존 지형을 무리하게 평탄화하지 않았다. 수로에 있던 나무 8개를 검토 씬에서 비활성화했다.

기존 게임의 청록색 바닥 대응은 별도 복사본에서 수행했다. 런타임은 Terrain 인스턴싱을 강제로 켰지만 `KeepTerrain` 재질은 인스턴싱 변형을 포함하지 않는 상태였다. 재질 인스턴싱 활성화, 사용하는 Terrain 셰이더 변형 9개 보존·준비, 런타임 지원 여부 확인, 지면 텍스처의 명시적 ETC2 설정을 추가했다. **이는 발견된 빌드 취약점의 수정이며, 사용자 기기의 청록색 현상 원인 확정 또는 해결 확인은 아니다.** Editor의 동일 지면은 수정 전후 모두 녹색으로 렌더됐다.

## 3. 실제 Unity 화면·플레이

CharacterController.Move로 664개 지점, 약 1,257.76m를 229.60초 동안 연속 이동해 황금 전당 문 앞에 도착했다. 시작 배치 이후 순간이동은 없었다. 다리 중심에서 상판 높이도 확인했다. 최초 원본 검사는 안뜰에서 막혔으며, 다리 아래로 통과하던 경로 결과도 성공으로 채택하지 않았다. 최종 높이 추적은 `optimized-walk.json`에 기록했다. 이후 지형 렌더 LOD를 제거했지만 원본 지형 충돌체와 보행 경로는 변경하지 않았다.

실제 주 카메라를 이동시킨 나무·바위·풀 군락·황금 전당의 LOD0/1/2/컬링 16개 상태를 검사했다. 한 번에 하나의 LOD만 가시 상태였고, 컬링 거리에서는 모두 사라졌다. 다른 SceneView 카메라의 검사 레이어를 제외하고 프레임을 진행한 뒤 Renderer 가시 상태와 실제 triangles를 함께 기록했다. 초기 OnWillRenderObject 콜백 계측은 이 URP 환경에서 결과를 얻지 못해 폐기하고 카메라 가시 상태 방식으로 교체했다.

측정 조건은 Lenovo 82K2 / Ryzen 5 5600H / GTX 1650 / Unity Editor DX11 / 1280×720 / Linear / URP renderScale 1 / MSAA 2 / VSync 0 / LOD bias 1이다. 같은 원본 카메라 경로, 10초 준비 + 60초 측정을 사용한다. 초기 임포트가 겹친 `baseline-tour.json`은 비교에서 제외하고 `baseline-clean-tour.json`을 기준으로 사용한다. 메모리·GC에는 Editor와 측정 코드의 비용이 포함된다. 인코딩한 영상의 FPS는 성능 측정값이 아니다.

| 지표 | 기준 평균 / p95 | 최종 평균 / p95 |
| --- | ---: | ---: |
| CPU main thread (ms) | 3.98 / 5.74 | 2.91 / 3.69 |
| GPU (ms) | 3.39 / 5.11 | 2.12 / 2.88 |
| 프레임 (ms) | 3.98 / 5.76 | 2.92 / 3.72 |
| Draw Calls | 257.00 / 426.00 | 284.96 / 460.00 |
| SetPass Calls | 5.27 / 6.00 | 6.37 / 7.00 |
| 표시 triangles | 3,325,589.22 / 5,154,125.00 | 1,852,798.83 / 2,646,491.00 |
| 사용 메모리 (MiB) | 4,031.32 / 4,067.58 | 3,970.02 / 4,006.59 |
| 프레임 GC 할당 (KiB) | 18.58 / 18.52 | 18.84 / 18.48 |

평균 triangles -44.3%, GPU -37.4%, CPU -26.7%였다. 반면 Draw Calls +10.9%, SetPass +21.0%, GC 평균 +1.4%로 증가했다. 메모리 평균은 약 1.5% 감소했다. 최종 GUI 2개 버튼·설명과 재질/LOD 전환 구성이 포함된 결과다. 이 단일 Editor 측정은 모바일 성능이나 반복 실험의 통계적 보증이 아니다. 자세한 표본은 `performance-comparison.json`에 있다.

## 4. 남은 문제·미검증 범위

- 근거리 64개·원경 16개 지형은 원본 해상도다. 추가 지형 LOD의 이음선 문제로 해당 실험을 롤백했으며 전체 스트리밍과 모바일 전용 지형 경량화는 남아 있다. 모든 지점·시야의 접지와 원경 이음선을 전수 확인한 것은 아니다.
- 참고 영상 수준의 식생 밀도, 재질 다양성, 지면 혼합과 최종 미술 마감은 미달이다. 이번 우선순위는 성능과 검토 가능성이다.
- 실지형 기반 높이와 게임용 창작 배치를 구분한다. 하천·다리·마을·건축물·식생·평탄화 집터는 창작 요소다. 정확한 지리측량 또는 실제 장소의 복원으로 보증하지 않는다.
- Android 실기 실행·발열·지속 FPS·GPU 드라이버별 색상은 사용자의 지시에 따라 미검증이다. Editor 수치를 모바일 FPS로 환산하지 않는다.
- 기존 게임의 전체 전투 회귀 검사는 이번 지면 설정 수정 범위에서 재실행하지 않았다. 기존 ViewAction 서버·규칙·Spine 4.2·Nilo 재질을 유지한다. 서버 배포나 운영 브랜치 병합은 하지 않았다.

## 실행·수정 파일·다음 에이전트 인계

작업 폴더는 `C:/Users/SHK/mount-sunday-review-20261107`이다. `MountSundayReview`는 독립 프로젝트, `IslandGameGroundReview`는 기존 게임의 격리 복사본, `repo`는 위 브랜치의 Git worktree, `evidence`는 검사 원본이다. `G:` 원본 프로젝트에 이 복사본을 덮어쓰지 않는다.

독립 프로젝트를 Unity 6000.0.62f1로 열고 `Assets/MountSunday/Review/MountSunday_Exploration_Review.unity`를 연다. Play 후 WASD 이동, 오른쪽 마우스 시점, Shift 달리기, Tab 걷기/비행, 비행 중 Q/E 높이, N 다음 지점이다. Android는 왼쪽 터치 이동·오른쪽 터치 시점과 WALK/FLY·NEXT POINT 버튼을 사용한다. 비행에서는 바라보는 방향으로 전진한다. 순간이동은 보조 도구다.

[review-project](mount-sunday-20261107/review-project)은 소스·설정 스냅샷이며 대형 FBX를 생략했다. **그 폴더만으로 완전한 프로젝트라고 간주하면 안 된다.** 완성 프로젝트 ZIP을 사용하거나 원본 FullMap ZIP을 격리 프로젝트에 먼저 풀어야 한다. `ReviewSetup.Setup`, 제공 패키지 메뉴, `ReviewSetup.OpenBaseline`, `OptimizeStage.Apply`, `FinishReviewScene.Apply` 순서가 생성 경로다. 제공 Build Exploration Scene 메뉴 전에 현재 빈 씬을 저장해야 한다. `ReviewRun`은 재현용 보행·측정 기능이고 씬의 일반 탐험 동작에는 자동 실행되지 않는다. LOD 검사와 영상 기록 코드는 UNITY_EDITOR 조건으로 APK에서 제외된다.

[ground-patch](mount-sunday-20261107/ground-patch)은 기존 게임 변경 6개만 담는다. `manifest.json`의 수정 전 해시를 대상 프로젝트와 대조한다. 다른 에이전트의 후속 변경이 있으면 파일 전체를 덮어쓰지 말고 필요한 diff만 적용한다. 원격 `unity/IslandGame`에 무조건 복사하지 않는다. 독립 검토 씬을 기존 게임에 연결하는 것은 별도 사용자 지시가 필요하다.

공식 참고: [Unity 6 MeshCollider](https://docs.unity3d.com/6000.0/Documentation/Manual/class-MeshCollider.html), [CharacterController](https://docs.unity3d.com/6000.0/Documentation/Manual/class-CharacterController.html). 일반 에셋·렌더링·충돌 변경이므로 관련 실측을 사용했고 별도 형식 검증 모델은 만들지 않았다.


### 변경 파일과 증거 위치

- [전체 소스·설정·패치 파일 목록](mount-sunday-20261107/changed-files.json): 경로·크기·SHA-256. 생성 prefab·씬·메시는 전체 프로젝트 ZIP의 `FILE_MANIFEST.json`에 기록했다.
- 주요 구현: `Editor/ReviewSetup.cs`, `Editor/OptimizeStage.cs`, `Editor/FinishReviewScene.cs`, `Runtime/ReviewControls.cs`, `Runtime/ReviewRun.cs`, `Runtime/ReviewLodVerification.cs`, `Runtime/ReviewVideo.cs`. 패키지 원본과 검토 전용 추가 코드를 함께 보관했다.
- [실제 Unity 캡처](mount-sunday-20261107/evidence/screenshots): 평원·다리·성문·마을·황금 전당·원경, 다리 보행, LOD 네 거리. 기준 화면과 고정 카메라 바람·수면 캡처는 증거 ZIP에 포함한다.
- `optimized-walk.json`: 시작 배치 후 텔레포트 없는 CharacterController 이동 기록. 렌더용 지형 LOD 롤백과 경로 밖 장애물 정리 후에도 경로·지형 충돌체는 동일하다.
- `baseline-clean-tour.json`, `optimized-clean-tour.json`: 동일 경로 60초 원시 계측은 증거 ZIP에 포함한다. 이전 임포트 중 측정과 폐기한 지형 LOD 수치를 최종 개선율에 혼용하지 않는다.
- Unity 검사 재현은 해당 격리 프로젝트의 Play Mode에서 `tools/StartOptimizedWalk.cs`, `tools/StartOptimizedTour.cs`, `tools/RunLOD.cs`를 `unity command script eval_file`로 실행한다. 스크립트의 로컬 작업 경로를 자신의 경로로 조정한다. `ReviewRun.Begin`은 종료 시 JSON을 기록한다. 백그라운드 실행·auto tick을 활성화하고 프레임이 실제 증가하는지 확인한다. 기준 비교는 `MountSunday_Baseline.unity`와 같은 `ReviewRun` 카메라 경로를 사용한다.
- 기존 게임 패치: `python tools/apply_ground_patch.py <실제 프로젝트 경로>`는 해시 대조만 한다. 실제 적용은 별도 복사본에 `--apply`를 붙이며 백업을 만든다. 이 작업에서는 원본에 적용하지 않았다.
- 새 브랜치의 검토 자료와 GitHub prerelease만 제출했다. 기존 서버 배포·main 병합·게임 연결은 수행하지 않았다.
