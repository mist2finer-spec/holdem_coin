# Unite Seoul 2026 최적화 자료 — 사용자 제공 6개 주제와 프로젝트 적용 메모

2026-11-09. 사용자가 다시 제공한 **완전한 1~6번 설명**을 토대로 정리했다. 원문을 그대로 옮긴 자막/전사본은 아니다. 사용자 설명의 발표자·행사명·타임코드·데모 수치는 제공 자료의 주장으로 구분한다. [영상 링크](https://www.youtube.com/watch?v=TvOX5jsKJmI)를 열어 원본 자막/전체 발언을 독립적으로 확인하지 못했으므로 영상 시청·실측 검증 완료로 표시하지 않는다. 엔진 적용 판단은 로컬 소스와 아래 Unity 공식 문서로 보완했다.

현재 적용 결정은 [성능 구조 인계](../PERFORMANCE_ARCHITECTURE_20261109_KO.md), 제작 제출은 [에셋 계약](../assets/PERFORMANCE_ASSET_CONTRACT_KO.md)을 따른다. 새 엔진 기능을 현재6.0 프로젝트에 이미 설치한 것처럼 해석하지 않는다.

## 1. Draw Call·SetPass·Dynamic Batching

사용자 자료 [02:39~06:41](https://www.youtube.com/watch?v=TvOX5jsKJmI&t=159): 스프라이트도 메시/텍스처로 그리며 CPU draw 제출과 상태 설정에 비용이 든다. Dynamic Batching은 CPU에서 정점 변환·배치 구성을 수행하므로 draw 감소 이익보다 CPU 비용이 커질 수 있다. Frame Debugger로 배치가 깨지는 원인을 조사한다.

적용: current SRP ON/Dynamic OFF를 기준선으로 유지한다. Draw Call, SetPass, CPU Render Thread, GPU ms를 함께 본다. **SetPass를 모든 텍스처·트랜스폼·render-target 변경과 일대일 대응하는 값으로 쓰지 않는다.** 같은 재질이어도 패스·그림자·카메라·소팅 조건이 달라지면 추가 작업이 있다. 메시를 무조건 하나로 합치지 말고 visibility/streaming cell을 유지한다. [SRP 원리](https://docs.unity3d.com/6000.0/Documentation/Manual/SRPBatcher.html), [Frame Debugger](https://docs.unity3d.com/6000.0/Documentation/Manual/FrameDebugger.html).

## 2. SRP Batcher·2D/3D 혼합·신규 기능

사용자 자료 [07:47~13:41](https://www.youtube.com/watch?v=TvOX5jsKJmI&t=467): SRP Batcher는 메시 합치기보다 드로 사이 CPU 설정 비용 절감이 목적. Happy Harvest/Tab S7 예시로 draw524→765, SetPass517→300, render loop23→14ms가 제시됐다. 이 숫자는 **이 게임의 측정값이나 예상 개선율이 아니다.** 서로 다른 lit/unlit, shader variant, texture/atlas, sorting과 투명 순서가 배치에 영향을 준다. 사용자 설명에는6.3 Sort 3D as 2D, Mesh 2D 셰이더와2D 정렬/라이팅/마스킹, 해당 경로의 SRP 제약이 포함된다.

적용: 현재6.0/URP17 Forward의3D 캐릭터 경로에는2D Renderer 전용 기능을 직접 적용하지 않는다. SRP Batcher의 constant buffer 최적화는 같은 variant에서 다른 재질도 도울 수 있지만 **모든 SetPass가0이 되는 보장**은 아니다. MPB를 사용하는 현재 피격 flash는 SRP 호환성을 별도 캡처한다. 버전 업그레이드·Mesh2D shader 호환성은 해당 패키지 버전에서 확인하고 별도 마이그레이션으로 다룬다. [공식 호환 조건](https://docs.unity3d.com/6000.0/Documentation/Manual/SRPBatcher-Materials.html), [6.3 Sort 3D as 2D 관련 릴리스 기록](https://unity.com/releases/editor/beta/6000.3.0b9).

## 3. 라이팅·그림자·픽셀 비용

사용자 자료 [15:22~19:02](https://www.youtube.com/watch?v=TvOX5jsKJmI&t=922): URP2D는 light buffer를 만들고 sprite와 합성한다. 라이트 타깃 sorting layer, blend style, shadow caster 조합이 일치해야 같은 light batch가 될 수 있다. 2D Light Batching Debugger로 조합을 확인하고, 거대한 light·그림자·render scale의 픽셀 비용을 줄인다. 첨언은 모바일 tile-based GPU의 render-target/메모리 대역폭 비용과 장식 발광의 additive 대체를 제안한다.

적용: 현재 프로젝트는3D 주광·추가광·shadow·후처리 비용을 먼저 측정한다. 2D 전용 debugger로 현재3D 비용을 분석했다고 보고하지 않는다. **TBDR라는 한 분류로 모든 모바일 GPU의 세부 동작을 같다고 보지 않는다.** Additive 연기/불꽃도 overdraw·blend·화면 점유 비용이 있으므로 실제 light 대체의 이익은 전후 GPU 측정으로 판정한다. Render Scale/lighting buffer scale은 해당 renderer에서 적용되는 값인지 확인한다.

## 4. 텍스처 압축·메모리

사용자 자료 [20:10~22:38](https://www.youtube.com/watch?v=TvOX5jsKJmI&t=1210): 모바일의 공유 메모리와 OOM 위험, PNG/JPG 등 원본 파일 압축과 GPU 포맷의 차이, ASTC의 블록 크기 선택, BC/DXT 미지원 기기에서 해제되는 위험을 다룬다. 제안 시작점은 UI/주인공4×4 또는5×5, 일반 배경/몬스터6×6, 부드러운 FX8×8 이상이다.

적용 시 조건:

- 원본 확장자보다 **최종 크기·채널·GPU 포맷·mip·Readable·실제 사용 경로**를 본다. 동일한 최종 픽셀/설정일 때의 논리이며 손실 JPG와 원본 PNG의 화질까지 같다는 뜻은 아니다.
- 지원하는 Android 기기에는 ASTC LDR을 우선 검토하되 미지원 기기·API·HDR 포맷 차이를 확인한다. 범용 경로는 ETC2 등 검토. 단일 APK와 AAB texture targeting의 전달 방식도 다르다. 모든 모바일이 BC를 지원하지 않는다는 식의 단정 대신 **이번 대상 GPU에서 지원 확인 없는 BC/DXT를 기본 배포하지 않는다**는 기준을 쓴다.
- FX8×8·12×12는 자동 승인값이 아니다. 얇은 선, alpha edge, 부드러운 그라데이션, 작은 글자·normal map은 별도로 비교한다. 무압축 예외는 이유와 실제 bytes를 기록한다.
- Read/Write CPU 복사가 필요한 에셋과 GPU-only 에셋을 구분한다. Crunch/ZIP/APK 크기 감소를 GPU 메모리 감소로 대체하지 않는다.
- 이 프로젝트에서는 WebAssets162개의 비압축 일괄 importer와 Readable Cubemap10개의 서로 다른 생성 경로를 각각 정리해야 한다.

[플랫폼별 포맷 선택](https://docs.unity3d.com/kr/6000.0/Manual/texture-choose-format-by-platform.html), [GPU 포맷 레퍼런스](https://docs.unity3d.com/kr/6000.0/Manual/texture-formats-reference.html), [Android 전달/압축 설정](https://docs.unity3d.com/cn/6000.0/ScriptReference/PlayerSettings.Android-textureCompressionFormats.html).

## 5. Sprite Atlas·수명·런타임 패킹

사용자 자료 [23:35~33:41](https://www.youtube.com/watch?v=TvOX5jsKJmI&t=1415): texture 공유/패킹, Editor와 기기 메모리 차이, Atlas V2, UI/캐릭터의 수명별 그룹, 페이지 분할과 과도한8K atlas, late binding/variants, 원본과 atlas 압축의 이중 열화 우려를 다룬다.6.3 Sprite Atlas Analyzer,6.4 Runtime Sprite Atlas, 로딩 시점의 패킹도 소개됐다고 설명한다.

적용: 전투HUD·소지품·성장·로비·FX를 사용 수명과 shader/blend 조합으로 분리한다. 현재 HUD의 Default texture+Sprite.Create 방식은 SpriteAtlas 참조 로더로 먼저 전환해야 한다. Spine atlas와 Unity SpriteAtlas는 서로 다른 경로다. 같은 atlas여도 서로 다른 material/pass/mask/sorting/Canvas로 draw가 나뉠 수 있어 **무조건1 draw 보장**을 하지 않는다. 3D skinned 장비는 mesh/submesh/material/UV의 문제도 따로 있다.

원본을 모두None으로 바꾸는 전역 규칙은 만들지 않는다. **atlas 전용 source, atlas 밖에서도 읽는 source, 런타임 생성/패킹 texture**를 먼저 나누고 실제 Unity 버전의 packing 결과와 단독 원본 중복 상주·화질을 검사한다. 이 프로젝트는 이미 단독 WebAssets가 모두None이므로 그대로 두면 압축 최적화가 되지 않는다. Atlas의 최종 Android 압축과 예외 정책을 한 곳에서 소유한다.

새 Analyzer/Runtime Atlas의 정확한 패키지·메뉴·호환 버전은 이번 조사에서 검증하지 않았다. 현재6.0 구현의 선행 의존성으로 넣지 않는다. 기존6.0에서도 static atlas/variants/manual loading 설계는 가능하다. 런타임 패킹은 CPU 시간·GPU upload·원본+목적지 임시 메모리를 측정하며, 필요성이 확인될 때 별도 작업한다. [현재6.0 Atlas 문서](https://docs.unity3d.com/6000.0/Documentation/Manual/sprite/atlas/atlas-landing.html).

## 6. 애니메이션·리그·샘플링

사용자 자료 [35:52~37:32](https://www.youtube.com/watch?v=TvOX5jsKJmI&t=2152): flipbook의 텍스처 메모리와 skeletal의 본/변형 연산을 비교한다. Burst, bone/vertex 수 절감, 주인공·보스 skeletal/대량 잔몹 flipbook/환경 vertex shader 혼합을 제안한다. 관절 주변에만 tessellation, 강체 파츠 단순화, 화면 밖 업데이트 중지, 원거리20~30Hz도 제시됐다.

적용: SpriteSkin/Burst deformation, Spine의 mesh 업데이트, 현재 **3D SkinnedMeshRenderer + 수동 PlayableGraph**는 같은 실행 경로가 아니다. 현재GPU skinning 설정ON과 Burst 전이 패키지가 있어도 CPU graph/bone 계산까지 무료가 되지 않는다. 반대로 모든3D 스키닝이 CPU BakeMesh라고 일반화하지 않는다. 실제 CPU/GPU marker로 분리한다.

현 RuntimeAnimationPlayer는 AlwaysAnimate와 명시적인 graph.Evaluate를 사용하고, 호출부가 이미 일반 적의 컬링/샘플링을 제어한다. Animator cullingMode만 바꾸는 수정을 해법으로 단정하지 않는다. 원거리 비필수 포즈만 Hz를 낮추고 주인공·보스·피격/공격 접촉을 우선 처리한다. 작은 슬라임을 flipbook으로 교체하는 것은 기존 룩·쿼터뷰·그림자·방향·피격체와 메모리까지 비교해야 하는 별도 미술/구조 결정이다.

풀은 현재처럼 vertex 바람·눌림을 사용하고 개체마다 본/Animator를 추가하지 않는다. 캐릭터의 본/클립/검 길이가 바뀌면 서버 접촉 profile과 실제234포즈 대조를 다시 수행한다.

## 공통 원칙

사용자가 강조한 [38:16 측정 후 수정](https://www.youtube.com/watch?v=TvOX5jsKJmI&t=2296)을 작업 절차로 채택한다. 측정 전 가설, 변경1개, 동일 조건 A/B, 실기 지속 부하, 원시 capture·코드 해시, 실패 시 원복 기준을 남긴다. 영상의 데모 수치나 다른2D 프로젝트의 개선율을 이 게임의 승인된 예산으로 사용하지 않는다.
