# Mount Sunday — 독립 Unity 에셋 사용

이 패키지는 **Unity 6000.0.62f1 / URP 17.0.4**를 대상으로 만든 독립 환경 에셋이다. 개별 모델·재질·prefab 생성 도구와 선택적인 탐험 데모를 제공한다. 기존 게임 코드·서버·씬에는 연결하지 않는다. 이 제작 환경에서는 Unity Editor가 없어 C# 컴파일·셰이더 컴파일·Play Mode·Android 성능을 실행 검증하지 않았다. Blender 미리보기와 Unity 실행 결과는 별개다.

## 가져오기

1. 현재 Unity 프로젝트를 백업한다. `Assets/MountSunday` 폴더 전체를 프로젝트 `Assets` 아래 복사한다. 기존 `Assets/Island`, `Packages`, `ProjectSettings`를 덮어쓰지 않는다.
2. FBX 임포트와 스크립트 컴파일이 끝날 때까지 기다린다. 현재 프로젝트가 URP 17인지 확인한다. 이 패키지는 파이프라인 에셋이나 Quality 설정을 자동 교체하지 않는다.
3. **개별 에셋만 필요하면 `Tools > Mount Sunday > Build Asset Prefabs Only`를 실행한다.** `Data/stage.json`에 따라 공용 material, LODGroup, 충돌체와 `Generated/Prefabs`의 prefab을 만든다. 씬 파일을 생성하지 않으며 게임 연동도 하지 않는다. 기존 씬 배치 없이 prefabs를 골라 사용할 수 있다.
4. 전체 환경을 검토하려면 선택적으로 `Tools > Mount Sunday > Build Exploration Scene`을 실행한다. 배치·경로 표시·조명과 전용 데모 씬을 만든다. `Assets/MountSunday/Generated/Scenes/MountSunday_Exploration.unity`를 열고 Play한다. 생성 작업 뒤 기존 열린 씬으로 복귀하므로, 생성된 씬은 직접 열어야 한다.
5. `Tools > Mount Sunday > Validate Package`를 실행한다. 결과는 Console 및 `Generated/Validation.json`에 저장된다. 모델·재질·셰이더 오류, prefab, collider, Read/Write, 전체 LOD의 triangle 수를 검사한다. FPS 검사가 아니다.

`Generated`는 재생성 전용 폴더다. 그 안에서 수동 편집한 내용은 다음 Build에 덮어써질 수 있으므로, 수정본은 별도 폴더에 복제한다. 원본 `Models`와 기존 게임 씬은 변경하지 않는다.

### FBX 방향·미터 보정

`Models/AxisCalibration.fbx`에는 같은 설정으로 내보낸 1m East/North/Up 기준 메시가 있다. 빌드 도구는 실제 Unity 임포트 후 이 메시의 중심을 읽고, 목표 `East=+X`, `North=-Z`, `Up=+Y`와 비교한다. 필요하면 회전·signed scale·원점 보정 wrapper를 모든 모델 내부에 적용한다. 배치 JSON의 위치와 yaw는 변경하지 않는다. shear·특이행렬·보정 오차 0.5mm 초과는 빌드를 중단한다.

`Tools > Mount Sunday > Validate Coordinate Import`로 관측 축과 적용 보정을 확인할 수 있다. 결과는 전체 검증 JSON에도 포함된다. 이 기능이 실제 Unity를 실행하기 전 방향을 검증했다는 뜻은 아니다. FBX export/import 옵션을 변경하면 모든 모델과 기준 파일에 동일하게 적용하고 prefab을 다시 생성한다.

## 탐험 조작

| 입력 | 동작 |
|---|---|
| WASD | 걷기 / 비행 이동 |
| 마우스 오른쪽 버튼을 누른 채 이동 | 시점 회전 |
| Shift | 달리기 / 비행 가속 |
| Tab | 걷기 ↔ 비행 |
| Q / E | 비행 중 하강 / 상승 |
| N | 다음 경로 지점으로 이동 |
| Esc | 마우스 잠금 해제 |

기본은 CharacterController 걷기다. 계단 높이 0.35m, 경사 제한 45°, 중력과 충돌체를 사용한다. 물 표면·급경사·절벽을 자동으로 통과하지 않으며, 지형 전체가 걷기 가능한 것은 아니다. 비행 모드는 충돌을 무시하는 환경 검토용이다. NavMesh와 적 AI는 포함하지 않는다. 키보드·마우스 입력은 설치된 Unity Input System 또는 Legacy Input Manager를 조건부로 지원한다. 모바일 터치 UI는 제공하지 않는다.

