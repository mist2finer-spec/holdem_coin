# 홀덤 원형 프로필 — 웹/Unity 공용

요청한 은색 원형 프레임·머리 Pop-out·검정 딜러D·검정 반투명 정보판·파란 레벨 배지를 적용한다. 원본 캐릭터 얼굴을 새로 생성하지 않고 기존 일러스트9종의 픽셀을 크롭한다. 게임의 칩/카드/AI 계산은 변경하지 않는다.

## 공용 데이터와 에셋

- `public/poker/profiles/manifest.json`: portrait ID, 캐릭터ID, 원본 크롭, 머리 마스크, 공용 배치 좌표.
- `public/poker/profiles/*.png`: 512×512 투명 프로필9장과 딜러 원판. 닉네임/레벨/칩/D/SB/BB는 이미지에 굽지 않고 런타임에 표시한다.
- `scripts/poker/build-profile-assets.mjs`: SVG로 정의한 프레임/마스크를 Sharp로 렌더링. 원본 얼굴/의상 재생성 없음.
- `src/components/poker/PokerPlayerProfile.tsx`: 웹 공통 표현.
- `SalonSeat.tsx`: 싱글8인·서버6인·토너먼트8인의 공통 좌석. 상대 카드는 공개 전 뒷면, 폴드 시 숨김. 본인 카드는 폴드 후에도 유지.
- `CharacterPortrait.tsx`: 쇼다운/우승 화면도 같은 일러스트 프로필을 사용.

|portrait|캐릭터ID|
|---:|---|
|1|gold-dress|
|2|boy-hoodie|
|3|white-bob|
|4|black-suit|
|5|longhair-man|
|6|teal-twins|
|7|hong|
|8|pink-glasses|
|9|blonde-office|

알 수 없는 portrait는 홍7로 표시한다. 현재 홀덤 스냅샷에 RPG레벨이 없으므로 기본 표시는 **★1**이다. 전달된 유효한 `level`이 있으면 표시하며 칩이나 AI성향으로 레벨을 만들어내지 않는다. 토너먼트 칩은 기존 BB표기를 유지한다. 딜러D와 블라인드를 분리해 헤즈업의 D+SB도 동시에 표시한다.

## Unity 내보내기

별도 소스 체크아웃에서:

```powershell
node scripts/poker/build-profile-assets.mjs
python scripts/unity/export_poker_profiles.py --project-path "G:\new_project\IslandGame"
```

이 명령은 그림과 `Resources/PokerProfiles.json`, 별도 해시 목록만 추가한다. 기존 파일 내용이 다르면 `.island-backups/poker-profiles-*`에 백업한다. `.meta` GUID, C# 파일, 패키지 manifest는 바꾸지 않는다. 전체 `prepare_assets.py`를 실행할 때도 이 내보내기를 호출한다.

필요한 새 C#:

- `Runtime/PokerProfileView.cs`: uGUI컴포넌트, 공유 이미지 로더, 기존 IMGUI용 어댑터.
- `Editor/PokerProfileMenu.cs`: `GameObject > UI > Island Poker Profile`로 샘플 생성. 샘플칩10,000은 에디터 미리보기 값이며 계정 잔액이 아니다.
- `IslandApp.DrawPoker`의 이미지/이름표 부분은 `PokerProfileGui.Draw` 호출로 변경했다.

기존 로컬 uGUI 작업이 있다면 `IslandApp.cs` 전체를 덮어쓰지 않는다. 새 컴포넌트만 추가하고 좌석 프리팹에 연결한다. CanvasScaler는 기존 모바일 기준을 유지한다.

```csharp
// profile: 좌석의 PokerProfileView. 칩 문자열은 기존 표시 함수를 사용.
profile.Bind(
    portraitId: portrait,
    playerName: nickname,
    chipLabel: formattedStack, // 예: 25,208,035 또는100.0 BB
    playerLevel: actualLevelOrOne,
    isDealer: dealer,
    blindLabel: bigBlind ? "BB" : smallBlind ? "SB" : "",
    isActive: active,
    folded: folded
);
```

