# 원신 관찰 기반 Elemental VFX Lab (2026-11-11)

결과: **PASS**. Unity Play Mode에서 11종 효과와 실제 충돌을 확인했고, 자동 순환 상태로 열어 두었다.

## 실행

Unity 메뉴 `Island > Elemental VFX > Open lab`에서 `Assets/Island/Scenes/ElementalVfxLab.unity`를 열고 Play를 누른다. 기존 게임 빌드 씬과 계정 데이터를 사용하지 않는 별도 실험 장면이다.

왼쪽에서 검기 5단계, 물방울 3종, 번개 3종을 선택한다. Space는 다시 재생, 자동 순환은 전체 11종 반복이다. 속도, 일시정지, 판정 범위, 사이드뷰/쿼터뷰를 바꿀 수 있다. 표적 초기화를 끄면 물 공격의 젖음 상태에 이어 번개를 시험할 수 있다.

## 관찰과 구현의 구분

Craft Anything 0.6.0의 Deep 모드로 로그인된 Android 원신의 여행자 기본 공격과 바람 스킬을 녹화했다. 현재 설치된 게임의 로컬 리소스 블록 세 개도 읽어서 아래 프리팹 구조를 확인했다. 계정의 스킬 해금 상태를 바꾸거나 게임 실행 파일을 수정하지 않았다.

| 근거 | 확인한 내용 | Island 적용 |
| --- | --- | --- |
| `Eff_Avatar_Boy_Sword_PlayerBoy_NormalAttack_01`~`05` | 각각 ParticleSystem 4개, BladeTrail / BladeTrailLine / BladeTrailLight / Distortion 자식 | 서로 다른 경사의 5단 검격, 밝은 코어·가느다란 선·넓은 잔상·화면 왜곡 |
| `Eff_Avatar_Girl_Catalyst_Kokomi_NormalAttack_01_Cast` | 시전 프리팹과 입자 계층 | 물 시전 준비 자세와 원형 예고 |
| `Eff_Monster_Abyss_Water_Bubble_Missle` | BubbleBig / Splash / Decal_Aura / Greaten / Bubble 계층 | 물방울 구체·꼬리·충돌 물보라·바닥 파문 |
| `Eff_Skill_Lightning_V6_7`, `Eff_Element_Conduct_Lightning` | 번개와 전도 효과의 프리팹 루트 | 단일 낙뢰·연쇄·다중 소환의 독립 구현 |

원신의 수정된 ParticleSystem/Material 직렬화 형식은 표준 타입 트리로 끝까지 읽히지 않았다. 원본 입자 곡선, 셰이더, 피해 공식, 충돌 계수를 복원했다는 의미가 아니다. 이 실험의 메시·셰이더·효과음·판정 코드와 수치는 Island용으로 작성했다. 원신 리소스 블록과 계정 화면은 로컬 연구 폴더에만 보관한다.

대표 Craft 증거:

- 실제 공격 관찰: `ev_e80f94e17cd7119e5af31b4a9d6a89eb4bdddc818e1fa4572d0e1627a1b72f3d`
- 검격 1단: `ev_0082386eb7d5b0bb03555b170514b37e19bbc3a581f0b6c4168459da5221f923`
- 검격 5단: `ev_a15ae619fcd18994a3ce772b8be690d5aa536ad8c5162b870404d4394f4f6ee8`
- 물방울: `ev_2b5f5de9e3a8f3a6c96b4fe8ff8ce44e2360e622b3ca10171e40f1d0789ef71b`
- 번개: `ev_5830d9b937c6fe17aec6621bd7822b53d8cd2b056423a8a3ffa34fd25d53a87d`

조사 프로젝트와 영상: `G:/holdem_coin-workspace/island/maintenance/elemental-vfx-20261111/investigation.cany`, 같은 폴더의 `evidence/source-attacks.mp4`, `evidence/source-effects.json`.

## 물리와 판정

독립적인 Unity PhysicsScene을 20ms 간격으로 시뮬레이션한다. 전역 Time.timeScale, 기본 물리 장면, 게임 충돌 매트릭스를 바꾸지 않는다.

- 검기: 표시 궤적과 같은 식을 사용하는 캡슐 중첩 검사. 한 틱의 이동 각도를 3도 이하로 나누어 빠른 검격의 누락을 줄인다. 범위에 들어온 여러 표적을 각각 한 번씩 타격한다.
- 물: 8발 원형, 두 번의 6발 파동, 16발 순차 발사. 초기 중첩 검사 후 이동 거리 전체에 SphereCast를 한다. 가장 가까운 충돌부터 처리하고 12cm 벽에서 한 번 반사한다. 중력과 수명으로 종료한다.
- 번개: 시전할 때 고정한 바닥 위치에 예고 후 낙뢰가 떨어진다. 피할 수 있으며 지붕과 벽 차단을 검사한다. 연쇄는 가까운 미타격 대상, 뇌우는 중앙과 네 주변 지점을 사용한다.
- 표적: 실제 Rigidbody와 복합 Collider. 공격 한 번당 표적 소유자 기준으로 중복 피해를 막는다. 넉백은 Impulse이고, 물의 젖음 4초 후 번개 피해 25% 증가는 실험용 규칙이다.
- 반복 재생: 물방울·검기·번개·파문·입자 풀의 크기를 고정한다. 재생 속도와 일시정지는 물리와 효과에 같은 시계를 적용한다.

SphereCast가 시작 시 이미 겹친 Collider를 검출하지 않는 경계는 별도 중첩 검사로 처리했다. [Unity SphereCast 문서](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Physics.SphereCast.html).

