# 보상 추첨·배수 및 보호막 추가 복원 (2026-10-27)

기준 커밋은 `79ffe59`, 작업 브랜치는 `restore/rpg-damage-reward-db`다. 운영 배포나 웹 재화 지급 정책 변경은 포함하지 않는다.

## 이번에 확정한 부분

### 가중치 추첨 유틸리티

원본 `InHouse.Core.RandomUtil.SelectIndex`의 signed int / ushort 오버로드를 복원했다. signed의 음수 가중치는 0으로 만든 뒤 합산한다. 합계가 0이면 -1을 반환하며 RNG를 호출하지 않는다. 양수면 정수 난수 하나를 `[0,합계-1]` 범위로 요청하고 앞에서부터 가중치를 차감해 처음 음수가 되는 인덱스를 선택한다. 0 가중치 항목은 선택되지 않는다.

원본 ARM64 주소 `0x6bf77fc`, `0x6bf7a3c`: 2,728건 차등 검증 통과. 리스트 풀·접근자와 난수 출력은 픽스처이며 합산·음수 보정·선택 루프와 RNG 호출 횟수/요청 범위는 원본을 실행한다. signed 합계 오버플로 영역은 지원하지 않고 명시적으로 거부한다.

**이 유틸리티 발견이 서버 RewardGroup 추첨 정책의 복원을 뜻하지 않는다.** 클라이언트 `RewardGroupData`에는 `TryFindRewardData`, `TryFindRewardDatasNonAlloc` 조회 함수가 있다. PickEach/PickNTimes의 독립 시행/중복 허용/수량 범위 경계/Chance 단위가 이 유틸리티와 어떻게 연결되는지는 서버 근거가 아직 없다. 이 연결은 임의로 구현하지 않는다.

### 방치 기본 보상의 챕터·스테이지 보간

이름이 확인된 원본 `BalanceDataManager.CalcLabyrinthIdleRewardCountBaseValue`와 `CalcLabyrinthIdleRewardCount`에 해당한다. 원본 수치형은 double 기반이며 ARM64 `frintm`으로 각 연산을 내림한다. 디컴파일러의 `(long)` 표기를 믿고 반올림·0 방향 절삭으로 바꾸면 안 된다.

`Q(x)=floor(binary64(x))`, 스케일 `s`, 챕터 c 기본값 Bc, 해당 챕터 실제 스테이지 수 n, 스테이지 t일 때:

```
previous = c == 1 ? 0 : Q(B[c-1] * s)
current  = Q(B[c] * s)
delta    = Q(current - previous)
partial  = Q(Q(delta * float32(t)) / float32(n))
result   = Q(previous + partial)
```

원본 ARM64 `0x6b54140`, `0x6b54368`: 1,800건 차등 검증 통과. 실제 수식·숫자형 내림 헬퍼를 실행하며 벡터 접근과 스테이지 수 조회는 명시한 픽스처다. 10종 재화와 초기/후반 챕터·다양한 스케일을 대조했다.

골드 예: 1-1=60, 1-5=300 / 2-1=306, 2-5=333. **스테이지 클리어 보상이 아니라 방치·사냥 보상 계산의 기반 값이다.** 원본 1-1 클리어 RewardGroup1의 골드 240과 혼동하면 안 된다. 실제 StageData 6,000건에서 챕터별 연속 스테이지 수를 검증해 사용하며 5를 무조건 하드코딩하지 않는다.

### 사냥 보상 미리보기 배수

원본 `UIHuntingUtil.RebuildHuntingRewardList`의 표시 계산을 복원했다. `HuntingPopupRewardBasePoint=500` 기준이며 `TotalSpawnPower`가 아니다.

- `EventPoint != 0`, `ReqLabyrinthChapter <= 현재 챕터`인 이벤트의 EventChance 합을 분모로 사용한다.
- 표시 비중은 `EventChance / 분모`, 이벤트 횟수 계수는 `500 / EventPoint`다.
- RewardRateMin/Max가 양수면 정수 평균 비율을 기본값에 곱하고 100으로 나눈 뒤, 횟수 계수와 비중을 차례로 곱한다. BigInt 연산마다 내림한다.
- 비율의 한쪽이 1 미만이면 RewardCountMin/Max 정수 평균을 사용하는 분기로 간다.
- LabyrinthRewardIncRate(능력치 3)가 양수면 `floor(floor(base * rate)/100)` 보너스를 **기본값과 별도** 표시한다.

