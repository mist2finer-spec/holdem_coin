# Island 전투 캐릭터: Unity / Spine 4.2

9종을 위한 **18본·16 Region 파츠**의 실제 관절형 리그다. 완성 포즈를 교체하는 애니메이션이 아니다.
신규 파츠는 기존 캐릭터를 참고해 image_gen으로 생성했다. 공통 본 계층과 키프레임 모션은 코드로 작성했다.
`.spine` 편집기 프로젝트를 생성했다고 주장하지 않는다. 아래는 Spine JSON 가져오기/런타임 배포용 구성이다.

## 가져오기

1. 프로젝트에 공식 **spine-unity 4.2**를 설치한다. 이 4.2 데이터는 4.3 런타임과 혼용하지 않는다.
   공식 설치 안내: https://esotericsoftware.com/spine-unity-installation
2. ZIP의 Assets/IslandCombat을 Unity 프로젝트의 Assets 아래에 복사한다.
3. 각 Characters/<id>/의 character.json, character.atlas.txt, character.png가 함께 있어야 한다.
   Spine importer에서 AtlasAsset / SkeletonDataAsset을 생성한다. 필요 시 JSON을 재임포트하고 해당 폴더의 AtlasAsset을 연결한다.
4. 데이터는 **straight alpha** PNG다. Texture의 Alpha Is Transparency와 material의 Straight Alpha Texture 옵션을 맞추고,
   PMA 워크플로와 혼용하지 않는다. Texture 압축/필터/색공간에 따라 가장자리가 달라질 수 있으므로 대상 플랫폼에서 확인한다.
5. SkeletonDataAsset Scale은 시작값 0.01을 권장한다. 장면의 충돌/거리 단위에 맞게 프로젝트에서 결정한다.
6. SkeletonDataAsset을 씬에 끌어 SkeletonAnimation을 만든다. IslandSpineCharacter를 붙이고 해당 컴포넌트를 연결한다.
7. SetLocomotion(방향), PlayAttack(1..5), PlayAction("avoid1") 등을 기존 전투 컨트롤러에서 호출한다.

공식 에셋 안내: https://esotericsoftware.com/spine-unity-assets
공식 FAQ (.atlas.txt): https://esotericsoftware.com/spine-unity-faq

## 클립 및 타격 권한

stay1 / run1 / dash / avoid1 / attack1..5 / skill1..4 / skill5 / skill5_loop / skill5_end / rest1 / damage1 / die1.
5개 공격 모두 별도 키프레임과 실제 combo.hitAt에 맞춘 contact(int=1..5) 이벤트를 가진다.
Unity 어댑터의 Contact는 이벤트를 전달할 뿐 HP를 변경하지 않는다. 연결하는 전투 컨트롤러가 중복 적용 방지·거리·대상 확인을 담당한다.
웹에서는 이 이벤트를 피해에 구독하지 않는다. 기존 HuntEngine의 예약 타격이 유일한 피해 경로다.
외형별 스탯·충돌 반경·경제·포커 로직은 변경하지 않았다.

## 편집과 범위

원본 파츠 및 재현 스크립트는 저장소 public/rpg/characters/<id>/rig/parts/와 scripts/rpg/build_spine_characters.py에 있다.
Spine 편집기에서는 JSON 데이터 가져오기 후 parts 이미지를 연결해 편집할 수 있다.
현재 Region attachment 기반 컷아웃 리그이며 weighted mesh, IK, 천/머리카락 물리 시뮬레이션은 포함하지 않는다.
원작의 모션을 복원한 것이 아니라 프로젝트용 공통 안무다. 파츠 관절의 미세한 접합과 의상 겹침은 후속 아트 다듬기 대상이다.
Spine 런타임은 ZIP에 재배포하지 않는다. 공식 런타임 사용에는 Esoteric Software의 라이선스 조건을 적용한다.
이 환경에는 Unity Editor가 없어 실제 Unity import/playmode 검증은 수행하지 못했다.
검증 범위는 Spine 4.2 JS 런타임 로드·모든 클립/좌표/바닥/접촉 타이밍, 웹 빌드 및 브라우저 흐름이다.

## ZIP 재생성

```
python scripts/rpg/export_spine_unity.py --output /path/to/IslandCombat-Spine42.zip
```
