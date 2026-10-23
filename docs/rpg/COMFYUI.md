# ComfyUI 에셋 제작 연결

공식 저장소: https://github.com/comfyanonymous/ComfyUI (현재 Comfy-Org/ComfyUI로 이동).
`workflows/comfyui/upstream.json`에 원본 URL과 검토한 커밋을 고정한다. ComfyUI 코드/모델을 게임 서버에 포함하지 않고 별도 제작 도구로 사용한다.

## 1. 공식 코드 연결

프로젝트 루트에서 Python과 Git이 설치된 상태로:

```powershell
npm run comfy:bootstrap
```

`.tools/ComfyUI`에 공식 코드를 받아 지정 커밋으로 checkout한다. 로컬 변경이 있으면 중단하여 보존한다. 자동으로 커스텀 노드나 모델을 내려받거나 실행하지 않는다.
이 명령은 소스 연결이며 GPU 런타임 설치 완료를 뜻하지 않는다.

## 2. Windows에서 실제 생성 서버 실행

이미 설치한 ComfyUI Desktop/Portable을 사용해도 된다. 없다면 공식 설치 문서를 따라 GPU에 맞는 PyTorch와 requirements를 별도 가상환경에 설치한다:
https://github.com/Comfy-Org/ComfyUI#installing
https://docs.comfy.org/installation/system_requirements

수동 설치를 선택했다면, 공식 문서대로 PyTorch/requirements 설치를 마친 가상환경에서:

```powershell
cd .tools\ComfyUI
python main.py --listen 127.0.0.1 --port 8188
```

모델 체크포인트는 공식 배포 출처에서 사용 조건을 확인하고 ComfyUI의 `models/checkpoints`에 배치한다. 이 템플릿은 CheckpointLoaderSimple/CLIP/VAE를 함께 제공하는 일반적인 SD/SDXL 계열 체크포인트용이다. FLUX 등 다른 구조는 해당 모델의 API 워크플로가 별도로 필요하다.
게임을 제공하는 Render 무료 인스턴스에 이 생성 서버를 설치하지 않는다. GPU PC 또는 별도의 GPU 서버에서 실행한다.

## 3. 연결 확인 및 작업 준비

아래는 다시 **holdem_coin 루트**에서 실행한다.

```powershell
npm run comfy:doctor
npm run comfy:prepare -- --character hong --checkpoint "실제로_설치한_모델.safetensors" --prompt "clean character reference, same outfit" --seed 42 --denoise 0.25
npm run comfy:run
```

다른 주소는 환경변수로 지정할 수 있다. 이 프로그램이 실행되는 컴퓨터 기준 주소다. ChatGPT 실행 환경의 localhost는 사용자 PC가 아니다.

```powershell
$env:COMFYUI_URL = "http://127.0.0.1:8188"
npm run comfy:doctor
```

`doctor`는 실제 응답, 핵심 노드, 설치한 체크포인트 목록을 확인한다. `prepare`는 GPU 없이 작업 JSON을 만든다. `run`은 원본 참조 PNG를 업로드하고 `/prompt` → `/history/{id}` → `/view`로 완료 이미지와 출처를 받는다.
인증이 있는 원격 ComfyUI는 이 기본 클라이언트에 해당 인증 방식이 추가로 필요하다. 공개 포트나 터널은 자동으로 만들지 않는다.

## 4. 원본 보존과 Spine 연결

참조 이미지는 현재 승인된 `public/rpg/characters/<id>/rig/preview.png`이며 첫 3종의 정확한 연결도 현재 roster를 따른다. 전체 JPG 보드를 생성기에 넣지 않는다.
결과와 seed·워크플로·원본 SHA256·upstream 커밋은 `data/comfyui/review/<character>/<prompt-id>/`에 저장한다. 생성된 결과는 public 디렉터리나 실제 게임 이미지에 자동으로 덮어쓰지 않는다.

낮은 denoise는 외형 보존에 도움을 주지만 보장하지 않는다. 참조 이미지의 투명 배경도 생성 결과에 자동 보존되지 않는다. 원본 얼굴·의상·실루엣·알파를 비교한 뒤 승인된 보완 파츠만 기존 Spine 리그에 편입한다.
이 워크플로는 이미지 후보 제작용이며 Spine 본/웨이트/콤보 타격 코드를 자동 생성하는 도구가 아니다.

현재 기본 워크플로: `workflows/comfyui/img2img.api.json` (API 형식). ComfyUI UI에서 사용할 경우 API 형식 가져오기 기능을 이용하며, 에디터용 노드 좌표를 담은 일반 workflow JSON과 구별한다.

## 검증

```powershell
npm run test:comfy
```

테스트는 로컬 모의 HTTP 서버를 이용해 참조 업로드, 큐 제출, 결과 다운로드, 오류 처리를 검증한다. 실제 GPU 추론 성공과는 별개다. 서버가 없을 때 `comfy:doctor`의 연결 실패는 정상이며 생성 가능한 상태로 보고하지 않는다.
