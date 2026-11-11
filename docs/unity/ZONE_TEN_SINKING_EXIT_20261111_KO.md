# 10구역 남쪽 배치 및 내려가는 바위 출구 — 2026-11-11

마을 문 아래쪽(6시 방향)으로 옮긴 초원 전장을 확정했다. 보스 처치 시 마을 방향의 바위 두 묶음이 **0.9초 동안 2.6m 아래로 내려가고**, 완전히 내려간 후 통로가 열린다. AUTO는 대기 후 기존 일반 달리기 속도(현재 프로필 약 3.85m/s, `run1`)로 마을에 진입한다. 마을 도착 때 미궁 탈출을 표시한다.

## 변경과 판정

- 전장 중심 월드 X/Z `(36,-5)`, 입장 `(24,-5)`, 보스 `(37,-5)`. 마을 문 `(40.72,13.50)` 방향으로 출구를 정렬했다. 진입로·평탄화·잔디·원형 바위·전장 밖 망루 이동과 실제 지형 높이 데이터도 함께 반영했다.
- 출구 근처에 남아 있던 기존 StandingStone 장식도 전장 바깥 `(47,-15)`로 옮겨 열린 통로를 정리했다. 실제 출구 하강·충돌 검증 후 발견한 장식이며, 최종 설치본과 클로즈업은 이 정리를 포함한다.
- 바위 이동은 프레임별 타이머가 아닌 권위 전투 시각의 `villageExitProgress`를 사용한다. SmoothStep으로 감속하며 내려간다. 개방 여부 `villageExitOpen`과 통과 판정이 같은 진행률을 따른다.
- 내려가는 중에는 원형 경계에서 막히며, AUTO는 잠시 대기한다. 일시정지 시 진행률도 멈춘다. 시각화 재진입/초기화 시 원래 위치와 활성 상태를 복구한다.
- 완료된 바위는 지하에 내린 다음 비활성화한다. 입구 쪽 바위는 유지한다. 보스 체력2000/일반1~9구역 사이드뷰/10구역 쿼터뷰/기존 스킬 범위는 유지한다.
- 원형 이동 경계와 마을 통로는 기존 TypeScript 권위 판정을 사용한다. Unity 콜라이더와 별도 물리 시뮬레이션을 중복으로 추가하지 않았다.

## 검증

- `npm run check:rpg`, `npm run unity:training:kernel`, 전투·젬·권위·번들·API·이동 회귀 **30/30 PASS**. AUTO 대기, 정지/일시정지, 바위 하강 중 수동 통과 차단, 완전 개방 후 통과, 일반 달리기 속도, 마을 도착 완료를 검사했다.
- Editor 실제 9→10구역부터 마을 도착까지 4075프레임, **11단계 PASS**, 오류0/네트워크 요청0. 실제 렌더링된 하강량이 0→2.6m 단조 증가하고 완전 개방 시 비활성/통과 가능으로 바뀌는 것을 기록했다.
- Android9 BlueStacks 3984프레임, 11단계 PASS, Unity 오류0/네트워크 요청0.
- `G:\holdem_coin-workspace\island\builds\IslandGame-ZoneTenExit-20261111.apk` · 147640331 bytes · ARM64. SHA256 `b7dacc805bc32dae5b37e3fb64c90ce31df1266ebbc4baf7c3c68f9dcd74851f`. ZIP/서명/16KB 정렬 PASS. 빌드 오류0/경고0.
- 테스트 버전 `0.1.0-test.20261111.5`, code2026111105, 개발 ID `com.mist2finer.islandgame.dev`. 실제 휴대폰·장시간 성능/발열은 미검증. 운영 배포는 하지 않았다.

## 확인 자료

[Editor 기록](evidence/zone10-sinking-exit-20261111/editor-report.json) · [Android 기록](evidence/zone10-sinking-exit-20261111/device-report.json) · [회귀 테스트](evidence/zone10-sinking-exit-20261111/tests.txt).

바위 클로즈업은 동일한 지형/컴포넌트에 진행률 0/0.5/1을 적용한 Scene 뷰 검토 프레임이다. 실제 재생 시간·판정은 위 Editor/Android 실시간 기록으로 검증했다.

[닫힘](evidence/zone10-sinking-exit-20261111/exit-closed.png) · [내려가는 중](evidence/zone10-sinking-exit-20261111/exit-halfway.png) · [개방](evidence/zone10-sinking-exit-20261111/exit-open.png) · [전장 전체](evidence/zone10-sinking-exit-20261111/south-overview.png).

Unity CLI로 씬/실행/빌드를 제어하고 기존 uGUI 안내 문구만 조정했다. 새 패키지나 재질은 추가하지 않았다. 기존 지형 아트와 카메라를 유지했다. Editor는 최종 MountZone10 Scene 뷰이며 검사 전용 root 활성화·조명은 저장하지 않는다.
