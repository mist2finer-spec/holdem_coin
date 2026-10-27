홍 전투 픽셀 기준 이미지 제작 — 기존 일러스트 분할 키트와 별개

이전 키트는 로비의 긴 등신 일러스트를 자른 것이므로 목표와 달랐습니다.
이번에는 프로젝트에 이미 있는 홍 전투용 픽셀 프레임을 실제 참조 입력으로 사용합니다.
홍_combat_reference.png는 기존 파일이며 이번에 새로 생성한 결과가 아닙니다.
본 키트는 기준 이미지 후보 생성 단계만 담당하며, 완성 Spine 파츠/리그는 생성하지 않습니다.

사용:
ZIP을 Downloads\hong-vardian-base 에 전체 압축 해제합니다.
ComfyUI를 켜둔 뒤 PowerShell:
$tool = Join-Path $env:USERPROFILE "Downloads\hong-vardian-base"
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_combat.ps1"

참조 전투 픽셀 이미지를 512x512 nearest-exact로 확대한 뒤 VAEEncode로
실제로 입력합니다. 기존 모델을 사용한 img2img denoise0.40,
steps8 / CFG1 / res_multistep / simple이며, 출력은256x256으로 축소합니다.
원본 일러스트 얼굴을 덮어붙이거나 얼굴 위치를 강제 고정하지 않습니다.
기존 결과/게임/에셋을 덮어쓰지 않습니다.

결과: G:\AI\ComfyUI_windows_portable\ComfyUI\output\hong_combat_base
작업기록: G:\AI\ComfyUI_windows_portable\hong_jobs

다른 시드:
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_combat.ps1" -Seed 123
더 약한 변경:
powershell -NoProfile -ExecutionPolicy Bypass -File "$tool\run_combat.ps1" -Denoise 0.30

중요한 한계:
텍스트+단일 이미지 img2img이며 별도의 스타일/IP-Adapter/포즈제어 모델이 아닙니다.
바르디안 원본 아틀라스의 스타일을 학습했거나 동일하게 복제하는 것이 아닙니다.
픽셀 크기/비율을 유도하지만, Z-Image가 픽셀 묘사나 얼굴을 바꿀 수 있습니다.
nearest 축소만으로 좋은 픽셀아트가 보장되지 않습니다.
투명 배경도 자동 보존되지 않습니다. 기준 이미지 품질 검토 후 배경/윤곽 정리가 필요합니다.
기준 디자인 확정 전에 이번 이미지를 그대로 자동 파츠 분할하지 마세요.
이전 긴 등신용 파츠 폴리곤과 뼈대는 새 비율에 맞지 않으므로 재사용하면 안 됩니다.
최종 목적은 기준 전투 이미지 확정 -> 그 비율로 파츠/관절 재설계 -> Spine 모션입니다.

검증: 연결구조/얼굴합성 없음/스케일/포터블Python 경로 테스트4개 통과.
실제 GPU 생성과 그림 품질은 미검증입니다. GTX1650 4GB 속도 문제는 그대로입니다.