## 오브젝트·재질·최적화 구조

- 원본 FBX는 미터 단위로 가져온다. 배치 JSON은 Unity 좌표계(X/Z 지면, Y 높이)다.
- `*_LOD0`, `*_LOD1`, `*_LOD2` 이름이 있는 메시/상위 그룹에서 LODGroup을 만든다. 전환 화면 비율은 0.12 / 0.045 / 0.008이다. Fade는 사용하지 않는다.
- `colliderMode=mesh`는 LOD0의 정적 MeshCollider, `box`는 LOD0 전체 경계의 BoxCollider, `none`은 충돌체 없음이다. 예외적으로 `category=tree`의 `box`는 수관이 길을 막지 않도록 뿌리 원점 중심의 줄기용 CapsuleCollider를 만든다(반경 높이×0.035, 0.12–0.5m; 높이 전체×0.6, 최대 6m). 이 충돌체는 독립 에셋의 물리 표면이며 게임 규칙을 추가하지 않는다.
- MeshCollider 모델만 Read/Write를 켜서 CPU 메시 사본을 보관한다. 축 signed-scale 보정과 부모 변환에 따른 collision cooking을 안정적으로 수행하기 위한 설정이다. 적용 대상은 포함된 manifest의 `colliderMode=mesh` 항목이다. 그 외 모델 및 축 기준 파일은 끈다. 두 Build 메뉴는 설정이 다른 FBX만 다시 임포트한다. 해당 FBX의 모든 LOD가 CPU 메모리를 추가로 사용하므로, 추후 모바일용으로 별도 저밀도 collision mesh를 bake하고 실기에서 검증할 필요가 있다.
- `MS_` 재질 색과 FBX vertex color를 곱하는 양면 URP 셰이더를 사용한다. 작은 월드 공간 색 변화, 주광 그림자, ambient, fog, 거칠기, 약한 식생 바람을 지원한다. 바람에는 렌더 경계를 확장한다.
- `MS_Water`는 작은 파형과 움직이는 표면 노멀을 사용한 불투명 수면이다. 굴절·물리 유체·수영 시스템은 포함하지 않는다.
- 모든 메시에는 색상이 필요하다. 별도로 칠하지 않은 모델은 흰색 vertex color를 내보낸다.
- 머티리얼은 GPU instancing을 켠다. 개별 렌더러 수, 실제 batching 및 성능은 Unity Profiler에서 확인해야 한다. 모든 소품이 자동 청크 스트리밍되는 것은 아니다.
- 바람/수면 재질의 오브젝트는 static batching 플래그를 해제하며 셰이더의 dynamic batching도 비활성화한다. 원점 대비 높이를 사용하는 바람 셰이더에서 world-space 결합으로 흔들림 기준이 바뀌는 것을 방지한다. GPU instancing/SRP Batcher와는 별개다. Forward/ShadowCaster/DepthOnly가 같은 변형 함수를 사용한다.
- 데모 카메라는 16km far clip을 사용한다. 개별 에셋만 사용하는 경우에는 사용자가 선택한 카메라의 clip과 표시 거리를 별도로 설정한다.
- 데모는 모든 환경 인스턴스를 씬에 배치한다. 먼 산은 낮은 밀도 지형, 근거리는 별도 LOD 모델이다. 현재 패키지를 Android 최적화 완료로 해석하지 않는다.
- 조명은 directional light 하나, ambient, fog, ACES, Bloom 0.10 / threshold 1.15다. 이 설정은 선택적인 독립 데모 씬에만 저장한다.

## 확인 범위

정적 파일·manifest·소스 검토만 수행했다. 실제 Unity 임포트와 렌더, 축 보정값, 충돌·걷기, LOD 전환, Editor/Player 빌드, 모바일 성능은 Unity에서 확인해야 한다. 제공된 도구는 기존 게임이나 서버에 접속하지 않는다.

Read/Write와 메모리 조건은 Unity 6 공식 문서를 기준으로 했다:

- https://docs.unity3d.com/6000.0/Documentation/Manual/prepare-mesh-for-mesh-collider.html
- https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Mesh-isReadable.html
