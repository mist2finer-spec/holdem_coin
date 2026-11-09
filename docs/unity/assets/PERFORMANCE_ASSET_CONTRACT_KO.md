# 에셋·이펙트 제작 성능 계약

2026-11-09. [현재 구조와 후속 구현 순서](../PERFORMANCE_ARCHITECTURE_20261109_KO.md)를 먼저 읽는다. 이 문서는 신규 제작/반입 때 사용할 기준이며 현재 모든 자산이 이 기준을 통과했다는 뜻이 아니다. 사용자 원본 PDF·팔레트·제작 보류/미술 승인 절차는 [기존 에셋 통합 인계](video-style/ASSET_AGENT_HANDOFF_20261109_KO.md)를 유지한다.

## 1. 모델을 만들기 전에 정할 것

| 항목 | 제출할 결정 |
|---|---|
| 보이는 거리/크기 | 측면 일반 구역 또는 쿼터뷰 보스, 화면에서 차지하는 크기, 가장 가까운 카메라 거리 |
| 사용 수명 | 상시/전투HUD/화면별/구역별/보스전/일시 효과, 함께 로드될 자산 목록 |
| 반복 배치 | 한 화면·한 구역·preload 구역까지 최대 수, 같은 mesh/material 재사용 여부 |
| 분리 단위 | 움직이거나 교체하거나 상호작용하는 파츠만 분리. 정적 기둥/매듭까지 개별 Renderer로 두지 않음 |
| 충돌 | 단순 proxy와 실제 높이/반경, 점프 통과·착지 공간. 장식 mesh 전체 MeshCollider 기본 금지 |
| 품질 단계 | silhouette 유지 LOD, 저품질 shadow/normal/장식 대체, 필수 gameplay 표시 |

기존 시작값을 우선한다: 천막 프레임400~800tris, 천300~700, 화로1200~2500, 작업대500~1000, 상자150~400. LOD1 약45%/LOD2 약15%, 재질1~2개·texture≤1024를 **제작 시작 가이드**로 사용한다. 강제 전역 상한이나 S20 승인 수치가 아니다. 주인공·보스는 기존 자산을 유지하며 새로운 정점/본 상한은 실기 기준선 후 정한다. 같은 재질이어도 submesh 수만큼 패스가 늘 수 있다.

## 2. 메시·재질·리그

- 반복 소품은 sharedMesh/sharedMaterial, 셀 단위 instancing 또는 static 결합 후보로 제작한다. 각 인스턴스에 독립 material/texture를 복사하지 않는다. 같은 재질·variant로 묶되 그림자/투명/소팅을 실제 Frame Debugger로 확인한다.
- LOD는 silhouette와 UV/pivot/뿌리 위치를 유지한다. 먼 소품·풀에는 shadow를 기본 제공하지 않고 필요성을 검토한다. 맵 전체 결합으로 부분 컬링/해제를 잃지 않는다.
- 리그는 실제 필요한 bone만, deformation 관절 주변에 정점 집중, skin weight 수/vertex와 skinned mesh/submesh 수를 기록한다. 본/UV/normal을 함부로 제거해 승인된 외형을 깨뜨리지 않는다.
- 플레이어1.30m·슬라임.31m, 공격 원본 클립·루트·검 길이를 변경하면 기존 접촉 계약과 함께 재검토한다. 시각 LOD가 서버 피격체를 바꾸지 않는다.
- 풀에는 Animator를 넣지 않는다. 고정 배치 seed와 작은 공용 near/far mesh, shader 바람/눌림, 셀 bounds 최대 변위, batch 분할 조건을 제출한다.

## 3. 텍스처·아틀라스

| 용도 | Android 시작 후보 | 반드시 확인 |
|---|---|---|
| UI/선명한 아이콘/주인공 중요 부분 | ASTC4×4 또는5×5 | 작은 글자·얇은 선·alpha 경계. 무압축 예외는 크기/이유 기록 |
| 일반 프롭/지면/몬스터 | ASTC6×6 | 실제 화면에서 미세 패턴·normal 품질,3D mip 필요성 |
| 부드러운 FX/마스크 | ASTC6×6 또는8×8 비교 | 그라데이션 밴딩·알파 떨림.8×8이 항상 무손실이라는 가정 금지 |
| 데이터/lookup/정밀 mask | 용도별 | sRGB/linear·채널 의미·압축으로 인한 판정/셰이더 오차 |
| baked Cubemap | 별도 bake/import 경로 | face 해상도·mip·Android format·Readable CPU 복사 |