## 검증

`IslandGame.Editor.ElementalVfxLabTools.Verify(outputDirectory)`의 실제 Play Mode 검사 **60/60 통과**. [물리 결과](evidence/elemental-vfx-20261111/physics-validation.json)에 각 검사와 명중·피해·변위·충격량을 기록했다. 11종 각각 명중, 복합 콜라이더 중복 타격 방지, 범위 밖 제외, Rigidbody 이동을 확인했다. 초속 80m 물방울의 12cm 벽 충돌, 물방울 벽 차단, 검격 벽 차단, 지붕의 낙뢰 차단, 시전 위치 회피, 젖음 배율, 일시정지, 30/100 FPS 입력 간 명중 집합 일치, 물방울 만료도 통과했다.

[실제 자동 재생 결과](evidence/elemental-vfx-20261111/autoplay-validation.json): 65.001초 동안 11종 모두 순환, 12,106 프레임 진행. 장면 Transform 368개와 ParticleSystem 16개가 반복 재생 전후 일정했다. 이는 이 실험 장면의 실행 기록이며 모바일 성능 측정은 아니다. 최종 확인 시 컴파일 실패 false, Unity Console 오류 0개였다. 이전 실행 기록에는 기존 Spine 경고와 수정 전 진단 오류가 남아 있다.

후속 확인에서 Play 중 스크립트 재로드가 PhysicsScene 핸들을 무효화하는 문제가 재현됐다. 실험실이 실제 실행 중이었을 때만 재로드 후 Play를 재시작하며, 복구 전 틱은 유효한 물리 장면인지 검사한다. 번들 폰트는 해제 대상에서 제외하고 임시 폰트만 정리한다. `EditorUtility.RequestScriptReload`로 실제 재로드를 걸고 자동 재개와 물리 60개 검사를 다시 통과했다. [재로드 결과](evidence/elemental-vfx-20261111/reload-validation.json). 현재 뷰어의 목표 프레임은 60이며 종료 시 이전 값을 복구한다.

화면으로 검격의 방향·코어·잔상, 물 구체·꼬리·파문, 번개의 분기·연쇄·착지 파문, 시전 자세와 한글 조작부를 확인했다. 쿼터뷰와 사이드뷰 모두 캡처했다. 카메라 HDR과 layer 29 Volume의 Bloom(threshold 1, intensity .35, scatter .45)을 확인했다. 효과음은 독립 합성 큐와 AudioListener를 연결했으며 청취 평가는 수행하지 않았다.

- [검격 5단](evidence/elemental-vfx-20261111/sword-5.png)
- [원형 물방울](evidence/elemental-vfx-20261111/water-3.png)
- [번개 소환](evidence/elemental-vfx-20261111/lightning-3.png)
- [사이드뷰](evidence/elemental-vfx-20261111/water-side.png)

검토용 시각 평가(주관적): 효과 종류 구별 4/5, 시전·피격 피드백 4/5, 쿼터뷰 판독성 4/5, 원본 재현 정밀도 2/5. 단순한 표적과 바닥을 사용하는 효과 실험실이다. 원신과의 일치율이나 완성된 게임 아트 품질을 측정한 결과가 아니다.

## 이동 경로 문제와 실행 도구

이 G: exFAT 볼륨에서 Unity 내부 프로젝트 경로는 `Island`, Roslyn 소스 경로는 `island`로 생성됐다. 컴파일은 성공해도 MonoScript.GetClass가 null이 되는 현상을 실제로 확인했다. 기존 IslandApp 연결도 함께 검사했다. 전체 Library 대신 Bee/ScriptMapper만 작업 폴더에 보관하고 다시 생성했으며, 생성된 `*.UnityAdditionalFile.txt`의 프로젝트 경로 대소문자를 맞춘 뒤 두 클래스 연결이 복구됐다.

`G:/holdem_coin-workspace/island/Open-Unity.ps1`은 이제 [경로 보정 도구](../../scripts/unity/watch-generated-path-case.py)를 숨김 실행한다. 해당 도구는 이 프로젝트와 대소문자만 다른 생성 경로만 수정하고, 원본 코드·장면·Unity DLL·작업 디렉터리는 변경하지 않는다. 같은 길이의 바이트만 덮어쓰며, 중복 실행은 잠금으로 막고 Editor 종료 시 끝난다. 같은 프로젝트 보정·다른 프로젝트 무변경 검사를 통과했다. 이 머신에서는 재실행할 때 해당 시작 스크립트를 사용한다. Unity 버전/파일시스템 변경 후 이 우회가 불필요한지 재확인할 수 있다.

Craft의 오래된 BlueStacks ADB 대신 설치된 Unity Android SDK의 ADB를 연결해 로컬 자료와 로그인된 원신을 읽었다. 조사 보고서는 로컬 `evidence/craft-study-report.html`, 증거 묶음은 `evidence/craft-evidence-bundle.json`(15개 기록, 미해결 질문 1개)에 보관했다.

이번 장면은 검토용이며 실제 RPG 장비/스킬 전투 경로에는 아직 연결하지 않았다. 기존 일반 10구역 Side25D / 보스 QuarterView 규칙과 이전 APK는 유지한다.

이번 효과 실험실로 새 APK를 만들거나 운영 서버를 배포하지 않았다. 기존 `.agents/`와 패키지 재시작 중 생긴 NuGet Unsafe DLL의 Editor import 메타 변경은 이 작업 커밋에 포함하지 않았다.
