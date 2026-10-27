홍 Spine 제작 키트 — 원본 파츠 초안 + ComfyUI 보완 + Spine4.2 JSON

중요: 완성된 자동 리깅/자동 분할 도구가 아닙니다.
홍 원본의 현재 구도를 기준으로 편집 가능한 파츠 경계와 관절을 제공합니다.
얼굴을 새로 생성하지 않습니다. 이미지를 몸 전체로 반복 재생성하는 방식도 아닙니다.

0. 압축 해제
Downloads\hong-spine-kit 에 전체를 해제하세요.
기본 Python: G:\AI\ComfyUI_windows_portable\python_embeded\python.exe
ComfyUI 의 Pillow를 사용합니다. 없으면 래퍼가 Pillow만 설치합니다.
원본 hong_reference.png와 스크립트들을 같은 폴더에 두세요.

1. 파츠 준비 — GPU/ComfyUI 서버 없이 실행 가능
$tool = Join-Path $env:USERPROFILE "Downloads\hong-spine-kit"
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_spine.ps1" -Stage prepare

기본 작업 폴더: G:\AI\ComfyUI_windows_portable\hong_spine_work
16개 파츠 정의, 19개 뼈대(원본16 + root + 무기 장착점2)를 준비합니다.
브라우저로 edit_parts.html이 열립니다.

2. 경계 검수 — 꼭 필요한 단계
원본 위치를 기준으로 만든 대략적 폴리곤이므로 자동 의미 분할 결과가 아닙니다.
편집 화면에서 파츠 선택 -> 노란 점 드래그로 윤곽 수정, 빨간 점/관절 위치 조정.
손/팔에 몸통 조각이 붙거나, 머리카락에 얼굴이 섞이지 않는지 확인하세요.
다른 파츠에 가려져 원본에 없는 표면과 관절 뒤쪽은 복원 자료가 없는 영역입니다.
뒤팔3개는 빈 파츠로 시작합니다. 임의의 원본 조각을 뒤팔이라고 부르지 않습니다.
경계 밖에 남은 원본은 unassigned-source 레이어에 보존됩니다. 이 잔여 레이어가
남아 있으면 파츠가 움직일 때 잔상이 생길 수 있으므로 실제 제작 전 경계를 수정하세요.
readiness.json의 unassignedSourcePixels/needsCompletion/empty로 미완성 항목을 봅니다.
첫 원본 셋업 미리보기는 원본 픽셀을 재조립한 것입니다. 생성 결과로 표시하지 않습니다.

수정 JSON 다운로드 버튼 -> hong_parts.edited.json.
검수/승인 전이라면 다음 명령으로 다시 준비하세요:
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_spine.ps1" -Stage prepare -Config "$env:USERPROFILE\Downloads\hong_parts.edited.json"
이미 승인한 파츠의 경계를 바꾼다면 -Out "G:\AI\hong_spine_work_v2" 처럼 새 작업 폴더를 사용하세요.

3. ComfyUI로 실제 파츠 보완 — 한 개씩 실행
ComfyUI 서버를 실행한 상태에서:
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_spine.ps1" -Stage repair -Part torso

가려진 뒤팔 예시:
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_spine.ps1" -Stage repair -Part back-upper-arm

원본 파츠의 보이는 픽셀을 회색 캔버스에 놓고 VAEEncode -> 마스크 적용
-> denoise0.65 재생성 -> 파츠 폴리곤 알파 적용 순서입니다.
가려진 파츠는 앞쪽 파츠를 참조 초안으로 사용합니다. 이는 실제 뒤쪽 그림을
추출했다는 뜻이 아닙니다. AI가 제안한 보완안이므로 반드시 확인하세요.
전체 캐릭터나 얼굴을 새로 만들지 않습니다. head는 보완 명령이 차단됩니다.
필요한 파일/커스텀 노드를 새로 잔뜩 설치하지 않고 기존 Z-Image/Qwen/ae를 사용합니다.
VAE가 없으면 공식 출처에서 다운로드합니다. GTX1650 4GB 속도 제약은 그대로입니다.

마스크는 masks/<part>.png입니다. 흰 곳만 변경, 검은 곳 유지.
기본은 해당 파츠 전체 영역이며, 원하는 경우 그림 편집기에서 보완할 부분만
흰색으로 바꾸면 변경 범위를 더 좁힐 수 있습니다. 배경 제거 AI가 아니므로,
후보 PNG의 알파는 지정한 폴리곤입니다. 윤곽을 벗어난 손가락/장식은 잘릴 수 있어 검수해야 합니다.

결과는 작업 폴더 candidates\<파트-시간>\candidate.png 입니다.
원본/사용 중 파츠를 자동으로 덮어쓰지 않습니다.

4. 후보 검토 후 적용
PowerShell에서 가장 최근 몸통 후보를 선택하는 예시:
$work = "G:\AI\ComfyUI_windows_portable\hong_spine_work"
$candidate = Get-ChildItem "$work\candidates\torso-*\candidate.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Start-Process $candidate.FullName

직접 확인한 뒤 적용하려면:
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_spine.ps1" -Stage approve -Candidate $candidate.FullName

이전 파츠는 review 폴더에 백업하고, 파츠와 아틀라스/JSON을 다시 만듭니다.
파츠가 여전히 불완전하면 적용하지 않고 시드/프롬프트/마스크를 조정하세요.

5. 최종 파일 다시 만들기
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_spine.ps1" -Stage export

spine/hong.json               Spine4.2 Import Data용 뼈대/슬롯/Region attachments
spine/hong.atlas.txt          Unity용 아틀라스 텍스트
spine/hong.atlas              동일 내용, 기타 런타임용
spine/hong.png                straight-alpha 텍스처
spine/parts/*.png             개별 파츠 이미지
review/parts_contact_sheet.png 파츠 목록
review/setup_preview.png     셋업 조립 결과
readiness.json               누락/미분류/보완 항목

Spine Editor4.2에서 Import Data -> hong.json.
이미지 경로가 맞지 않으면 해당 skeleton의 Images 경로를 spine/parts로 지정하세요.
Spine에서 메시/웨이트/IK/관절 겹침/레이어 순서를 조정하고 .spine 원본으로 저장합니다.
포함된 애니메이션은 setup과 root의 작은 idle-preview뿐입니다.
걷기/회피/무기4종 공격/타격 이벤트는 아직 제작하지 않았습니다.
무기 장착점은 있지만 실제 무기 이미지/무기별 콤보가 들어있다는 뜻은 아닙니다.
Unity는 에디터와 맞는 spine-unity4.2를 사용하고, 편집 완료 후 에디터에서 다시 내보내는 것을 권장합니다.
완성된 메시 리그나 Unity prefab/.meta가 자동 생성되는 것이 아닙니다.

검증
Python 테스트9개 통과, Portable -I import 확인,
Spine4.2 runtime JSON/atlas 로딩 및180프레임 유한 좌표 확인.
ComfyUI 통신은 모의 서버로 검증; 실제 GPU 보완 생성/Spine Editor/Unity 시각 검수는 미검증.
example_output은 원본 파츠 분리 예시이며 AI가 보완한 최종 파츠가 아닙니다.

공식 형식 참고
https://esotericsoftware.com/spine-json-format
https://esotericsoftware.com/spine-import