포맷은 대상 기기 지원을 확인한다. ASTC 미지원 대상에는 ETC2 등 대안을 정한다. 원본 PNG/JPG 확장자를 바꾸는 것을 GPU 최적화로 보고하지 않는다. 2048² RGBA32는 mip 전16MiB, ASTC4×4는4MiB,6×6은약1.78MiB다. 이는 수학적 base-level 크기 예시이고 alignment/mip/CPU복사/중복 상주/RT는 별도다.

Read/Write는 CPU 접근이 꼭 필요한 자산만 켠다. mip은 작아지는3D 텍스처에서 검토하고 고정 UI는 별도 정책을 사용한다. Clamp/Repeat도 용도로 나눈다. 새 preset은 **현재 WebAssets의 비압축 강제 AssetPostprocessor와 충돌하지 않게** 구현해야 한다.

Atlas 그룹은 전투HUD·로비·성장·인벤토리·구역FX 등 함께 쓰고 해제하는 수명으로 나눈다. 우선1024/2048페이지로 시험하고,4096 이상은 픽셀 근거와 peak 메모리를 검토한다. 모든 콘텐츠를8K 한 장에 넣지 않는다. 페이지별 실제 압축 크기와 낭비 공간을 제출한다. atlas 전용 source와 단독 사용 source를 구분하고, 원본None/atlas압축 설정을 일괄 적용하지 않는다. 현재 Sprite.Create 로더의 전환과 소유권 정리가 선행된다.

## 4. 이펙트 제출 규칙

P0 필수 위험/피격 표시, P1 주요 스킬 강조, P2 장식으로 분류한다. 각 effect에 max concurrent, particles/emitter·총합, 최대 수명, bounds, 화면 점유 비율, 겹침 최악 장면, material/texture/pass, shadow/light/distortion/depth 필요 여부, sound voice 수, pool 보관 bytes를 기록한다.

- 일반 화면·최악 겹침·저품질 대체의 캡처3개를 제출한다. 같은 particle 수여도 큰 반투명 쿼드가 여러 겹이면 반려될 수 있다.
- spawn 때 Resources.Load/Instantiate/Material 생성/큰 배열 할당을 반복하는 템플릿을 기본값으로 만들지 않는다. 로딩 단계에 분할 prewarm, bounded pool, 반납 reset을 제공한다.
- pool 고갈 시 P2 생략→P1 경량화. P0는 미리 예약한 저비용 경고/flash fallback을 사용한다. 삭제/병합 가능한 것은 장식 표현이며 실제 damage 이벤트가 아니다.
- 원샷은 stop 후 회수, loop는 owner/zone 종료 시 회수, 재사용 시 callback·particle·trail·audio·MPB·참조를 초기화한다. 자식 SubEmitter를 포함한 총량을 계산한다.
- 장식광·연기·Bloom·왜곡은 켬/끔 GPU 시간을 따로 비교한다. 플레이어 몸통·검·적·경고를 가리는 효과는 성능 통과와 별개로 미술 검토에서 조정한다.

## 5. 에셋 한 건의 제출 양식

```yaml
assetId: T01_tent_frame_v01
status: review_only
owner: art
source: 원본 경로와 라이선스/제작 근거
contentHash: SHA256
role: zone_static
views: [side]
lifetimeGroup: village_zone
sharedKeys: [tent_mesh, cloth_material]
maxVisible: 미정_대표화면에서기록
maxResidentIncludingPreload: 미정
geometry:
  lodTriangles: [미정, 미정, 미정]
  renderers: 미정
  submeshes: 미정
  bones: 0
textures:
  - size: 미정
    androidFormat: 검토후기록
    mipmaps: 검토후기록
    readable: false
    residentBytes: 실기에서기록
collisionProxy: 경로_또는_none
qualityFallback: 설명
poolPolicy: 사용여부_개수_bytes_TTL
vfxPriority: 해당없음
captures: [정상, 최악, 저품질]
validation: UNAVAILABLE_제작전
```

이 양식은 설계 문서이며 현재 게임이 읽는 schema가 아니다. `미정`을 숫자로 채우고 manifest 검사를 구현하기 전에는 자산을 자동 승인하지 않는다.

## 6. 반입 승인 순서

검토 폴더 원본 보존 → 스케일/UV/normal/재질 슬롯/충돌 정리 → 대표 구역에 같은 seed로 배치 → 같은 폰/해상도/카메라에서 A/B → CPU/GPU/메모리·반복 해제 검사 → 사용자 미술 검토 → 정식 콘텐츠 반영. 풀링·압축·LOD를 적용했다는 사실만으로 통과시키지 않는다. 실패 시 이전 승인 자산/설정으로 되돌릴 수 있도록 원본·변환 설정·해시·증거를 보관한다.
