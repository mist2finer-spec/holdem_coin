Ember Slash | Unity VFX

시작
EmberSlash.unitypackage를 가져온 후 Assets/EmberSlash/Demo/EmberSlashDemo.unity를 열고 Play를 누르세요. 기본 속도와 1/3 속도가 번갈아 재생됩니다. Assets/EmberSlash/EmberSlash.prefab을 원하는 씬에 드래그하면 인스펙터의 Preview Phase로 정지 프레임을 확인할 수 있습니다.

캐릭터 공격에 연결
1. 캐릭터 루트 아래 허리 높이에 빈 오브젝트를 만들고 프리팹을 자식으로 배치하세요. 이펙트 중심이 회전축입니다. 로컬 XZ가 베기 평면이며 프리팹의 회전으로 대각선·세로 베기를 만들 수 있습니다.
2. EmberSlash의 Play On Enable을 꺼 두세요. Animator가 붙은 오브젝트에 EmberSlashTrigger를 추가하고, 자식 프리팹의 EmberSlash를 Effect에 연결하세요.
3. 공격 클립에서 검이 가속하는 프레임에 Animation Event를 넣고 Slash를 선택하세요. 반대 방향 공격에는 SlashMirrored를 사용하세요. 코드에서도 EmberSlash.Play()와 PlayMirrored()로 재생할 수 있습니다.
4. 검 본이 이미 같은 궤적을 크게 회전하면 고정된 공격 피벗에 배치하세요. 이 프리팹은 자체 곡선을 재생하며, 과거 검끝 좌표를 추적하는 트레일과 동작 방식이 다릅니다.

인스펙터
Duration은 불티가 사라질 때까지의 전체 시간입니다. 기본값은 0.82초입니다.
Sweep는 전체 시간 중 검끝이 호를 그리는 비율입니다. 기본값 0.36이면 약 0.30초에 호가 완성됩니다.
Persistence는 이미 지나간 구간의 잔상이 빛을 유지하는 시간을 조절합니다.
Size는 전체 크기, Intensity와 Tint는 발광의 세기와 색, Mirrored는 좌우 방향을 조절합니다.
Ground Glow는 바닥에 더하는 광채입니다. Floor Distance는 피벗에서 바닥광까지의 로컬 거리이며 Size에 비례합니다. 평면이 바닥 바로 위에 오도록 맞추세요. 벽이나 공중에서 사용하거나 프리팹을 세워 쓰면 Ground Glow를 0으로 둘 수 있습니다.
Preview Phase는 에디터 정지 상태의 재생 위치입니다. 기본값 0.32에서 금빛 궤적과 불티를 함께 볼 수 있습니다.

구성 및 렌더링
반투명 가산 셰이더 한 패스로 리본, 빌보드 불티 98개, 굴곡의 섬광, 바닥광을 그립니다. 불티는 3D 속도와 중력을 따릅니다. 바닥광은 함께 그리는 평면으로, 별도 실시간 조명이 필요하지 않습니다. 각 인스턴스는 메시를 한 번 읽고 재생 동안 셰이더 시간만 갱신합니다.
Unity 2022.3 및 Unity 6의 Built-in / URP 3D Renderer를 대상으로 작성했습니다. 별도 VFX Graph나 플러그인 의존성은 없습니다. 샘플과 비슷한 색은 Linear Color Space에서 확인하세요. 프로젝트에 적용된 Exposure와 Bloom에 따라 색감과 번짐 정도가 달라집니다.

레퍼런스
@mbmediagames의 Ember Sword Slash VFX // UE5 Niagara
https://www.youtube.com/shorts/OrybFC8bHAQ
공개 대표 프레임의 초승달 실루엣, 백금색 중심선, 붉은 광채와 불티를 기준으로 재구성했습니다. 메시, 마스크, 셰이더, 재생 타이밍은 이 패키지를 위해 제작했습니다.
