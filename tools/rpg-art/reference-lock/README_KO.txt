v2.1: Portable Python 검색 경로 수정. Python -I 격리 실행 회귀 테스트 추가.

홍 원본 얼굴 보존 v2 — ComfyUI / Z-Image Turbo

이번 작업 기록에는 LoadImage 없이 빈 잠재 이미지로 생성한 것이 확인되었습니다.
이 v2는 동봉한 hong_reference.png를 실제 업로드하여 입력으로 사용합니다.

사용법
1. ZIP 전체를 Downloads\hong-reference-lock-v2 에 압축 해제합니다.
2. 기존 ComfyUI 서버를 실행해 둡니다.
3. PowerShell에서:
   $tool = Join-Path $env:USERPROFILE "Downloads\hong-reference-lock-v2"
   powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_reference.ps1"

기본 설치 경로: G:\AI\ComfyUI_windows_portable
다른 설치 경로는 -Base "다른경로" 를 지정하세요.

기본값: 512x768, seed42, steps8, CFG1, denoise0.20.
원본 이미지 -> 크기 조절 -> VAE 인코딩 -> 얼굴 제외 노이즈 마스크 -> 생성
-> 원본 얼굴 영역 다시 합성 -> 저장 순서입니다.
이전 prompt-only 버전의 denoise1.0과 다르게 원본을 기준으로 보정합니다.

얼굴 고정의 의미
- 얼굴을 닮게 새로 그리는 인물 학습 모델이 아닙니다.
- 출력 해상도로 리사이즈한 원본 얼굴/머리 영역을 같은 위치에 합성합니다.
- 얼굴 내부는 원본을 사용하며, 경계4픽셀은 부드럽게 섞습니다.
- 보호 사각형은 동봉한 홍 이미지용으로 설정했습니다.
  x40%, y1.5%, width28%, height19%.
- 얼굴/몸의 위치, 포즈, 카메라 각도를 크게 바꾸는 용도로 쓰지 마세요.
  새로운 포즈에 원본 얼굴이 고정되면 목/머리 접합부가 어긋날 수 있습니다.
- 다른 캐릭터/다른 구도는 Python CLI의 --face-x/--face-y/
  --face-width/--face-height 로 보호 위치를 별도로 맞춰야 합니다.
- 투명 배경은 자동 보존하지 않습니다. 완성된 Spine 파츠/리그도 아닙니다.

결과
G:\AI\ComfyUI_windows_portable\ComfyUI\output\hong_reference_lock
작업 기록: G:\AI\ComfyUI_windows_portable\hong_jobs
이전 prompt-only 결과를 덮어쓰지 않습니다.

더 약한 보정
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_reference.ps1" -Denoise 0.15

프롬프트 파일 사용
notepad "$tool\reference_prompt.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_reference.ps1" -PromptFile "$tool\reference_prompt.txt"

추가 모델/커스텀 노드는 요구하지 않습니다. VAE가 없으면 공식 출처에서
다운로드합니다. 원본 두 대형 모델은 그대로 사용하므로 VRAM4GB에서는
여전히 느릴 수 있습니다. 얼굴 보존이 속도 문제를 해결하는 것은 아닙니다.

검증
원본 업로드/워크플로 연결/마스크 및 합성 경로/모의 생성 요청과 결과 저장
테스트4개 통과. 실제 사용자 GPU에서의 생성과 시각 품질은 미검증입니다.
