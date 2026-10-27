홍 Unity/Spine 제작 재개 — 2026-10-27

현재 시작점
운영 홍의 전투 프레임(00-idle-0.png)과 동일한 SHA256의 이미지를 참조한다.
이전 hong_spine_work의 긴 일러스트 파츠는 보존한다. 뒤쪽 팔/손3개가 비어 있고
미분류 픽셀28,426개가 남은 원본 초안을 완성된 전투 리그로 취급하지 않는다.
이 작업은 제작 브랜치이며 운영 main의 플레이어16프레임/포커/RPG 배포를 바꾸지 않는다.

사용 환경
G:\AI\ComfyUI_windows_portable / GTX1650 4GB / localhost:8188
z_image_turbo_bf16 + qwen_3_4b + ae.safetensors를 그대로 사용한다.
API키, 유료 LLM 호출, 새 생성모델/커스텀노드 설치가 필요 없다.

1. ComfyUI가 꺼져 있으면 별도 PowerShell 창에서:
Set-Location 'G:\AI\ComfyUI_windows_portable'
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --disable-cuda-malloc --lowvram --preview-method none

이미 실행 중이면 이 명령으로 중복 실행하지 않는다. 브라우저 창을 닫아도 되지만
서버 터미널은 켜 둔다. 요청마다 서버를 껐다 켤 필요는 없다.

2. 재개 도구 다운로드:
$script = Join-Path $env:USERPROFILE 'Downloads\resume_hong.ps1'
Invoke-WebRequest 'https://raw.githubusercontent.com/mist2finer-spec/holdem_coin/rpg/comfy-spine-resume/tools/rpg-art/resume_hong.ps1' -OutFile $script
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Action Check

기본 설치 폴더는 G:\AI\hong-unity-spine-resume. 실행에 필요한 네 파일만 받고,
각 다운로드의 SHA256을 검증한다. 기존 파츠나 출력 이미지를 이 폴더로 옮기지 않는다.
Check는 모델/노드/장치/큐를 읽기만 한다. 생성이나 다운로드된 모델 교체를 하지 않는다.

3. 기본형 후보1장 생성:
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Action Generate

512x512 img2img, 8steps / CFG1 / denoise0.35 / seed42, 256x256 출력.
원본 로비 얼굴을 덮어붙이는 합성은 없다. 마스크 분할/투명 배경/얼굴 동일성은 보장하지 않는다.
단일 이미지 조건이며 두 번째 스타일 참조가 자동으로 적용되는 구조가 아니다.
서버 큐에 다른 작업이 있으면 새 요청을 제출하지 않고 중단한다.
GTX1650에서는 첫 모델 로딩/오프로딩이 오래 걸릴 수 있다. 중간에 재실행하지 않는다.

결과:
G:\AI\ComfyUI_windows_portable\ComfyUI\output\hong_combat_base
G:\AI\ComfyUI_windows_portable\hong_jobs\<새 날짜>\result-1.png
추가 기록:
G:\AI\ComfyUI_windows_portable\hong_resume_records

변형 후보는 Seed나 Denoise를 바꿔 생성한다:
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Action Generate -Seed 123 -Denoise 0.30

기존 작업 현황만 확인:
powershell -NoProfile -ExecutionPolicy Bypass -File $script -Action Report -Work 'G:\AI\ComfyUI_windows_portable\hong_spine_work'
이 명령은 파츠를 수정/승인하거나 아틀라스를 다시 내보내지 않는다.

다음 제작 순서
- result-1.png의 실루엣/얼굴/의상/손발/관절 분리 가능성을 먼저 검토한다.
- 검토한 전투 기본형 비율로 새 파츠 경계와 피벗을 잡는다. 이전 긴 체형용 폴리곤을 그대로 적용하지 않는다.
- 앞뒤 팔/다리와 가려진 관절 표면을 보완하고 알파를 정리한다.
- Spine Editor에서 본/메시/웨이트/IK와 무기4종 동작·타격 이벤트를 만든다.
- Unity spine-unity에 JSON/atlas/texture를 가져와 실제 장면에서 확인한다.
현재 스크립트가 .spine 프로젝트/완성 메시 리그/Unity 프리팹을 만들어 주는 것은 아니다.

검증
새 재개 기능 테스트6개 + 기존 combat-base 테스트4개 통과.
portable의 격리 모드(-I)에서도 형제 모듈 import 통과.
실제 사용자 PC GPU 추론은 이 환경에서 실행하지 않았다. Check/Generate를 로컬에서 실행해야 한다.
