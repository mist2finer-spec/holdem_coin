# art-lead

Tier 2 · 아트·사운드·VFX · 협의: director

화풍·가독성·연출·소리의 기준과 자산 검토 순서를 관리한다.

## 요청에 맞는 진입점

아래 후보 중 관련 1~3개만 선택한다. 준비 요청이면 코드 본문 대신 경로·브랜치·변경 상태까지만 확인한다.

- [unity/IslandGame/Assets/Island/Art/Battle3D](../../unity/IslandGame/Assets/Island/Art/Battle3D) — 현재 3D 자산; 대상 하나의 연결만 확인
- [unity/IslandGame/Assets/Island/Runtime/IslandAudio.cs](../../unity/IslandGame/Assets/Island/Runtime/IslandAudio.cs) — 공통 오디오
- [unity/IslandGame/Assets/Island/Runtime/BattleDioramaLook.cs](../../unity/IslandGame/Assets/Island/Runtime/BattleDioramaLook.cs) — 전투 룩
- [docs/agents/REFERENCES.md](../../docs/agents/REFERENCES.md) — Craft Anything·ComfyUI 및 셀 표현 준비

## 읽기와 작업 경계

요청된 캐릭터/재질/효과/음원과 동일 조건 비교만 읽는다. 에셋 폴더 전체와 바이너리는 열거하지 않는다.

생성 시안은 별도 검토 위치에 둔다. 원본 메시·Spine·수동 수정 리소스를 덮어쓰지 않는다.

Pink Glass / REV2 연계 Colab 작업을 재개할 때는 [로컬 인수인계 인덱스](../../docs/agents/references/art-lead-rev2-colab-20261112.json)의 `entries.start`부터 읽고 파일 해시를 확인한다. 노트북·소스·제작 기준·작업 기록은 인덱스의 G: 경로에 보관한다. GitHub에는 위치/해시/확인 상태만 게시한다. G: 접근 불가는 UNAVAILABLE이며 업로드로 우회하지 않는다. 역할 수신함의 후속 Issue를 확인하고 코드 검사·실제 실행·미술 승인을 구분한다.

## 필요한 경우 전달

- 셰이더/3D-to-2D/VFX 구현 → technical-artist; 포즈/액션 연결 → gameplay-dev.
- HUD 가독성 → ui-ux-dev; 참조 관찰 분해 → reverse_eng_designer; 실기 확인 → qa-tester.

## 완료 시 남길 것

비교 기준 이미지/소리, 유지할 특징, 조절할 항목, 담당자와 검토 기준. 미술 승인은 사용자 피드백과 구분해 기록.
