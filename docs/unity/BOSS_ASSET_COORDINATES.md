# Unity 보스 시험장: 원본 맵·카메라·좌표 계약

`tests10boss` 시험장은 기존 Vardian `Map002_001` 복원 자료를 Unity 월드 좌표 그대로 사용한다. `public/rpg/maps/candle-dungeon/scene.json`을 바이트 그대로 내보내며, 웹용 파노라마의 픽셀 좌표를 3D 맵으로 간주하지 않는다. 웹 런타임 수정이나 웹 배포는 이 작업에 포함되지 않는다.

## 준비되는 Resources

| Resources 경로(확장자 생략) | 내용 |
| --- | --- |
| `WebAssets/rpg/maps/candle-dungeon/scene` | 원본 복원 geometry 33개, renderer 108개, material 14개, texture 참조 14개, lightmap 1개, flame 6개 |
| `WebAssets/rpg/maps/candle-dungeon/textures/<hash>` | scene에서 참조한 원본 PNG 14개. 512×512 lightmap PNG 포함 |
| `BossTrials/map-contract` | 카메라 raw/local/world 증거, 네이티브 바닥 collider, 전투 구역, 보스 대체 에셋 매핑 |
| `BossTrials/bosses` | 10종 시험용 보스 정의. 독립 런타임이 관리 |
| `AssetIndex` | 기존 영웅·몬스터 ID와 위 리소스의 연결 |
| `RpgCatalog` | 기존 공개 Unity 스냅샷 그대로 유지. 새 주얼 수치 배열은 포함하지 않음 |

`source.json.gz`는 추출 시 카메라와 시작/종료 노드 증거를 읽는 입력이다. 동일한 원시 노드 데이터를 opaque 파일로 Unity Resources에 중복 복사하지 않는다. `map-contract.sourceFilesSha256`에 scene/source/evidence 해시를 기록하고, `asset-export.json`은 scene, PNG, 계약, 카탈로그, AssetIndex 및 별도 시험/표시명 JSON의 실제 결과 해시를 포함한다. 기존 WebAssets는 삭제하거나 대량 재생성하지 않는다. 변경 없는 결과 파일은 다시 쓰지 않는다.

## 원본 좌표

좌표계는 **Unity left-handed, Y up**이며 4×4 배열은 row-major이다. `renderer.world`로 정점을 한 번만 변환한다. `staticBatch=true`인 Combined Mesh의 정점은 이미 네이티브 월드 위치가 반영되어 있고 해당 `world`는 identity이다. `instanceWorld`를 추가 적용하면 이중 변환이 된다. 일반 mesh는 rotation/scale/translation을 포함한 `world`를 한 번 적용한다.

`renderer.materials[n]`은 `geometry.submeshes[renderer.submeshes[n]]`의 재질이다. 단순히 앞쪽 submesh부터 그리면 Combined Mesh의 벽 구간이 중복되거나 빠진다. UV0, UV2, 재질 `uvScale`/`uvOffset`/color, lightmap index/scale-offset을 유지한다. 원본 PNG의 HDR 조명 결과와 Unity 셰이더까지 완전 재현했다는 뜻은 아니다. URP 2D renderer에서도 그릴 수 있는 unlit adapter와 fallback을 사용하며 실제 셰이더/조명 비교는 Editor에서 확인해야 한다.

| 항목 | 네이티브 좌표/값 | 근거 |
| --- | --- | --- |
| 진행축 | Z, `-63 … 7` | active StartPoint / EndPoint |
| 캐릭터 깊이 | X = -4 | 동일한 시작/종료 노드 |
| 원본 actor origin | Y = 11 | StartPoint `(-4,11,-63)`, EndPoint `(-4,11,7)` |
| 발이 닿는 바닥 | Y ≈ 10 | `ground_tile01`의 실제 수평 mesh 삼각형 |
| 시험용 충돌 폭 | X `-5 … -3` | 위 바닥 안에서 선택한 좁은 스트립 |
| 전체 시각 mesh bounds | min `(-13.831989,2,-76)`, max `(0.003769,28,20)` | 사용되는 submesh 정점의 world 변환 |

시험 캐릭터의 발 좌표는 `(-4,10,z)`를 기준으로 한다. 네이티브 actor origin Y=11과 혼동하지 않는다. 기존 Node RPG 이동의 `x`는 별도 서버 adapter 좌표이다. 그 `x`를 원본 맵의 Unity world X로 연결해서는 안 된다.

## 실제 바닥에서 추출한 충돌과 전투 구역

복원 scene의 `ground_tile01`에서 Y≈10, 위쪽 면인 삼각형만 선택하고 X `[-5,-3]`, Z `[-63,7]`에 clip한다. 생성된 collider는 **9개 원본 renderer에서 유래한 40개 삼각형**이다. 각 결과 삼각형의 `triangleSources`에 renderer/geometry/submesh/triangle 번호를 남긴다. 새 이미지 기반 평면이나 장식물 전체 MeshCollider를 생성하지 않는다.

이것은 원래 게임의 collision component를 복구한 결과가 아니라, **원래 시각 바닥의 실제 geometry에서 제한적으로 파생한 시험용 충돌**이다. 난간, 촛대, 벽, 배경은 시각 전용이다. `colliders[].positions`는 이미 world-space이므로 identity transform의 비볼록 정적 MeshCollider에 사용한다. 원본 수치 오차인 수 µm 수준의 Y 차이는 유지한다.

| 구역 ID | 허용 Z | 플레이어 Z | 보스 Z |
| --- | --- | --- | --- |
| west (기본) | -61 … -37 | -56 | -42 |
| central | -41 … -17 | -36 | -22 |
| east | -19 … 5 | -14 | 0 |

