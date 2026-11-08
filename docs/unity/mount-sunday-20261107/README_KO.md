# 전체 지형·원경·소품

# Mount Sunday — Unity 에셋 파일

게임이나 서버에 직접 연결하지 않는 에셋 배포본입니다. 나무/바위/풀/꽃/건축물은 원본 모델23종이며 각 FBX 안에 LOD0/1/2가 들어 있습니다. 색상은 메시 버텍스 컬러로 저장되며 동봉 URP 셰이더로 표시합니다.

## Unity에서 사용

대상: Unity6000.0.62f1 / URP17.0.4.
1. 압축의 Assets/MountSunday 폴더를 Unity 프로젝트 Assets 아래에 복사합니다.
2. 임포트가 끝나면 Tools > Mount Sunday > Build Asset Prefabs Only를 실행합니다.
3. Generated/Prefabs에서 원하는 prefab을 본인의 씬에 배치합니다.
4. Tools > Mount Sunday > Validate Package로 파일/재질/좌표 설정을 검사합니다.

이 메뉴는 prefab·material만 생성합니다. 기존 씬, 카메라, 서버 또는 게임 진행 구조를 연결하지 않습니다. Build Exploration Scene은 별도 검토 씬이 필요할 때만 선택하는 옵션입니다.

FBX를 다른 도구에서 직접 사용할 수도 있습니다. FBX의 세 LOD를 동시에 표시하면 겹치므로 LOD0만 활성화하거나 LODGroup으로 설정합니다. 1단위=1m입니다. 원본 Blender는 X동쪽/Y북쪽/Z위, 배치 JSON의 Unity 좌표는 (X,Z,-Y)입니다. 임포트 도구가 기준축 모델로 실제 축/단위 변환을 확인합니다.

## 검증 범위

실제 FBX 메시, 인덱스, 색상, LOD, 지형 좌표, 다리/집터 정렬은 검사했습니다. Validation/의 결과를 참고하세요. Unity Editor 컴파일·Play·실기 성능은 이 환경에서 검증하지 못했습니다. 영상 수준 최종 미술 마감과 성능 승인본은 아닙니다.

원형 소품은 각각의 환경에 맞춰 배치/재질/스케일을 조정해 사용할 수 있습니다. 풀 군락과 실제 지형은 큰 맵용 자산으로, 필요 구역만 선택하거나 밀도·가시거리를 줄여 사용하세요.

## 이 파일의 내용

- 23종의 개별 소품 +64개 2m 격자 지형타일(2×2km) +16개 원경타일(16×16km).
- 풀/꽃 군락106개, 다리 경사로2개, 하천1개. 총212개 에셋 정의와 축 검사 모델1개.
- Data/stage.json:840개 배치·주요 이동 지점. 자동 게임 연결 데이터가 아닌 편집용 배치 기록입니다.
- Data/heightfield_f32.bytes:게임용으로 편집한2m 높이 격자. float32 little-endian,1001×1001, Unity Z 증가 순서. 다리 높이는 별도입니다.
- 전체 LOD0를 모두 표시하면 약1,275만 triangles입니다. 전부 동시에 배치하는 것을 기본 성능 목표로 삼지 마세요. 근거리 지형 자체에는 다단계 LOD가 없습니다.

실제 LINZ 지형을 사용했으며 길·집터·정상 평탄화, 하천/다리, 모든 건물과 식생은 창작한 게임용 배치입니다. 원본1mDEM·블렌더 제작 스크립트는 Source에 있습니다. Blender 편집 장면은 별도 MountSunday_Stage.blend 파일입니다.
