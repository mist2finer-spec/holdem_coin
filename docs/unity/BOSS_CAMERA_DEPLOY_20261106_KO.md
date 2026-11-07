> 최신 상태: [보스 모션·360° 조작·Nature 맵 수정 및 APK 검증](BOSS_CAMERA_20261106_KO.md). 코드/배포 ffde9d1, APK 버전 2026110602. 아래는 이전 시점의 기록입니다.

# Unity 보스 카메라 배포·Android 기록

대상 프로젝트 `G:/new_project/IslandGame`, 서버 Render **Test place** / holdem-coin-tavern.
구현·씬 가이드: [BOSS_CAMERA_20261106_KO.md](BOSS_CAMERA_20261106_KO.md).

- 서버 추가 PR #3와 전체 C# 소스 참고 스냅샷 PR #4를 main에 병합했다. 한글 세션 오류 문구 전송 손상은 PR #5에서 복구하고 메시지 계약 검사도 추가했다.
- 최종 서버 코드 리비전 `99898dfbeecdb45033efdef641cc8678bacbc32d`. Render의 이 리비전 배포 상태와 운영 `/api/release`, `/healthz`를 대조한다. 이후 문서만 추가한 main 커밋은 서버 리비전과 달라도 정상이다.
- 첫 운영 전투 검증: HTTP 211회, 실제 34.063초/서버 시뮬레이션 34.36초. 슬라임 전투·다리·보스·경고·폭발·날아감·넘어짐·기상 관측. 경고→폭발 2.0000000000001563초. 훈련 모드, 영구 보상 없음.
- Android: `G:/new_project/IslandGame/Builds/Android/IslandGame-Test-Boss-Camera-20261106.apk`. 버전 `0.1.0-test.20261106`, 코드 `2026110601`, `com.mist2finer.islandgame.dev`, ARM64 IL2CPP 개발 빌드, GLES3, Portrait, API23~36.
- APK 114,711,012 bytes (약 109.4 MiB), SHA-256 `c4f06c9303637c13423029488db7256d1a70b1d62efa765052e6f44b9759ecdd`. ZIP 무결성, 서명, 16KB 정렬, INTERNET 권한 검사 PASS. adb 기기 없음: 실기기 실행·발열·FPS는 미검증.
- Unity 정식 빌드 성공(오류0/경고1). 이전 지연 콜백의 중복 빌드는 저장 창에서 취소했으며 성공 APK 해시는 변하지 않았다. Editor 재연결 확인, Play 종료, 테스트 계정 설정 복원, 강제 tick/background override 해제. 원본 씬 파일은 저장하지 않았고 미저장 씬 상태도 남겨두었다.
- 카메라 자동23, 새 전투14, 기존 단계/전투30, 성장/아이템/저장153, 포커245, 포커 UI3 테스트 및 관련 타입 검사 PASS. PR #3/#4/#5 전체 CI 통과. 실제 70초 Editor 화면/부하 기록은 Evidence/live-review.json 참조.
- PC Editor CPU 활성 p95 1.0513ms/GPU p95 0.18432ms. 단발성 CPU 최대16.196ms가 있으므로 모든 프레임이 10.83ms 이내라고 주장하지 않는다.
- PDF와 전체 카메라 코드: `G:/new_project/meele_ref/Unity_Boss_Camera_Guide_20261106.pdf`, `G:/new_project/meele_ref/BattleCameraController.cs`.
- C#·텍스트 설정과 원본 GLB·베이크 애니메이션·grounding JSON·전체 해시 매니페스트를 GitHub에 함께 보관했다. Windows Git 인증 후 일반 Git으로 전송했으며 원본 해시, GLB 헤더/길이, Unity GUID 메타데이터를 검사했다. 검사 결과는 Evidence/asset-publish-validation.json을 참조한다. 기존 라이선스 패키지와 로컬 플레이어 에셋은 그대로 보존한다.

검증 JSON은 [Evidence](client-source-snapshot/2026-11-06/Evidence/)에서 확인한다. APK는 대용량 Git 객체로 넣지 않았다.

최종 확인: Render 배포 dep-dbn6t0nb9u1s73f33os0 live, /healthz 200, /api/release 리비전 일치, 한글 세션 오류 메시지 정상. 실제 Unity 운영 연결도 PASS (production-unity.json). 바이너리 자산의 인증 대기는 해소됐다.
