# Unity C# 아카이브 - RPG 홀덤

이 폴더는 Next.js 프로토타입에서 구현한 모든 포커 로직을 Unity C#으로 포팅한 코드를 포함합니다.
Python WebSocket 서버(poker_server.py)와 함께 사용할 수 있습니다.

## 📁 파일 구성

| 파일 | 설명 |
|------|------|
| `PokerProtocol.cs` | WebSocket 통신 패킷 정의 (JSON 직렬화) |
| `HoldemSubGameManager.cs` | 메인 게임 매니저 (WebSocket 연결, 5개 액션 버튼, 10초 타이머) |
| `PokerHandEvaluator.cs` | 7카드 텍사스 홀덤 평가기 (챱/split pot 정확 처리) |
| `HandTierClassifier.cs` | 7단계 핸드 티어 분류 (★ AIR 버그 수정 적용) |
| `AdaptiveCPUBrain.cs` | 적응형 CPU 두뇌 (Warm-Start + 잔차 Q-Learning) |

## 🎯 핵심 기능

### 1. 5가지 액션 시스템 (Python과 매칭)
```csharp
public static class ActionIndex
{
    public const int FOLD = 0;
    public const int CHECK_OR_CALL = 1;
    public const int RAISE_STD = 2;       // 2.2x 스탠다드 리레이즈
    public const int RERAISE_POT = 3;     // 팟 리레이즈 (3-Bet)
    public const int ALL_IN = 4;
}
```

### 2. 7단계 핸드 티어 (★ AIR 버그 수정)
```
0: AIR (노히트)           - 상대 베팅에 절대 콜 금지
1: OVERCARDS (오버카드)   - 레이즈 직면 시 칼폴드
2: DRAW (드로우)          - 세미블러프 리레이즈 가능
3: WEAK_PAIR (약페어)     - 소액벳만 콜
4: TOP_PAIR (탑페어)      - 콜 또는 밸류 리레이즈
5: TWO_PAIR_PLUS (투페어) - 적극적 리레이즈
6: MONSTER (몬스터)       - 강력한 리레이즈 & 올인
```

### 3. Warm-Start 앵커 (처음부터 정석 셋업)
- 신경망 학습 없이도 1핸드부터 포커 정석 플레이
- 핸드 진행될수록 잔차 Q-Learning으로 적응

## 📦 설치 방법

### 의존성 패키지
1. **NativeWebSocket** - WebSocket 통신용
   - Package Manager: `https://github.com/endel/NativeWebSocket.git`
2. **Newtonsoft.Json** - JSON 직렬화
   - Package Manager: `com.unity.nuget.newtonsoft-json`

### 설치 순서
1. 이 폴더의 모든 `.cs` 파일을 `Assets/Scripts/Poker/` 폴더에 복사
2. 빈 GameObject 생성 후 `HoldemSubGameManager` 컴포넌트 추가
3. Inspector에서 서버 URL 설정 (기본: `ws://localhost:8765`)
4. UI 버튼 5개(FOLD/CALL/RAISE/3-BET/ALL-IN) 생성 후 각 핸들러 연결

## 🔧 사용 예시

### 5개 메인 액션 버튼 연결
```csharp
public class PokerUI : MonoBehaviour
{
    public HoldemSubGameManager gameManager;

    public void OnFoldButton() => gameManager.OnClickFold();
    public void OnCallButton() => gameManager.OnClickCheckOrCall();
    public void OnRaiseButton() => gameManager.OnClickStdReraise();
    public void On3BetButton() => gameManager.OnClickPotReraise();
    public void OnAllInButton() => gameManager.OnClickAllIn();
}
```

### 테이블 상태 구독
```csharp
void Start()
{
    gameManager.OnStateChanged += UpdateTableUI;
    gameManager.OnActionLog += LogAction;
}

void UpdateTableUI(TableStatePacket state)
{
    // 팟 크기 표시
    potText.text = state.totalPot.ToString("N0");

    // 유저 턴인지 확인
    if (gameManager.IsUserTurn)
    {
        // 10초 타이머 표시
        timerSlider.value = gameManager.RemainingTime / 10f;
    }
}
```

### 핸드 평가기 단독 사용
```csharp
var holeCards = PokerHandEvaluator.ParseCards(new[] { "Ah", "Kd" });
var boardCards = PokerHandEvaluator.ParseCards(new[] { "As", "Kh", "9d", "2c", "7s" });
int score = PokerHandEvaluator.EvaluateBestHand(holeCards, boardCards);
string handName = PokerHandEvaluator.ScoreToCategoryName(score);
// → "투페어"
```

### CPU 두뇌 사용
```csharp
var persona = new BotPersona("오크 광전사", "루즈-어그레시브", 0.35f, 0.86f, 0.28f);
var brain = new AdaptiveCPUBrain(persona);

var decision = brain.DecideAction(
    hole: holeCards,
    board: boardCards,
    callAmount: 400,
    minRaise: 800,
    maxRaise: 20000,
    pot: 1200,
    myStack: 18000,
    myCurrentBet: 200,
    activeOpponents: 4,
    streetRaises: 1
);

Debug.Log($"액션: {decision.tag} {decision.amount} (tier: {decision.tierName})");

// 핸드 종료 후 학습
brain.LearnAfterHand(netChips: -400, bigBlind: 200);
```

## 🐛 해결된 치명적 버그

### AIR → TWO_PAIR_PLUS 둔갑 버그
**이전 코드:**
```csharp
// 버그: rankCounts[r] > boardOnlyCounts[r] 만 검사
// 7♣(1장) vs 보드에 7 없음(0장) → 1 > 0 = TRUE → 투페어로 둔갑!
myMatches = holeRanks.Where(r => rankCounts[r] > boardOnlyCounts[r]);
```

**수정 코드:**
```csharp
// ★ rankCounts[r] >= 2 조건 필수 (페어 완성 조건)
myMatches = holeRanks.Where(r =>
    rankCounts[r] >= 2 && rankCounts[r] > boardOnlyCounts[r]
);
```

이 수정으로 노히트(AIR) 패를 든 CPU가 상대 레이즈에 즉시 폴드하고,
탑페어·투페어·드로우를 잡은 CPU들만 콜이나 리레이즈로 맞불을 놓는 정상적인 포커 패턴이 구현됩니다.

## 🔗 관련 파일 (Next.js 프로토타입)

| TypeScript | C# |
|------------|-----|
| `src/lib/poker-engine.ts` | `PokerHandEvaluator.cs` |
| `src/lib/equity-engine.ts` (classifyHandTier) | `HandTierClassifier.cs` |
| `src/lib/self-play-trainer.ts` (decideActionForLive) | `AdaptiveCPUBrain.cs` |
| `src/components/poker/usePokerTable.ts` | `HoldemSubGameManager.cs` |
| (서버 통신) | `PokerProtocol.cs` |

## 📝 Python 서버와의 호환성

이 C# 코드는 Python `poker_server.py`의 `AdaptiveCPUBrain`과 완벽하게 호환됩니다:
- 동일한 5가지 액션 인덱스 (0~4)
- 동일한 7단계 핸드 티어 (0~6)
- 동일한 Warm-Start 앵커 로짓
- 동일한 팟 오즈 계산
- 동일한 잔차 Q-Learning 구조

C# 클라이언트와 Python 서버를 혼합해서 사용해도 동일한 게임 경험을 제공합니다.
