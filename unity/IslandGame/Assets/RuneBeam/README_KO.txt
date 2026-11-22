Rune Beam | Unity VFX

시작
RuneBeam.unitypackage를 임포트하고 Assets/RuneBeam/Demo/RuneBeamDemo.unity를 열어 Play를 누르세요. 데모에서 같은 시전을 기본 속도와 반속으로 반복합니다. 브라우저 미리보기는 RuneBeam_Viewer.html을 Chrome이나 Edge에서 열면 됩니다. 타임라인을 움직이면 해당 프레임에서 멈추고, 화면을 드래그하면 카메라가 회전합니다. 짧은 빔 버튼은 길이를 7.5에서 3.0으로 바꿉니다.

캐릭터에 연결
1. Assets/RuneBeam/RuneBeam.prefab을 손이나 지팡이의 시전 피벗에 배치합니다. 큰 룬 고리 중심이 원점입니다. 로컬 +Z축이 빔 진행 방향이며, 두 문양은 로컬 XY 평면에 놓입니다.
2. 애니메이션에서 발동하려면 프리팹의 Play On Enable을 끄세요. Animator를 가진 오브젝트에 RuneBeamTrigger를 추가하고 자식 프리팹의 RuneBeam 컴포넌트를 Effect 슬롯에 지정하세요.
3. 시전 시작 프레임에 Animation Event를 추가하고 CastRuneBeam을 선택하세요. 이 이벤트부터 룬이 충전됩니다. 빔이 나와야 하는 시점에서 기본값 기준 약 1.30초 앞에 배치하면 됩니다.
4. 코드에서 RuneBeamFX.RuneBeam.Play()에 해당하는 인스턴스 메서드 effect.Play()를 호출해도 됩니다. effect.Stop()은 즉시 숨깁니다. 같은 인스턴스에서 Play()를 다시 호출하면 처음부터 재생합니다.

인스펙터
Duration 3.6초 — 고리가 나타나고 마지막 잔광이 사라질 때까지의 전체 시간입니다.
Charge 0.36 — 전체 시간 중 충전에 할당하는 비율입니다. 기본 설정에서 약 1.30초에 발사가 시작됩니다.
Beam Length 7.5 — 원점에서 끝까지 로컬 +Z 방향 거리입니다. Size와 Transform 스케일을 적용하기 전 값입니다.
Beam Width 1.0 — 방출되는 광선과 필라멘트의 폭입니다.
Size / Intensity / Tint — 룬과 빔의 전체 크기, 발광 세기, 색조를 조절합니다.
Ground Glow / Floor Distance — 바닥광 세기와 피벗에서 바닥광까지의 로컬 거리입니다. 바닥에 살짝 띄우려면 바닥으로부터 피벗 높이보다 조금 작게 설정하세요. 기울어진 지팡이, 공중 또는 벽 부착 시에는 Ground Glow를 0으로 둘 수 있습니다.
Preview Phase — 에디터 정지 상태에서 확인할 재생 위치입니다. 0.23은 충전, 0.55는 방출, 0.93은 소멸 구간입니다.

렌더링
두 개의 독립적으로 회전하는 룬 고리, 충전 광구와 입자, 붓자국 마스크가 흐르는 빔 중심, 나선형 필라멘트, 별 모양 입자, 잔광을 하나의 가산 셰이더로 그립니다. 원거리 타격이나 대미지 판정은 게임 로직에서 처리하면 됩니다.
Unity 2022.3 및 Unity 6의 Built-in과 URP 3D Renderer를 대상으로 작성했습니다. 외부 VFX Graph 패키지는 필요하지 않습니다. 미리보기는 같은 메시·마스크·셰이더 계산을 사용하고 후처리로 Bloom을 더했습니다. Unity에서 유사한 번짐을 원하면 프로젝트의 Linear Color Space, HDR, Bloom 설정을 확인하세요.

레퍼런스
MB Media의 Rune Beam VFX // UE 5 Niagara
https://www.youtube.com/watch?v=ZVAgSXgRZrM
작가 Muhammed Başaran의 Magic Rune Beam
https://muhammedbsrn.artstation.com/projects/RyBbLE
충전 및 방출 프레임을 참고했습니다. 패키지의 문양, 마스크, 메시와 셰이더는 새로 만들었으며 시전 길이는 게임에서 조절할 수 있도록 설정했습니다.
