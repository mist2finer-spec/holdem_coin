# 영상 기반 원경·전투 테스트 (2026-11-11)

프로젝트: `unity/IslandGame`, 브랜치 `codex/genshin-environment-20261110`.
참조: 사용자 제공 `G:/vfx_and_map_ref/ref_video.mp4`, 마을/다리/능선 비교 이미지.

## 적용

- 일반 10구역 Side25D, 기존 보스 구역 QuarterView를 유지한다. 영상의 새 보스전은 구현하지 않았다.
- 페인터리 산맥·숲·계곡 파노라마를 지형 뒤에 배치하고 낮은 패럴랙스를 적용한다. 기존 가까운 지형, 잔디, 나무와 충돌 데이터는 유지한다. 강 위 다리와 강변 구역에 월드 좌표 흐름, 깊이별 물색, 교차 물거품을 사용한 URP 수면을 추가했다.
- 일반 구역은 6마리 팩, 최대 생존 12마리, 3개 깊이 줄이다. 길 폭 안에서 분산하고 일반 캐릭터의 이동 경로는 그대로 유지한다. 구역당 30마리도 동일하다.
- 자동 이동 중 적까지 1.85~5.2m일 때만 0.34초 접근 대시를 사용한다. 재사용 대기는 2.6초이며, 몸체/장애물 충돌 검사를 통과한 만큼만 이동한다. 기존 Genshin-study 달리기와 `sword_dash` 클립을 사용한다.
- 일반 검격은 원래 검날 접촉과 눈에 보이는 낮은 부채꼴 검기를 함께 검사한다. 공격 ID별로 범위에 들어온 모든 적을 한 번씩 타격한다.
- `cleave`(쪼개기): 금빛 내려찍기/충격파, 기존 heavy 동작의 첫 구간, 피해 150, 마나 50, 재사용 4초.
- `stormcall`(폭풍 부름): 낙뢰/전기 충격파, 기존 spell 자세, 피해 180, 마나 65, 재사용 6초. 두 스킬 모두 시전 시작 때 지면 목표를 고정하고 2.4m 원형 범위를 사용한다. 가까운 적에게 자동 조준하며 쿼터뷰 깊이 좌표도 포함한다.
- 이펙트는 12개 풀과 각 48개 이하 입자로 제한한다. 보스 패턴과 영구 재화/계정 저장 코드는 변경하지 않는다.

## 테스트 진입

Development APK의 로비에서 **영상 전투 연습 · 쪼개기 / 폭풍 부름**을 누른다. 서버 접속 없이 4구역부터 기존 경로를 진행한다. 1/2번에 임시 에르텔을 장착한 무보상 연습이며 계정 장비를 덮어쓰지 않는다. 일반 사냥에서는 실제 장착한 젬을 사용하며, 제거한 젬은 비활성 상태를 유지한다.

Editor 검수: `IslandGame.Editor.ReferenceCombatReview.Begin(zone, scenario, outputDirectory)`. `bridge`, `pack`, `dash`, `cleave`, `storm`, `quarter-storm`을 지원한다. 쿼터뷰 검수는 기존 보스 맵만 사용한다.

빌드: Play Mode를 종료하고 `IslandGame.Editor.ReferenceCombatBuild.Queue()` 실행. 11개 씬을 검사하고 원래 버전 설정을 복원한다. 산출물은 `G:/holdem_coin-workspace/island/builds/IslandGame-ReferenceCombat-20261111.apk`.

## 출처와 도구

- [MatrixRex/Uber-Stylized-Water](https://github.com/MatrixRex/Uber-Stylized-Water), 검토 커밋 `1fdd16c6312611fef7fb248dee86cdd3fd456a1e`. 월드 UV 흐름·깊이별 색·교차 물거품 기능을 참고했다. 본 프로젝트의 `ReferenceRiver.shader`는 이 테스트용으로 작성한 작은 URP 셰이더이며 원본 전체 패키지 설치본이라고 주장하지 않는다.
- [IvanMurzak Unity MCP](https://github.com/ivanmurzak/unity-mcp) 1.10.0, [Unity AI ParticleSystem](https://github.com/IvanMurzak/Unity-AI-ParticleSystem) 2.1.1을 OpenUPM으로 설치했다. 런타임 이펙트는 Unity ParticleSystem과 메쉬/라인 풀을 사용한다. 인증 토큰이 든 로컬 설정은 Git에 포함하지 않는다.
- `Assets/Island/Resources/ReferencePanorama.png`는 내장 imagegen으로 생성한 프로젝트용 이미지이다. 사용자 참조 이미지 오른쪽의 스타일을 사용했으며 UI/캐릭터는 생성 이미지에 넣지 않았다. 전체 프롬프트는 [REFERENCE_PANORAMA_PROMPT.txt](REFERENCE_PANORAMA_PROMPT.txt), 팔레트와 검수 증거는 `G:/holdem_coin-workspace/island/maintenance/reference-combat-20261111`에 보존한다.

## 검증

- 전투 회귀 76개 통과: 일반 10구역 300마리, 대시 거리/재사용/충돌, 여러 줄 검격, 젬 슬롯 이동/제거, 마나/일시정지, 쿼터뷰 조준, 기존 보스/재화 회귀 포함.
- TypeScript 검사와 Unity 스크립트 컴파일 통과.
- Play Mode: 쪼개기와 폭풍 부름 각각 한 팩 6마리 명중, 쿼터뷰 낙뢰 명중 확인. 공격 10회 동안 VFX ParticleSystem 수는 12개로 고정됐다. 자세 검사 시 발 위치 오차는 0이었다.
- APK `0.1.0-test.20261111.1` / code `2026111101`, ARM64, 146,445,039 bytes. 빌드 성공, 오류 0, 기존 `IslandApp.lastDeal` 미사용 경고 1. 서명 및 16KB 정렬 검사 통과.
- APK SHA256: `b70995f63e2dcf381b78681f3315bde1bc76f12aaae24a4a1001f7c49cdbd6ae`.
- 블루스택 Android 9에서 기존 데이터를 보존한 업데이트 설치/실행, 연습 진입, 4→5구역 진행, 두 스킬의 실제 터치·시전·마나/쿨다운 표시·다리 물 렌더링을 확인했다. 해당 프로세스 로그에서 Unity 오류/예외나 fatal crash는 발견하지 않았다. Android 9의 선택 API 탐색 로그와 블루스택 GL 미지원 API 로그는 남아 있으며 실제 휴대폰 검증은 하지 않았다.
- 실제 Play Mode의 다리/능선/스킬 캡처와 상태 JSON은 위 작업 폴더의 `evidence`에 기록한다. 빌드 결과/서명/기기 실행 결과는 같은 폴더의 빌드·기기 기록을 기준으로 확인한다.
- 형식 검증은 생략했다. 이번 범위는 기존 결정론적 전투 테스트와 실제 Unity 실행 검증으로 확인하며, 저장/정산의 상태 프로토콜은 바꾸지 않는다.
