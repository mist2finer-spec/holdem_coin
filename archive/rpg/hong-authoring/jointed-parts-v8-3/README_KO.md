# Hong TRUE JOINT RIG v8.3
v8.2 원본 보존. 원본 hong_sheet_another.jpg 디자인을 대조한 관절/비율 교정본입니다. 원본의 모든 픽셀/의상을 복원한 새 원화는 아니며, 기존 생성 파츠를 재사용했습니다.
- 상박 ROI8~88%, 두께1.10. 소매 포함.
- 하박 ROI18~85%, 두께1.10. 피부색 캡 제거 유지.
- 허벅지 ROI3~68%, 두께1.15. 상단 맨살/가터 보존, 캡 마스킹 및 분리된 장식 잔상 제거.
- 종아리 ROI18~84%, 두께1.15.
- 상박15px/하박17px/허벅지16px/종아리17px. 자식 본 오프셋은 부모 본 길이와 일치. Shield mount8.5px.
- 모든 팔/다리 양끝은 실제 피벗 중심의 반타원 capsule alpha mask. 부모쪽5px, 상박/허벅지 자식쪽5px, 하박/종아리 자식쪽2px. 짧은 본에 맞게 v8.2의7px 연장을5px로 축소했습니다.
- 어깨 near(-12,19), far(9,21). v8.2보다 낮고 near는 뒤로 이동.
- 이동 발 IK 목표는 자신의 고관절 기준 수평 변위0.60배. 짧아진 본과 결합되어 v8.2 대비 전체 보폭은 더 짧아집니다. 무릎은 실시간 IK로 재해결.
- 상박 월드각도 [-150,5]도 제한, 기준-85도에서0.82배 진폭 감쇠. 이동 팔스윙도0.60배. 공격 시 하박각을 연동 보정해 잽 완전펴짐 유지. 시간 필터에 의한 지연은 추가하지 않아 결정론적 루프/타격시점을 유지합니다.
- partNames는 사용자 지정 head/hair/torso/pelvis/near arms/far arms/near legs/far legs 순서. partNames 메타데이터 순서와 실제 슬롯 그리기 순서는 분리했습니다. 실제 그리기는 v8.2 가림 순서 유지.
- 얼굴 원본 PNG 유지, 뒷머리 정수리 보정 유지. 23본/신체16파츠/IK2개/15모션.
- 1815개 런타임 시점: 고정 길이/IK/그립/정수리/상박 각도/루프/잽/킥 검사 통과.
## 파일
rig/: Spine4.2 JSON/atlas/PNG/개별파츠.
parts-manifest.json 및 parts-manifest_2.json: 동일 내용 호환용 별칭. 실제 ROI/본길이/마스크/두께/캡 설정.
image-validation.json: 픽셀 마스크/관절 중심 알파 검사.
GIF는 정상 재생 및 v8.2 대비 동일 배율. spritesheets는 4x4/16프레임/셀384px, 발 피벗(140,335).
scripts에는 재현용4개 스크립트, source에는 기존 얼굴/장비, reference-motion.json은 기존 평가 원본(불변).
## 재현
python scripts/prepare_jointed_v8.py --generated generated-parts-atlas.png --original source/pose-00.png --gear source/gear --out rebuild/rig
node scripts/build_jointed_v8.mjs --out rebuild --project /path/to/holdem_coin --motion reference-motion.json
node scripts/validate_jointed_v8.mjs --out rebuild --project /path/to/holdem_coin
node scripts/render_jointed_v8.mjs --out rebuild --project /path/to/holdem_coin
Python Pillow/numpy/scipy, Node Spine4.2 canvas 및 @napi-rs/canvas 필요.
운영 배포/Unity 에디터 직접 임포트 미실시. 모든 각도에서 원화 이음새가 없음을 보장하는 미술 최종본은 아닙니다.