PNG는 Alpha Is Transparency, UI용 Bilinear, 과도한 압축 없음으로 확인한다. RawImage/레이블의 RaycastTarget은 꺼져 있어 조작 버튼 입력을 가로막지 않는다.

## 로컬 Unity 연결 에이전트에게 붙여넣기

```text
현재 G:\new_project\IslandGame의 AGENTS.md/UNITY_HANDOFF_KO.md와 로컬 변경을 먼저 확인해줘.
mist2finer-spec/holdem_coin의 운영 main에서 docs/unity/POKER_PROFILE_UI_KO.md를 읽어줘.
현재 로컬 uGUI, 보스 시험장, JSON null/카메라/AudioListener 수정과 GUID를 보존해줘.
별도 참조 체크아웃에서 scripts/unity/export_poker_profiles.py를 현재 프로젝트 대상으로 실행해 공용 PNG/manifest만 가져와줘.
PokerProfileView.cs/PokerProfileMenu.cs는 기존 동일 파일이 있는지 비교 후 필요한 변경만 병합해줘.
현재 좌석 프리팹의 전신 이미지를 PokerProfileView로 전환하고 실제 nickname/stack/portrait/D/SB/BB/active/folded를 Bind에 연결해줘.
실제 레벨 데이터가 없으면1을 표시하고 칩/성향에서 임의 레벨을 만들지 마.
싱글/6인/8인 토너먼트에서 본인 시점 회전, BB금액, 공개 전 카드 비공개, 폴드, 탈락 좌석 제거를 유지해줘.
Console 컴파일과 PlayMode에서9종 얼굴/상반신·머리 Pop-out·D+SB 동시 표시·이름/칩 폭·모바일 화면비를 확인해줘.
웹에서 통과한 검사와 실제 Unity에서 확인한 항목을 구분해 인계 문서에 남겨줘.
전체 Runtime이나 프로젝트를 원격 버전으로 덮어쓰거나 새 Unity 프로젝트를 중첩 생성하지 마.
```

## 검증

```bash
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs --test scripts/poker/test-profile-ui.tsx
node node_modules/typescript/bin/tsc -p tsconfig.poker-ui-check.json --pretty false
python -m unittest discover -s scripts/unity -p test_poker_profiles.py -v
python scripts/unity/check_csharp.py
```

브라우저 시험은 프로덕션 빌드 뒤 Playwright/Chromium으로 `node scripts/poker/smoke-profile-ui.mjs`를 실행한다. 격리된 임시 서버/저장을 사용하고 종료 시 정리한다. `PROFILE_SCREENSHOTS`로 캡처 경로 지정 가능. 프리뷰 갤러리는 `scripts/poker/preview-profiles.tsx`로 실제 React 컴포넌트에서 만든다.

형식 검증은 UI 변경이며 일반 회귀/브라우저 검사로 충분해 AGENTS.md 정책에 따라 생략한다. Unity Editor는 이 환경에 없으므로 C# 구문 검사가 실제 Unity 컴파일이나 PlayMode 성공을 의미하지 않는다.

이번 변경 검증 결과: 프로필/닉네임/레벨/카드 공개 회귀3테스트, 대상 UI TypeScript 검사, 추가 내보내기 백업/GUID 보존 테스트 통과. 실제 Chromium에서 싱글8좌석을320×568·375×667·390×844·430×932·1440×900으로 검사해 모든 프로필이 화면 안에 들어오는 것을 확인했고, 로컬 실제 서버6좌석과 토너먼트8좌석/BB표기도 확인했다. 브라우저 pageerror는0건이었다. Unity 검증은 C# 구문 검사까지이며 Editor 컴파일/PlayMode는 로컬 작업으로 남는다.
