# Island Holdem + RPG — Unity 통합 클라이언트

## 현재 결과와 범위

기준 웹 커밋: `d3b199937a57aba16af1badb8ff7106ad8d0cfe4`.
Unity 6.0 프로젝트에 네이티브 C# 클라이언트를 추가했다. WebView는 사용하지 않는다.
**홀덤 룰·봇·레이크·정산, RPG 전투·성장·저장 권한은 기존 Node 서버에 둔다.** 클라이언트만 Unity로 옮긴 구조이며, 전체 서버 엔진을 C#으로 다시 작성하거나 서버 없는 오프라인 게임을 만든 것은 아니다.

Unity Editor가 없는 환경에서 작성했다. C# 독립 계약 검사와 구문 검사, 실제 Node 서버 통신 및 서버 회귀 검사는 수행했지만 **Unity Editor 전체 컴파일, PlayMode, Windows/Android 빌드는 미실행**이다. 완성·배포 검증된 Unity 제품으로 취급하면 안 된다. 생성된 Unity 화면의 버튼/레이아웃은 기능 확인용으로, 웹 CSS의 픽셀 단위 복제본이 아니다.

## 실행 — 가장 짧은 경로

다운로드한 준비 ZIP에는 원본에서 내보낸 Resources 에셋이 포함되어 있다.

1. Unity Hub에 Unity **6.0** Editor를 설치한다. Android 테스트에는 Android Build Support/SDK/NDK/OpenJDK도 설치한다.
2. ZIP의 `unity/IslandGame`을 Hub의 Add project from disk로 추가한다.
3. 첫 실행에 Package Manager가 Newtonsoft 및 **Spine 4.2** 런타임을 받는다. 사용 전 Spine 런타임 라이선스 조건을 확인한다.
4. 패키지/스크립트 임포트가 끝나면 통합 씬이 자동 생성된다. 자동 생성되지 않으면 **Island → Create integration scene**을 선택한다.
5. Play. 로비에서 6인 서버, 8인 토너먼트, 바르디안 회랑, 성장 사냥을 선택한다.
6. 싱글 홀덤은 아래 전용 로컬 백엔드를 먼저 시작해야 한다.

Git에서 받은 경우 에셋 중복 커밋을 피하려고 Resources/WebAssets는 제외되어 있다. 저장소 루트에서 다음을 실행한다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\unity\prepare.ps1
```

Python/Pillow, Git, 인터넷 연결이 필요하다. 내보내기는 원본 tracked public 파일만 사용한다. Unity가 기본 지원하지 않는 WebP는 PNG로 바꾸고 `.atlas`는 `.atlas.txt`로 복사한다. 원본 JSON·UV·본·애니메이션은 변경하지 않는다. `asset-export.json`에 출력 SHA-256을 기록한다.

## 서버

- 온라인 기본값: `https://holdem-coin-tavern.onrender.com`.
- 홀덤: 운영과 같은 Engine.IO 4 / Socket.IO 기본 namespace의 HTTP polling. 접속/핑/이벤트/ack만 구현한다. 바이너리 이벤트, 별도 namespace는 현재 서버가 쓰지 않으므로 지원하지 않는다.
- RPG: `/api/rpg/rogue`, `/api/rpg/session`을 그대로 사용한다. 쿠키는 사용자 기기에 보존하고 세션 명령은 한 번에 하나씩 전송한다.
- 실패한 포커 액션을 자동 재전송하지 않는다. 전송 결과가 불명확하면 재접속 후 상태를 확인한다. RPG는 기존 session ID와 동일 sequence/본문만 제한 재시도한다. 초기 start는 결과가 불명확할 때 자동 재시작하지 않는다.
- Native 앱은 브라우저 SameSite 쿠키 규칙이 아닌 Cookie 헤더로 기존 게스트 식별자를 보낸다. 이것은 정식 계정 로그인 구현이 아니다. 기존 게스트 저장 모델을 유지한다.
- 온라인 8인 캐시방의 Under Repair 제한은 유지한다. 8인 토너먼트는 별도 동작한다.

### 싱글 8인 전용 백엔드

저장소 루트에서:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\unity\start_solo.ps1
```

Node.js/npm 및 기존 웹/포커 서버 의존성이 필요하다. 준비되지 않았으면 스크립트가 백엔드를 빌드한다. 최초 빌드는 시간이 걸린다.

전용 프로세스에만 `UNITY_SOLO=1`, 공개 프록시8081/Next3001/포커3004를 설정한다. Unity의 Solo server 기본값은 `http://127.0.0.1:8081`이다. 동일 프로세스에 다른 사용자가 입장하려 하면 거부한다. 운영 서버 환경변수는 변경하지 않는다.