모든 구역은 추출된 바닥 안에 있다. 보스 정의의 사거리/메커니즘을 시험할 수 있도록 동일한 네이티브 맵에서 24-unit 구간을 선택했다. 구역을 이동해도 맵의 크기나 좌표를 재스케일하지 않는다.

## 카메라 보존

`map-contract.camera`에는 `scene.camera.raw`와 `world`를 그대로 넣고, 원본 `source.json.gz`의 `CombatCamera` 노드 local pose와 parent도 기록한다.

| 값 | 원본 |
| --- | --- |
| local/world position | `(16,14.6300001144,-61.7999992371)` |
| local quaternion (x,y,z,w) | `(0.0185098797,-0.7068644762,0.0185098797,0.7068644762)` |
| scale / parent | `(1,1,1)` / 없음 |
| forward | 약 `(-0.998629544,-0.052335906,0)` |
| projection / orthographic | physical mode `2` / `false` |
| field of view | 36° |
| focal length | 36.9322013855 |
| sensor size | `(21.4899997711,24)` |
| lens shift | `(0,-0.4799999893)` |
| gate fit | 원본 enum 값 `2` |
| near / far | `0.3000000119 / 200` |

원본 카메라의 오른쪽은 네이티브 +Z 방향이다. 웹 `layout.json`의 orthographic panorama projection은 이 물리 카메라와 다르다. 런타임이 HUD/화면 비율에 맞춰 전투 구도를 조정하거나 Z 방향을 따라가면 그것은 **시험용 camera adaptation**으로 표시한다. 원본 위치·회전·센서·렌즈 이동·gate fit을 유지하는 raw camera 모드를 별도로 보존한다. 원본 카메라 follow 스크립트는 복구되지 않았다.

원본 evidence의 `Vignette`, `DitheredLightOverlay`는 Unity default resources 외부 mesh를 찾지 못한 **미해결 2개 항목**이다. 이 누락을 가상의 원본 mesh로 메우지 않는다. 조명, HDR 디코드, shader, 전체 particle 동작의 원본 대비 시각 동일성도 아직 Editor 검증 대상이다.

## 10종 보스의 기존 그래픽 대체

설계서의 전용 dragon/mecha/드론 그림은 제공되지 않았다. 아래는 현재 AssetIndex에 있고 실제 Spine 4.2 skeleton/atlas/PNG가 준비된 원본 몬스터를 시험용으로 연결한 표이다. 디자인에 맞는 신규 원화나 완성 모델이라고 표시하지 않는다.

| 보스 | 기존 monster ID | 기존 skeleton 이름 |
| --- | --- | --- |
| B01 Pyroth | 1253 | Enemy_BatBoss_01 |
| B02 Morthane | 1154 | Enemy_SkeletonMBoss_01 |
| B03 Granite Sentinel | 1323 | Enemy_InfernalElemental_Earth |
| B04 Sylphid | 1322 | Enemy_InfernalElemental_Water |
| B05 Vex'thara | 1104 | Enemy_Snixx_Boss_01 |
| B06 AXIOM-9 | 1105 | Enemy_GoblinWarrior_Boss_01 |
| B07 Nidra | 1202 | Enemy_Spider_Boss_01 |
| B08 Ravager Drone Array | 1252 | Enemy_BatM_01, 5개 인스턴스 |
| B09 VIRUS-7 | 1032 | Enemy_Slime_Boss_02_B |
| B10 TITAN-X | 1055 | Enemy_Nohaz_Boss_01 |

## 준비·검증·로컬 변경 보존

저장소 루트에서 실행한다. catalog export에는 기존 프로젝트 Node 의존성과 `mini-services/poker-server`의 tsx가 필요하고, WebP의 기존 PNG 변환에는 Pillow가 필요하다.

```text
python scripts/unity/prepare_assets.py --no-checkout
python scripts/unity/validate_export.py
python -m unittest discover -s scripts/unity -p test_map_contract.py -v
```

다른 Unity 프로젝트를 직접 준비할 때는 실제 `Assets`, `Packages/manifest.json`을 가진 root를 `--project-path`에 전달한다. 변경될 기존 Resources 파일은 **쓰기 전에** `IslandUpdateBackups/resources-<UTC timestamp>-<random>/Assets/Island/Resources/<원래 상대 경로>`에 복사한다. 같은 바이트의 파일은 쓰지 않고, 기존 `.meta`, 관련 없는 파일, 사용자 scene/prefab은 삭제하지 않는다. 이 exporter는 C# 파일을 복사하지 않는다. 현재 저장소 자신의 재현 가능한 출력에는 별도 백업을 만들지 않는다.

사용자의 미공개 uGUI/C# 수정이 있는 프로젝트에는 별도 `install_boss_trials.ps1` overlay 절차를 우선한다. 전체 `install_project.ps1` 또는 `prepare.ps1`은 기존 runtime/editor 파일을 갱신하는 경로이므로, 해당 로컬 수정의 병합 계획 없이 대신 사용하지 않는다. 설치 문서의 staging/merge 절차를 따른다.

Python 검증은 해시, PNG 크기, mesh 인덱스, UV/UV2 개수·유한값, 재질/submesh/lightmap 참조, static-batch 변환, local/world camera 일치, 원본 삼각형 내 collider 위치, 0.25-unit 간격의 전체 바닥 지원, actor 해석, 외부 Resources 백업을 확인한다. 의도적으로 mesh 인덱스·UV·재질·카메라·바닥을 손상한 경우도 실패를 확인한다. 일반 데이터/통합 테스트로 이 범위를 검증하므로 AGENTS.md에 따라 형식 검증은 적용하지 않았다. Unity Editor compile, URP render 결과, Play Mode 전투와 입력은 별도 확인이 필요하다.
