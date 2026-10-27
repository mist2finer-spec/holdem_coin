# Hong Heavy Axe v2 / 에셋 제작 툴킷

이 작업은 운영 게임에 배포하지 않은 제작 브랜치의 테스트다. `main`의 홍 리그는 그대로다. 검은 홍채와 SD 비율을 유지하고, 기존 이미지를 재생성하지 않고 Spine 4.2 키프레임/슬롯을 다시 작성했다.

## 결과

- 총0.60초: 예비동작0~.25, 내려찍기.25~.30, 회전정지.30~.38, 복귀.38~.60.
- `Root → pelvis → torso → front/back-shoulder → upper-arm → forearm → hand → weapon` 계층. 어깨 2개, 치마, FX 본을 추가하여23본.
- 골반: 예비(-15,+8), 타격(+45,-25) px. 보행 지지점은2-bone IK로 보정하며 팔 길이를 초과하는 목표는 제한한다.
- 가슴: Spine Y-up 좌표에서 예비+25°, 타격-35°. 이는 요청한 화면상 뒤/앞 기울기의 부호를 변환한 것이다. ScaleX .88→1.15, ShearX -12→+15.
- 도끼의 실제 월드 방향: X축 기준+110°→-70°. 그림이 위를 향하므로 부착 본에서는90°를 보상한다.
- `.30~.38`에는 모든 관절 회전을 동일 값으로 고정. 가슴과 무기 본의 이동만±3으로 진동.
- 머리카락/치마는 지연된 준비 동작과 타격정지 해제 후50~60ms 지연된 오버슈트. 정지 구간에는 이들도 회전을 멈춘다.
- `slash-fx` 슬롯에3개의 직접 그린 수학적 곡선 텍스처를 교체하고 알파를1→0으로 내린다. GIF 합성만의 이펙트가 아니며 JSON/atlas에 들어 있다.
- Spine4.2의 베지어 제어점은 정규화0~1이 아니라 절대 시간/값이다. 스칼라4개, 벡터8개를 출력하여 공식 런타임에서 검증했다.

## 연결한 외부 소스와 실제 실행 범위

상세 커밋과 라이선스는 `connections.lock.json`에 고정했다. `bootstrap.py --cache <폴더>`는 저장소를 가져오기만 하며, 외부 설치/생성 스크립트를 자동 실행하지 않는다.

| 저장소 | 실제 사용/연결 상태 |
|---|---|
| GenielabsOpenSource/spine-animation-ai | SKILL/포맷/원칙과 SIFT+RANSAC 방식을 검토. PolyForm Noncommercial이므로 운영 코드에 복사하지 않음. 베지어/리깅/정렬 검사는 표준 수학으로 독립 구현. |
| Tau-J/rtmlib | CPU ONNX RTMPose-t body7로 업로드 시트73프레임 추정. 신뢰도 통과 관절만 예비 동작 높이의 보조값으로 사용. |
| facebookresearch/AnimatedDrawings | 투영 평면/깊이 드라이버 설정 검토. 실제 예제 BVH를30프레임 정사영하고5개 매핑을 Spine JSON으로 옮기는 연결 테스트 완료. |
| rundiwu/2D-Motion-Retargeting | 소스 및 FBX 변환/신경망 입력 절차 확인. 학습 체크포인트를 실행하지 않았으며, 이것이 이번 도끼 모션을 생성했다고 주장하지 않음. |
| ToonCrafter/ToonCrafter | 소스 확보, 검토된 프레임을 슬롯으로 가져오는 입력 경로 준비. 모델 추론/가중치 다운로드는 실행하지 않음. 공식 안내24~27GB, 커뮤니티 경량화약10GB라 사용자 GTX1650 4GB 대상으로 실행하지 않음. |
| chongdashu/ai-game-spritesheets | 앵커 고정/프레임 순서/정규화/프롬프트 구조 검토. `prompts/hong-heavy-keyposes.md`로 후속 원화 요청을 구체화. 유료 생성 API 호출 없음. |

HumanArt detector와 body7 pose estimator는 구분해야 한다. 이번 입력은 이미 개별 인물로 잘라진 프레임이므로 검출기는 생략하고 RTMPose-t body7을 사용했다. 이 모델이 작은 도트/가려진 손을 항상 정확하게 인식하는 것은 아니다. 평균 코어 신뢰도는 검투사.455, 도끼.161, 쌍검.140이었다. 양 팔146구간 중5개만 신뢰도 가드를 통과했다. 추정 실패값을 억지로 본에 넣지 않았다.

