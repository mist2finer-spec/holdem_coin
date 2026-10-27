홍 프롬프트 생성기 — ComfyUI Portable / Z-Image Turbo

1. ZIP 전체를 Downloads\hong-comfy-prompt 폴더에 압축 해제하세요.
   run_hong.ps1 과 generate_hong.py 가 같은 폴더에 있어야 합니다.
2. 기존 ComfyUI를 실행해 http://127.0.0.1:8188 이 열리도록 두세요.
3. PowerShell에서:
   $tool = Join-Path $env:USERPROFILE "Downloads\hong-comfy-prompt"
   powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_hong.ps1"

설치 위치 기본값: G:\AI\ComfyUI_windows_portable
다른 경로면 -Base "다른경로" 를 붙이세요.

프롬프트 변경:
   notepad "$tool\hong_prompt.txt"
   powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_hong.ps1" -PromptFile "$tool\hong_prompt.txt"

다른 시드:
   powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_hong.ps1" -Seed 123

생성 없이 연결/모델 확인 (VAE가 없으면 먼저 다운로드):
   powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_hong.ps1" -CheckOnly

기본 설정: 512x768 / batch1 / steps8 / CFG1 / res_multistep / simple /
shift3 / seed42 / denoise1.0. 참조 이미지를 사용하지 않는 텍스트 생성이므로
denoise1.0이 맞습니다. 이전 이미지 수정용0.30과 용도가 다릅니다.
원본 얼굴/의상을 정확히 보장하지 않으며, 스파인 뼈대/파츠가 자동 생성되지는 않습니다.

기존에 받은 모델 두 개는 유지합니다. ae.safetensors가 없으면 공식
Comfy-Org Hugging Face 배포처에서 약320MB 다운로드합니다.
모델을 인식하지 못하면 파일명/경로를 확인하고 ComfyUI를 재시작하세요.
현재 브라우저의 노드 캔버스를 바꾸지 않고 API로 별도의 작업을 제출합니다.
API 형식 JSON과 일반 UI 워크플로 JSON은 다릅니다.

결과: G:\AI\ComfyUI_windows_portable\ComfyUI\output\hong_prompt
작업기록/결과복사: G:\AI\ComfyUI_windows_portable\hong_jobs

GTX1650 4GB에서 실제 GPU 검증은 아직 하지 않았습니다. 11.46GB 모델과
7.49GB 텍스트 인코더가 모두 VRAM에 들어가지 않으므로 메모리 오프로딩으로
매우 느릴 수 있고, 드라이버/메모리 오류가 날 수 있습니다.
모델 이름이 bf16이라고 강제로 --force-bf16을 지정하지 마세요.
이미지 크기를 낮추는 것만으로 모델 가중치 메모리 문제까지 해결되지는 않습니다.

기다리기 제한은1시간이며 초과해도 서버 작업을 자동 취소하지 않습니다.
다시 실행하기 전 ComfyUI 큐를 확인해 중복 제출을 피하세요.
에러가 나면 PowerShell 마지막 ERROR와 ComfyUI 터미널 로그를 확인하세요.

검증: Python 표준 라이브러리 기반 모의 HTTP 테스트5개 통과.
별도 Python 패키지 설치나 공개 포트 설정이 필요하지 않습니다.
