# 사냥 프로토타입 — guid_7

시작 화면의 **사냥하기** 또는 `/hunt`로 진입합니다. 기존 포커 코드와 별도의 브라우저 로컬 시뮬레이션입니다.

## 가이드와 리소스 선정

| 가이드 구성 | 구현 | 번들 원본 |
| --- | --- | --- |
| 초상화·레벨·전투력 | 좌측 상단 고정 HUD, 테스트 값 | uiicons: Portrait_Hero_005 |
| 2종 커런시 | 상단 골드·보석, 테스트 골드만 증가 | uiicons: mat_gold / mat_arcanegem |
| 사냥터·사냥/휴식 | 달빛 숲 1–1, 자동/휴식 전환 | map: BG_Forest01 / BG_Tree01 |
| 슬라이드 메뉴 | 출석·우편·설정·공지 안내 패널 | DOM/CSS |
| 좌우 조이스틱·양방향 회피 | Pointer Capture + 키보드, 이동 경계 | DOM/CSS |
| 스킬 6개·자동/수동 | 개별 쿨다운, 자동 기본 공격 | uiicons: 선별 스킬 6종 |
| 움직이는 플레이어 | Spine 4.2 런타임, cos/cos0 + weapon/grade1 | model: Hero_Axe01 |
| 전투 대상 | 슬라임 1종, 체력·피해 숫자·처치·재출현 | model: Enemy_Slime_01_R |

리소스별 번들명, 번들 SHA256, 문자열 Object ID, 추출 SHA256은 `public/rpg/asset-manifest.json`에 있습니다.
Object ID는 번들 범위로 사용합니다. APK나 전체 번들은 저장소에 포함하지 않습니다.

## 조작

- 좌우 이동: A/D, ←/→, 하단 조이스틱 드래그
- 기본 공격: Space 또는 공격 버튼
- 회피: Q/E 또는 좌우 회피 버튼 (프로토타입은 순간 위치 이동 + 회피 애니메이션)
- 스킬: 1–6 또는 아이콘. 범위·피해·회복·쿨다운은 임시 값입니다.
- AUTO: 적에게 접근해 기본 공격, 휴식: 시뮬레이션·애니메이션 정지
- 처음으로: 시뮬레이션과 리소스 정리 후 기존 시작 화면으로 복귀

## 범위와 제한

계정, 포커 칩, 원작 성장 수치와 연결하지 않습니다. 재화·경험치는 새로고침 시 초기화됩니다.
슬라임은 공격하지 않는 훈련용 대상입니다. HP는 회복 UI 테스트용입니다.
6개 아이콘과 캐릭터 스킬 애니메이션은 원작 매칭이 아닌 프로토타입용 임시 매핑입니다.
하단 성장/소지품/소환/상점은 후속 화면용 비활성 표기입니다.
맵은 텍스처를 기반으로 웹에서 재배치했습니다. 원본 Unity 맵/광원/프리팹을 그대로 재현한 것이 아닙니다.
Spine WebGL 메시를 Canvas 배경에 합성하며 Unity 전용 파티클·블렌딩·셰이더 재현은 후속 작업입니다.
Spine 런타임 버전은 4.2.120으로 고정, 원본 데이터 버전은 4.2.43입니다.
런타임 라이선스 고지는 `public/rpg/SPINE-RUNTIME-LICENSE.txt`에 보존합니다.

## 재현과 확인

```sh
python scripts/rpg/extract_assets.py '/path/to/asset bundle.zip'
node scripts/rpg/check-spine.mjs
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/rpg/test-hunt.ts
node node_modules/typescript/bin/tsc -p scripts/tsconfig.validate.json
npm run build
```

원본 추출에는 UnityPy와 Pillow가 필요합니다. 재추출 스크립트는 원본을 수정하지 않습니다.
Spine 검사는 두 스켈레톤의 모든 애니메이션과 뼈대 변환의 유한값을 검증합니다.
엔진 검사는 경계, 쿨다운, 피해·처치·보상, 재출현, 일시정지, 자동 진행을 검증합니다.