SIFT 검사는 홍 머리 파츠에34개 매치/34개 RANSAC 인라이어를 얻었으나, 기존 수동 위치가 있으므로 좌표를 자동 덮어쓰지 않았다.

## 제작 재실행

저장소 루트에서 Python/Pillow 및 프로젝트 Node 의존성을 준비한다. 렌더 QA에만 `@napi-rs/canvas`가 추가로 필요하다. CPU 포즈 추정은 별도 venv에 `requirements-cpu.txt`를 설치한 뒤 `rtmlib==0.0.16`을 `--no-deps`로 설치한다. 불필요한 OpenCV 휠 중복 설치를 피하기 위한 순서다.

```bash
python tools/rpg-art/animation-toolkit/prepare_heavy_axe.py --source archive/rpg/hong-authoring/sd-base --out /tmp/hong-axe/rig
node tools/rpg-art/animation-toolkit/build_heavy_axe.mjs --rig /tmp/hong-axe/rig --project . --poses archive/rpg/hong-authoring/heavy-axe-v2/reference-poses.json
node tools/rpg-art/animation-toolkit/validate_heavy_axe.mjs --rig /tmp/hong-axe/rig --project .
```

`extract_reference_pose.py`는 사용자가 지정한 시트 경로/행 분할 JSON을 입력받는다. 첨부된 외부 레퍼런스 원본 그림은 공개 Git에 재게시하지 않았다.

## BVH / Frame Swap 경로

- `project_bvh.py`: BVH 로컬 채널 순서대로 전방 운동학 → XY/XZ/ZY 정사영 → 각도·깊이·길이 축소율 드라이버 JSON.
- `import_bvh_to_spine.py`: 사용자가 검토한 이름 매핑만 허용하여 상대 각도 타임라인으로 변환. 선택적 `--foreshorten`은 본의 실제 자식 축을 기준으로 길이 축소 행렬을 scale/shear로 분해한다(후속 아트 검토 필요). 현재 예제는 손 흔들기 BVH의 연결 검사이며, 도끼 공격 모션 캡처가 아니다. 실제 대검/도끼 BVH/FBX가 추가되면 무기별 재타깃 검토가 필요하다.
- `attach_frame_swap.py`: 검토된 동일 크기 RGBA 파츠 시퀀스를 특정 슬롯에 추가하고 종료 시 원래 그림으로 복귀. 전체 ToonCrafter 프레임을 몸통 슬롯에 그대로 붙이지 않음.
- 토르소 스왑 입력 경로는2개 테스트 파츠로 round-trip 검증했다. 이번 결과에서 실제로 스왑하는 그림은 슬래시3장이다. 새 뒷모습 토르소/새 무기 손 원화는 생성하지 않았다.

## 게임에 반영할 때

1. 새 동작의 시각적 접촉은.30초다. 기존 클라이언트 하드코딩.20초를 사용하면 이펙트와 피해가 엇갈린다. 서버 hitAt을 유지하면서 새.30 접촉을 기준으로 앞/뒤 구간을 재매핑한다.
2. 기존 `groundSkeleton`의 매 프레임 발 강제 정렬은 골반의 깊은 하강/전진을 상쇄할 수 있다. 이번에는 제작 시 지지 다리를 맞췄으므로 바닥 관통 방어와 실제 이동/충돌을 별도로 연결해야 한다.
3. FX는 JSON native slot/alpha이므로 별도 GIF 이펙트 코드가 필요 없다. 실제 피해는 기존 서버만 결정해야 한다.
4. 원본 동작의 지상45px 전진은 시각적 골반 이동이다. 게임 월드 좌표/판정 거리/무적 시간을 바꾸지 않았다.
5. Unity/Spine Editor 직접 import는 아직 하지 않았다. 공식4.2 런타임 렌더와 수치 검증만 완료했다.

단일 앞/측면 원화의 본 회전으로 실제 등 면을 만들 수는 없다. 등·손바닥·돌아선 가슴이 보이는 프레임은 후속 승인 원화나 별도 파츠 생성이 필요하다.
