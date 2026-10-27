홍 전투 이미지 -> 투명도/파츠 -> ComfyUI 보완 -> Spine 초안
기준은 20261026-220857-15bcf8/result-1.png 그대로다. 새 전신을 재생성하지 않는다.

준비
ComfyUI portable 위치: G:\AI\ComfyUI_windows_portable
새 작업 위치: G:\AI\hong_combat_spine_work
도구 설치 위치: G:\AI\hong-unity-spine-resume
기존 hong_spine_work와 운영 게임은 바꾸지 않는다. 새 폴더만 사용한다.

1. 배경과 파츠 준비 (GPU 서버 없이 가능)
$script = Join-Path $env:USERPROFILE 'Downloads\next_hong_spine.ps1'
Invoke-WebRequest 'https://raw.githubusercontent.com/mist2finer-spec/holdem_coin/rpg/comfy-spine-resume/tools/rpg-art/next_hong_spine.ps1' -OutFile $script
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Stage Prepare

필요한 파일7개를 SHA256 검증 후 자동으로 받는다. Pillow가 없으면 설치한다.
브라우저에 edit_matte.html(투명도), edit_parts.html(파츠/관절)이 열린다.
review/setup_preview.png는 실제 배정된 파츠만 조립한 초안이다.
작업 폴더를 이미 만들었다면 초기화하지 않는다. Report로 확인하거나 새 -Out을 지정한다.

자동 투명도는 가장자리와 연결된 어두운 배경(max RGB<=12)을 제거하는 초안이다.
검은 머리/옷/외곽선이 손상되거나 검은 테두리가 남았으면 matte 편집기에서
배경 지우기/원본 복원 브러시로 수정한다. 원본 RGB는 변경하지 않는다.
수정 마스크는 hong_alpha.edited.png로 다운로드된다.
파츠 편집기에서 노란 경계/빨간 관절을 조정하고 hong_parts.edited.json을 다운로드한다.
이것은 수작업으로 잡은 전투 비율의 초안이다. 자동 의미 분할이나 숨은 해부학 복원이 아니다.
얼굴은 원본으로 잠가 두며 뒤쪽 어깨/위팔은 원본에 가려진 구역으로 비워 둔다.
그 외 눈에 보이는 뒤쪽 팔뚝/손은 현재 그림의 픽셀로 시작한다.

수정본을 적용하려면 기존 작업을 덮지 않고 새 작업 폴더로:
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Stage Prepare -Out 'G:\AI\hong_combat_spine_work_v2' -AlphaMask "$env:USERPROFILE\Downloads\hong_alpha.edited.png" -Config "$env:USERPROFILE\Downloads\hong_parts.edited.json"
이후 명령에도 동일한 -Out을 붙인다. 하나만 수정했다면 해당 옵션만 지정한다.

2. 가려진 파츠 보완 (ComfyUI 실행 필요)
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Stage Repair -Part back-upper-arm

기존 모델 Z-Image Turbo/Qwen/ae를 사용하고 픽셀 모드로 입출력 크기를 맞춘다.
1개 파츠만 큐에 제출한다. 기존 작업이 실행 중이면 중복 제출하지 않는다.
기본 denoise0.55. 얼굴 재생성은 차단한다. 본체나 앞 파츠를 자동 덮어쓰지 않는다.
후보: G:\AI\hong_combat_spine_work\candidates\back-upper-arm-<시간>\candidate.png
흰 마스크 구역만 보완 대상이다. 그림/마스크/윤곽은 사람이 확인해야 한다.
마스크 폴리곤이 잘못되면 손가락이나 관절이 잘릴 수 있다.

후보 열기:
$work = 'G:\AI\hong_combat_spine_work'
$candidate = Get-ChildItem "$work\candidates\back-upper-arm-*\candidate.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Start-Process $candidate.FullName

실제 그림을 확인하고 사용할 후보라고 판단한 경우에만:
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Stage Apply -Candidate $candidate.FullName
이전 파츠는 review에 백업한다. 다른 원본/다른 크기의 후보는 거부한다.
다른 파츠도 -Part torso/front-forearm/...으로 한 개씩 보완한다.

3. Spine 편집기용 내보내기 (GPU 서버 없이 가능)
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Stage Export

spine/hong.json, hong.atlas.txt, hong.png 및 parts/*.png.
19본(무기 장착점2개 포함), Region attachments, setup/idle-preview가 들어간다.
파츠가 배정되지 않은 잔여 그림은 움직일 때 잔상을 만들므로 리그에 넣지 않는다.
그래서 review/setup_preview.png에 빈 곳이 있으면 파츠 경계를 수정하거나 가려진 면을 보완해야 한다.
readiness.json의 empty/needsCompletion/unassignedSourcePixels를 확인한다.

Spine Editor의 해당 4.2 형식 Import Data로 hong.json을 열고 이미지 경로를 parts로 맞춘다.
관절 겹침/레이어/메시/웨이트/IK를 조정한 뒤 .spine 프로젝트로 저장한다.
이동/회피/무기4종 공격/피격 타이밍은 파츠를 검토한 다음 제작할 단계다.
현재 출력에 완성된 전투 모션이나 Unity prefab/.meta가 포함되어 있지는 않다.
Unity에서는 에디터/데이터 형식과 호환되는 spine-unity 런타임으로 JSON/atlas/texture를 가져온다.
픽셀 이미지이므로 Nearest 필터, straight-alpha로 출력한다. 아틀라스를 PMA로 취급하지 않는다.

검증
새 기능 테스트7개, 기존 파츠 도구9개, 제작 재개6개/기본형4개 테스트 통과.
실제 Spine4.2 런타임에서 19본/18슬롯 로딩 및 idle-preview180프레임 유한 좌표 확인.
GPU 파츠 생성/실제 Spine Editor·Unity 시각 검수는 사용자 PC에서 확인해야 한다.
