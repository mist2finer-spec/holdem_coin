# IslandGame 전투 모델 축소본

2026-11-05, `fix/unity-tree-spacing-20261105`의 `af4305e`에서 기록한 Unity 전투 GLB를 사용했다. 원본 파일 19개의 SHA-256은 [manifest.json](manifest.json)에 기록했다.

| 파일 | 원본 tris | 축소 tris | 본 | 애니메이션 |
| --- | ---: | ---: | ---: | ---: |
| PinkGlass_5000.glb | 9,387 | 5,000 | 65 | 18 |
| Slime_300.glb | 8,292 | 299 | 3 | 1 |

Pink Glass는 같은 스켈레톤과 메시를 쓰던 클립별 원본을 메시 하나와 클립 18개로 통합했다. 원본 본 계층, 역바인드 행렬과 애니메이션 타임스탬프·값·보간 방식은 유지했다. 축소 메시에는 가까운 원본 정점의 스킨 웨이트를 옮겼다. 슬라임은 확대 시 밑단에 면이 접혀 보일 수 있다.

## 실제 Unity 프로젝트에 넣기

1. `G:/new_project/IslandGame`을 열고 기존 glTFast 임포터로 두 GLB를 가져온다. 테스트용 새 폴더 `Assets/Island/Art/Battle3D/LowPoly/`에 넣는다.
2. 기존 `Battle3DAssets` 설정을 복제해 비교용 설정을 만든다. `hero`에 Pink Glass 임포트 모델을, `slime`에 슬라임 임포트 모델을 연결한다. 기존 `heroMaterial`, `slimeMaterial`, 높이와 회전 설정은 복제한 값을 사용한다.
3. Inspector에서 각 GLB의 애니메이션 서브 에셋을 열고 아래 표대로 연결한다. `idle`은 기존 캐릭터의 설정에 맞춰 `sword_idle` 또는 `idle_loop`를 선택한다.
4. 기존 전투에서 비교용 설정으로 실행한다. 대기·이동·기본 공격·피격·슬라임의 눌렸다 펴지는 동작을 확인하고, 화면에 몬스터가 몰릴 때 실기기 프레임 시간을 비교한다.

| Battle3DAssets 필드 | GLB 클립 이름 |
| --- | --- |
| idle, run | sword_idle 또는 idle_loop, jog_fwd_loop |
| jumpStart, jumpLoop, jumpLand | jump_start, jump_loop, jump_land |
| roll, slide, death, hit | roll, slide_loop, death01, hit_chest |
| attack1, attack2, attack3 | sword_regular_a, sword_regular_b, sword_regular_c |
| combo, heavy, dash, spell | sword_regular_combo, sword_heavy_combo, sword_dash, spell_simple_shoot |
| slimeIdle | Slime_RigAction |

Pink Glass에 walk_loop도 포함되어 있다.

## 검증 상태

- GLB 파싱, 삼각형 수, 본 인덱스, 스킨 가중치와 애니메이션 데이터 대조 통과.
- Khronos glTF Validator 오류 0. 원본과 같은 스킨 노드 배치 관련 경고가 남아 있다. Pink Glass의 사용되지 않는 발광 강도 설정도 경고로 기록된다.
- 같은 전투 카메라에서 대표 공격·대기·슬라임 동작의 외형 비교 완료. 비교 렌더는 Unity 외부에서 수행했다.
- Unity Editor 임포트·Play Mode와 모바일 성능은 미검증.
