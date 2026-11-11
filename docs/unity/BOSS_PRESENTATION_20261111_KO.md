# 아스트로스 보스 연출 / Android 테스트 (2026-11-11)

결과: PASS. 실물 휴대폰 및 사용자 미술 확정은 미검증.

- ref/ref_2.jpg를 보고 10구역 전투 기본 카메라를 거리27/FOV42에서 거리19/FOV38, pitch38로 조정. 보스·플레이어·공격 경고가 잘리지 않도록 기존 자동 프레이밍 유지. 근접 전투 실제 거리19.46~20.85, 멀리 떨어진 시작 구간은 자동 줌아웃.
- 상단 아스트로스 이름과 체력 비율 막대. 숫자 미표시, 사망 HP0은 채움 숨김, 일반 구역은 보스바 숨김.
- 자체 제작 Astros_Idle/Walk 클립: 양팔 아래, 호흡 및 다리/팔 교차 보행. 기존 훅·던지기 클립과 접촉 판정 유지. 추격 마지막 프레임부터 최소0.55초 대기 후 공격.
- 사망1.1초 동안 제자리 뒤로88도 회전, 3.5초 표시. 권위 위치 이동 없음. 기존2000HP·0.9초 출구 하강·AUTO 일반 달리기·마을 도착 종료 유지.

검증:
- npm run check:rpg PASS; zone-ten-arena / unity-boss / boss-contact / unity-boss-route / local-training / mount-route 41개 PASS.
- test-boss-presentation.ts 2개 PASS: 추격 후 대기, 사망 표시 시간과 위치 보존.
- Unity C# 컴파일 PASS. Android IL2CPP ARM64 개발 빌드 오류0, 기존 lastDeal 미사용 경고1.
- Android9 BlueStacks emulator-5554: 3758프레임, 15개 진행 지점 PASS, Unity 오류0, 네트워크0. 일반 사이드 입장→쿼터 전투→걷기/대기/공격→번개→처치→출구하강→달리기→마을 완료.
- PNG 직접 확인: boss-neutral, boss-walk, boss-fallen. idle 클립 샘플에서 양손 y0.528, 상완 y1.072로 팔 아래 확인. 프레임 캡처는 전환 순간 블렌드 포함.
- Unity MountZone10 씬 열어둠, Play 종료, 검사 조명 저장 안 함. 렌더러404, 누락/미지원 재질0.

APK: G:/holdem_coin-workspace/island/builds/IslandGame-BossPresentation-20261111.apk
버전: 0.1.0-test.20261111.8 / 2026111108
크기: 150828662 bytes
SHA256: a8f1e74ff02b0da446a35c2eced474109cbd0b403284925a08b2d3bdc265f952
ZIP/서명/16KB 정렬 PASS.
증거: G:/holdem_coin-workspace/island/maintenance/boss-presentation-20261111/evidence

실물 Android의 GPU/프레임 성능·발열은 별도 확인 필요. ref_2와의 미술적 일치 및 동작 품질은 사용자 검토 대상. 기본 카메라 확대는 적용됐지만 큰 보스/공격 예고가 화면 밖으로 나가는 상황에서는 안전 프레이밍이 줌아웃한다.