이는 클라이언트 예상값 표시다. 평균을 실제 랜덤 드롭으로 지급하거나 표시 비중을 서버 실제 이벤트 확률로 단정하지 않는다. UI 식은 소스·ARM64 호출 순서를 근거로 복원했으며 팝업 함수 전체의 ARM64 차등 검증을 통과했다고 표시하지 않는다.

## 보호막·후처리

원본 `CombatActor.DecShield`는 **최근에 추가된 보호막부터 역순으로** 소모한다. shield 효과 플래그가 없거나 `stop=true`인 레이어는 건너뛰고, 소진되면 shield=0 및 stop=true를 기록한다. 1,000건 원본 ARM64 차등 검증을 통과했다.

BacklashShield(901)의 폭발 후보는 shield<=0, **stop=true**, shieldExploded=false 조건이다. 이전 해석의 '시작됨'이 아니라 '종료/소진됨' 플래그였다. 자기 보호막 원래 양 × v3의 폭발 피해는 **보호막 소유자**에게 들어가며, 공격자에게 반사하는 코드로 바꾸지 않는다. 이번에는 원본 조건·타깃·후속 그로기/카메라 명령을 추출한다. 피해를 적용한 뒤 exploded를 기록하도록 명시하며 FX/패시브까지 연결된 실행기로 위장하지 않는다.

그로기 게이지는 HP 방어력과 분리한다. 살아 있는 대상의 양수 armor가 0이 되고 GroggyDuration이 양수면 effect 114 요청을 만든다. 이미 0인 대상에게 반복 생성하지 않는다. 모든 CC·패시브·StopEffect 상태 머신이 완성된 것은 아니다.

## DB 및 도구

`vardian-reward-policy.sqlite`에는 다음을 저장한다.

| 테이블 | 복원 행 |
|---|---:|
| 챕터·스테이지·재화별 방치 기본값 | 60,000 |
| 500포인트 사냥 보상 표시값 | 29,745 |

입력 metadata·LabyrinthData·HuntingData·StageData SHA와 미확정 정책 목록을 함께 저장한다. 수량은 TEXT로 출력한다. 원본 런타임의 double 연산을 재현하는 계산과 지갑의 정확한 Decimal 저장은 별개다.

```bash
npm run rpg:restore:reward-policy -- --source /private/export/decoded --metadata /private/global-metadata.dat --output /private/reward-policy
npm run rpg:reward-policy -- --db /private/reward-policy/vardian-reward-policy.sqlite --kind idle-base --chapter 2 --stage 1 --material 1
npm run rpg:reward-policy -- --db /private/reward-policy/vardian-reward-policy.sqlite --kind hunting-preview --chapter 100 --stage 5
npm run test:rpg:reference
```

기존 1시간 상한 `rpg:restore:loop`에 이번 네이티브 검증기를 추가했다. 새 출력 디렉터리·명령별 타임아웃·전체 예산을 유지하며, 미복원 상태가 안정되면 멈춘다. 서버 데이터 없이 반복해 임의값을 만드는 루프는 없다.

## 서버 측 경계와 다음 필요 자료

IdleRewardTake(요청 0x1ba9), HuntingEndEvent(요청 0x2745)는 서버 응답의 ResourceResult를 반영한다. 로컬 APK의 응답 핸들러만으로 서버의 추첨·중복 방지·광고 보너스 실제 지급식을 증명할 수 없다.

정확한 원본 서버 정책을 더 복원하려면 원본 서버 소스/바이너리 또는 같은 버전에서 입력 조건·선택 결과가 대응되는 응답 표본이 필요하다. 응답 표본만으로도 내부 RNG/비복원 추첨을 완전히 증명할 수 있는 것은 아니다. 현재 없는 자료 때문에 막히는 항목은 유지하고, 이번에 검증한 유틸리티·배수·보호막만 다음 복원의 기반으로 사용한다.

그 밖의 미복원: ActionData 2016/2036/2056/2430, 덮어쓰기 없는 원본 map_scenes 웨이브·NPC 참조, 활성 효과 전체 수명·패시브 재진입, 웹 대형 재화 지갑 마이그레이션.