Android에서 PC 서버에 접속할 때 localhost는 휴대폰 자신이다. 로비의 **Server settings**에서 PC의 LAN 주소와8081포트를 입력한다. 개발 Android 빌드만 HTTP를 허용한다. 배포용 연결은 HTTPS를 사용한다. 서버 없는 오프라인 싱글 모드는 미구현이다.

## 기능 대응

| 영역 | 구현 | 확인 범위 |
|---|---|---|
| 로비 | 이름, 멀티 잔액/충전, 서버 설정, 모드 선택 | C# 코드 및 통신 계약; Unity UI 미실행 |
| 싱글 홀덤 | 전용 Node 백엔드+8인 네이티브 테이블 | 실제 polling/8좌석/동시 입장 차단 검사 |
| 6인 멀티 | 운영 JOIN_ROOM/TABLE_STATE/액션 | 서버 회귀 검사; Unity 실제 플레이 미실행 |
| 토너먼트 | 8인 입장, Round/카운트, BB 표시, 탈락 제거, 우승 메시지 | 서버 스냅샷 계약 |
| 베팅 | fold/check/call/raise/all-in, 배수·팟 분할·커스텀, 예약, 리바인 | 사이징 C# 검사; 서버가 합법성 최종 검증 |
| 카드/쇼다운 | 본인/공개 카드만 표시, 홀2+보드5 순서 유지, 베스트5 표시 | C# wheel/hidden-card 검사 |
| 로그 | 공개 HAND_HISTORY만 기기 저장, 최근1,000개 | 관리자/CPU 비공개 분석 API 사용 안 함 |
| 홀덤 사운드 | 로비/포커 BGM, 셔플/딜/칩/올인 | 원본 사운드 포함, Unity 청취 미실행 |
| 회랑 전투 | X축 입력, 점프·슬라이딩·회피·6스킬·AUTO | 서버 기존 로직, 네이티브 렌더러 코드 |
| 홍/몬스터 | Spine 4.2 네이티브 렌더링, 무기별 선택 | 원본 데이터/에셋 내보내기 검사 |
| 성장/장비 | campaign API, 무기 장착/업그레이드, 방어구/훈련/스킬 등 명령 | 가격·보상·세이브는 서버가 계산 |
| 빌드 | 씬 생성, Windows/Android 메뉴 | Editor 미설치로 빌드 미실행 |

## 알려진 미완료와 원본 누락

- 원본 성장 데이터의 몬스터58종 중17종은 제공된 assets 테이블에 해당 원본 파일이 없다. `AssetIndex.json.unresolvedMonsterAssets`에 명시했다. 이 종류의 Unity 그래픽은 아직 표시할 수 없다. 스탯을 복원했다고 누락 그래픽까지 복원됐다고 취급하지 않는다.
- 원본 UI 일러스트/테이블 캐릭터는 재사용하지만 현재 UI는 Unity IMGUI 기능 프로토타입이다. 최종 Canvas/UIToolkit 아트 배치, 다양한 노치/터치 실기기 QA는 후속 작업이다.
- 맨손 비주얼은 현재 기본 도끼 리그 fallback이다. 서버의 맨손 피해/성장 규칙과 그래픽을 구분한다.
- 회랑은 원본 메시를 베이크한 배경·전경을 웹과 같이 연결한 구성이다. 원본 3D NavMesh, 전체 Unity 씬/Collider 복원이 아니다.
- VFX 전체 재생·장판 표시·리바인/탈락 모달의 최종 연출·블러프 공개 연출·리더보드 전용 화면은 아직 웹과 동일 수준으로 완성되지 않았다. 기존 원본 서버 권한과 룰을 유지하는 기능 이식 기반이다.
- Spine4.2 패키지는 고정 커밋을 참조한다. 기존4.2 JSON을4.3 런타임에 그대로 넣지 않는다.

## 검증

```powershell
python scripts/unity/validate_export.py
dotnet run --project scripts/unity/contracts/Contracts.csproj
node scripts/unity/contract_probe.mjs
npm test --prefix mini-services/poker-server
```

독립 C#13검사 통과. 이식본 평가기에서 기존 아카이브의 A2345 0-based rank 오류를 수정했다. 실제 폴링 프로토콜 검사 통과. 기존 홀덤244회귀 검사 통과. C#9파일 구문 검사 통과. 에셋215개 해시 및 Spine4.2 검사 통과. Unity API 바인딩/셰이더 임포트/에디터 전체 컴파일/실기기 렌더 검증은 이와 별개로 남아 있다.

형식 검증 모델은 추가하지 않았다. 운영 서버의 명령 순서·정산 계약은 유지하며, 새 텍스트 프로토콜과 결정론적 표시 계산은 직접 계약/회귀 검사로 검증한다. 향후 오프라인 C# 서버 엔진을 만들 경우 칩 보존·사이드팟·정산 중복 방지의 별도 모델/검사를 평가해야 한다.

참고: https://esotericsoftware.com/spine-unity-installation
https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Networking.UnityWebRequest.html
