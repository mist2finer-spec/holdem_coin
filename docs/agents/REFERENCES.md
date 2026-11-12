# 아트·분석 도구 참조 — 필요할 때만 읽기

## Craft Anything / reverse_eng_designer

로컬 `G:/craft-anything`, 확인 버전 0.6.0. 2026-11-12 연결 당시 clean-room, 열린 대상 없음. 현재 실행 상태는 매번 session에서 확인한다.

순서: investigation/session → 질문 하나의 brief → 대상 선택 → 필요한 도구군 → summary → 필요한 evidence만 열람 → findings/unknowns → handoff. 실행/기기 변경에 대한 실제 도구 요구와 사용자 권한 범위를 따른다.

`reverse_eng_designer`는 분석 질문과 근거를 정리하고 [역할별 전달](HANDOFF.md)로 분배한다. 전체 덤프를 specialist 모두에게 보내지 않는다. 바르디안 과거 자료는 `G:/holdem_coin-workspace/island/archives/Vardian_Analysis_Reference.zip` 및 `records/VARDIAN_ANALYSIS_STATUS_KO.txt`; 해당 조사 요청이 있을 때만 연다.

## ComfyUI / art-lead·technical-artist

설치 `G:/AI/ComfyUI_windows_portable`, 확인 버전 0.42.1. 연결 주소 `http://127.0.0.1:8188`은 해당 Windows 컴퓨터에서만 접근 가능하다. 원격 GitHub 에이전트에서 이 주소가 사용자 컴퓨터를 뜻하지 않는다.

로컬 관리/기록: `G:/holdem_coin-workspace/island/maintenance/ggxrd-prep-20261112/comfyui/CONNECTION_KO.txt`.
SD 1.5 / IP-Adapter Plus SD15 / CLIP Vision 및 이미지 변형 노드 인식 확인. GTX 1650 4GB, native allocator 옵션 사용. 생성/품질/성능은 미검증이며 새로운 시안 요청 때 실행한다.

역할: 원본 캐릭터 이미지 복사본→변형/부분 수정 시안→art-lead 검토→technical-artist의 재질/모델 적용 검토. 2D 결과만으로 3D 메시·리깅이 변경되지는 않는다. 모델 다운로드·유료 API·원본 덮어쓰기는 연결 준비에 포함하지 않는다.

## 길티기어풍 셀 표현

[GGXrdShading 고정 소스](https://github.com/galloscript/GGXrdShading/blob/db46c5ccea57bf3eaf9176cbb9eedab8f4b6dd68/index.html): Three.js/GLSL 데모. 그림자 경계 마스크·음영색·정점색·뒷면 확장 외곽선을 참조한다. Unity 패키지가 아니며 코드/May 자산의 재사용 조건은 별도 확인한다.

[Arc System Works 공식 발표 안내](https://www.arcsystemworks.com/guilty-gear-xrds-art-style-the-x-factor-between-2d-and-3d-talk-from-gdc-2015-is-now-available-online/): 발표 링크만 확인했다. 영상 시청·PDF 상세 검토 완료로 보고하지 않는다.

로컬 준비서: `G:/holdem_coin-workspace/island/maintenance/ggxrd-prep-20261112/PREP_KO.txt`.
아직 미구현. 기존 도트 효과와 12fps 포즈 제한이 결합되어 있으므로 선명한 셀 표현 실험 시 설정 분리를 검토한다. 현재 게임 에셋에 맞는 음영/선/포즈/카메라 비교가 필요하다.
