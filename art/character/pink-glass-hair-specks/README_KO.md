# Pink Glass 머리카락의 떨어진 조각 3개 제거

2026-11-23 사용자 요청에 따라 `SM_Hair`에서 목 뒤로 떨어져 있던 **세 조각(꼭짓점 4+4+6개, 삼각형 8개)**만 삭제했다. Blender 원본과 기존 내보내기 작업 사본에 반영하고, 아래 GLB를 **같은 경로·같은 파일 이름**으로 다시 내보냈다.

`unity/IslandGame/Assets/Island/Characters/PinkGlass/Meshes/PinkGlass_ArtLead_cloth_review.glb`

**PASS — 지정한 세 조각 제거, 다른 메시 변화 0, 머리 본체와 Unity 연결 정보 보존.** Unity Editor 실행과 실제 게임 재검수는 **UNAVAILABLE — 미실행**이다.

## 전후 수치

| 기준 | 꼭짓점 전 → 후 | 삼각형 전 → 후 | 삭제한 섬 |
| --- | --- | --- | --- |
| Blender 원본 SM_Hair | 5,264 → **5,250** | 9,874 → **9,866** | 3개 |
| GLB SM_Hair | 9,833 → **9,819** | 9,874 → **9,866** | 3개 |

GLB는 UV·노멀 경계에서 꼭짓점을 분리하므로 원본 Blender보다 꼭짓점 수가 많다. 두 형식 모두 정확히 **14개 꼭짓점·8개 삼각형**이 줄었다. 세 조각은 모두 Head 뼈에 100% 가중치가 있는 별도 섬이었다.

게임의 기존 조건과 동일하게, 같은 위치의 꼭짓점을 묶어 연결된 섬을 구한 뒤 **8꼭짓점 이하이며 가장 큰 섬의 경계 상자에서 중심이 10cm 넘게 떨어진 섬**을 검사했다. 수정 후 이 조건에 맞는 섬은 **0개**다. 기존 임시 제거 코드는 수정하지 않았다. 해당 조건을 GLB 데이터에 적용한 결과이므로 실제 Unity 실행 결과와 구분한다.

## 다른 메시 변화 0

아래 수치는 GLB 메시 기준이다. 모든 행의 꼭짓점·삼각형 수뿐 아니라 위치, 노멀, UV, 조인트, 가중치와 삼각형 인덱스 배열도 전후 정확히 일치한다.

| 메시 | 꼭짓점 전 = 후 | 삼각형 전 = 후 |
| --- | ---: | ---: |
| RT_Left_Hand | 8,345 | 16,576 |
| RT_Right_Hand | 8,345 | 16,576 |
| SM_CropTop | 683 | 696 |
| CleanGlasses | 1,551 | 2,720 |
| SM_Head.001 | 7,739 | 7,041 |
| SM_Jacket | 7,462 | 7,728 |
| SM_Legs_Stockings | 1,399 | 1,459 |
| SM_Shoes.001 | 15,954 | 12,912 |
| SM_Skirt_Straps | 6,681 | 5,806 |
| SM_Torso_Skin | 749 | 687 |

## 보존 확인

- 머리카락의 남은 꼭짓점 위치·노멀·UV·가중치·삼각형이 전후 정확히 일치한다. 형태 조정·병합·리토폴로지·재가중치 작업은 하지 않았다.
- GLB의 노드 이름·계층·변환·스킨·뼈 기준 행렬·재질·텍스처 설정과 이미지 원본 바이트가 일치한다.
- `.meta` 파일 바이트 불변. GUID `9d0941d668f3c6645836c737b210db20` 유지.
- 기존에 수정되어 있던 `ProjectSettings.asset`는 그대로 보존했다. 이번 Unity 경로의 변경은 요청된 GLB 하나다.
- Blender의 다른 메시 87개도 원본과 일치했다. 원본에 있던 외부 참고 오브젝트는 내보내기 대상에서 제외했다.

## 확인 이미지와 기록

[전후 확인 이미지](hair_specks_before_after.png)는 같은 카메라·조명·재질에서 `SM_Hair`만 따로 보인 목덜미 확대다. 왼쪽 동그라미가 삭제한 세 조각이다. 오른쪽은 수정 후다. 작성자 시각 검토이며 독립 검수나 게임 화면은 아니다.

- [검사 원문](validation.json)
- 작업·수정 전 백업: `G:/holdem_coin-workspace/island/maintenance/hair-specks-20261123/`
- 갱신한 Blender 원본: `G:/holdem_coin-workspace/island/maintenance/art-rev2-pinkglass-20261114/phase2/cloth-fix-20261115/local-only_MayShip_cloth_review.blend`
- 갱신한 내보내기 작업 사본: `G:/holdem_coin-workspace/island/maintenance/rev2-2p-pinkglass-20261116/work/artlead/source_cloth_review.blend`

GLB SHA-256 전: `d52a59d539983d7702ff6161f2702d96ac6433423a432ecb1f8900946686dd85`

GLB SHA-256 후: `ba7c0cdc3d748fce5683ccb408d6dcedaee7439647bea001f11de998fcfe2181`

Unity Editor 조작·코드 변경·커밋·push·Issue 게시 없이 로컬 원본 정리와 재내보내기만 수행했다.
