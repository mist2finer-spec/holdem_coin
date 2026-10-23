# 로비 캐릭터 전투 에셋 1차

로비/포커 외형 9종을 현재 횡스크롤 사냥 프로토타입용으로 제작했다. 홍은 chr_7과 동일 외형이다.
외형 이름은 포커 랜덤 성향과 무관하다. 새 PNG는 built-in image_gen 생성물이며 원본 JPG는 유지한다.

| 원본 | 에셋 폴더 |
| --- | --- |
| chr_1 | boy-hoodie |
| chr_2 | white-bob |
| chr_3 | gold-dress |
| chr_4 | black-suit |
| chr_5 | longhair-man |
| chr_6 | teal-twins |
| chr_7 / 홍 | hong |
| chr_8 | pink-glasses |
| chr_9 | blonde-office |

public/rpg/characters/<id>/에는 source.png, sheet.png, 개별 frames/*.png 16장, portrait.png, manifest.json이 있다.
공통 roster.json과 prompts.json으로 외부 도구에서 식별할 수 있다.
1024×1024 RGBA 시트, 4×4 셀, 셀당 256×256, 오른쪽 방향. 발 접점은 셀의 (128,224).
0–3 대기, 4–7 이동, 8 공격 준비, 9 잽, 10 크로스, 11 킥, 12 마무리, 13 회피 준비, 14 구르기, 15 피격.
왼쪽은 런타임 수평 반전한다. 정규화 스크립트는 알파 경계 추출·동일 배율·발 접점 정렬만 수행한다.

/hunt의 캐릭터 선택에서 도끼 전사와 9종 외형을 전환한다. 기본 선택은 기존 전사다.
이미지는 선택 시 로드/캐시하며 실패하면 현재 외형을 유지한다. HP/위치/쿨다운/슬라임 상태는 유지한다.
프레임 매핑은 combat-characters.ts, 출력은 hunt-renderer.ts. 충돌/피해/회피/보상은 기존 HuntEngine 담당이다.
공격 접촉 포즈는 실제 combo.hitAt에 맞춘다. 포즈 코드가 별도의 피해 이벤트를 만들지 않는다.

이것은 래스터 포즈 프로토타입이며 신규 Spine 리깅이나 원작 모션 복원본이 아니다.
5타에 연결하되 서로 다른 접촉 포즈는 4종이며 4/5타는 마무리 포즈를 공유한다.
무기 없이 근접 공격한다. 스킬 전용 모션/사망 모션/무기 장착점/법선맵/다방향 프레임은 포함하지 않는다.
생성 프레임에는 머리카락/의상의 작은 차이가 남을 수 있다. 최종판은 픽셀 정리와 파츠 리깅으로 확장할 수 있다.

## 재현 및 검증

Pillow 필요. 생성 프롬프트는 prompts.json에 기록했다. 재생성한 원본 경로를 {id:absolutePath} JSON으로 준비한다.

```
python scripts/rpg/build_character_assets.py --inputs /path/to/inputs.json
npm ci --prefix mini-services/poker-server --include=dev
npm run test:rpg
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs --test scripts/rpg/test-character-assets.ts
npx tsc --noEmit -p tsconfig.rpg-check.json
npm run build
```

## Spine 확장 (현재 웹 사용)

현재 사냥 진입은 HuntEntry의 캐릭터 선택 → 사냥 시작 → HuntPrototype이다. 선택 화면은 rig/preview.png로 실제 리그 외형을 표시한다.
전투 출력은 래스터 포즈 시트 대신 rig/character.json + character.atlas + character.png의 18본/16파츠 Spine를 사용한다.
기존 원본 시트와 144프레임은 참고/대체용으로 보존한다. 앞의 래스터 프레임 공유 제약은 신규 리그에 적용되지 않는다.
신규 리그는 attack1..5 각각의 본 타임라인을 가진다. Unity 가져오기는 UNITY_SPINE_IMPORT.md 참조.
