# 홀덤 규칙·검증 패치 1.18.0

첨부 Python 파일은 지침으로 검토했으며 실행 엔진에 그대로 복사하지 않았습니다.
동일한 TypeScript 규칙이 싱글, 6인/8인 서버, 자체 학습에 적용됩니다. RPG 코드는 변경하지 않습니다.

## 규칙 변경

- 미콜 초과금은 전액 환불하며 레이크를 부과하지 않습니다.
- No Flop, No Drop을 기본 정책으로 적용합니다. 프리플랍 폴드 승리는 레이크 0입니다.
- 플랍이 열린 핸드는 매칭된 기여금에만 5%를 부과합니다. 팟별 반올림 오차는 누적해 전체 과세 팟의 5% 내림과 일치시킵니다.
- 최소 레이즈 총액은 현재 최고액 + 직전 유효 증가분입니다. 100/200에서 600 오픈 뒤 최소 리레이즈는 1000입니다.
- 작은 올인은 콜 응답을 요구할 수 있지만 기존 액터의 레이즈 권한을 자동 재개하지 않습니다. 누적 작은 올인으로 충분한 증가분을 마주한 액터는 다시 레이즈할 수 있습니다.
- 포스트플랍 첫 정상 베팅은 로그에서 `bet`으로 기록합니다. UI 전송 명령 `raise`는 호환성을 위해 유지하며, 실제 올인 콜은 그대로 `allin`으로 기록하고 `betAfter`로 판별합니다.
- 로그에 minRaiseBefore / lastFullRaiseBefore / canRaiseBefore를 추가했습니다. `minRaiseBefore`는 스택으로 자르기 전의 일반 최소 총액입니다. 그보다 짧은 올인만 예외입니다.
- 금액 단위: paid는 추가 투입, betAfter는 해당 스트리트 총액, totalBet은 핸드 총 기여금입니다.

예: 20,000 올인에 200을 낸 상대가 프리플랍 폴드하면, 승자는 매칭 팟 400 + 환불 19,800 = 20,200을 받으며 순수익은 +200입니다.
같은 기여금으로 플랍 이후 끝났다면 매칭 팟의 레이크 20을 제외한 20,180을 받습니다.

## CPU / 캐릭터

캐릭터 고유 성향, 5핸드 로테이션, 스택 밴드, 커넥터·림프·3bet 방어, 블러프 공개 기믹을 유지합니다.
실제 플레이어 패와 대조하는 46% 개인 오라클과 상대 히트 여부 힌트는 게임에서 제거했습니다.
타이트 캐릭터의 체크/프로브/방어도 자기 패·공개 보드 기반 레인지 추정으로 처리합니다.
리버는 기존 5–40% 전용 블러프캐치 정책을 사용하고, 별도 포스트플랍 보정이 이 빈도를 우회하지 않도록 분리했습니다.
EV의 미콜 환불·폴드 승리·사이드팟도 새 정산과 일치시킵니다.
브라우저의 예전 하우스 룰 학습 가중치는 새 저장 키에서 사용하지 않습니다. 기존 저장 키를 삭제하지 않습니다.

## 첨부 스크립트에서 바로잡은 점

- bugfix_rules.py의 OOP 함수는 마지막 액터를 true로 반환해 IP/OOP가 반대입니다. 현재 엔진의 '베팅 가능한 좌석 중 마지막 = IP' 판정을 유지합니다.
- 첨부 min-raise 추론은 모든 allin을 full raise처럼 취급합니다. 실제 엔진은 full increase와 short allin을 구분합니다.
- 첨부 pokerkit_replay.py는 일부 버전에 없는 속성/자동 딜 조합을 사용하며, 실제 홀 카드·보드·버튼 순서의 재생 및 승자 비교가 완성되지 않았습니다.
- gto_validator.py는 잘못된 Card 생성/API 호출, 미완성 솔버 연결, 계산 실패 시 0.5 반환 경로가 있어 GTO 검증 근거로 사용하지 않습니다.
- make_sample.py / sample_hands.json은 재구성된 4핸드 샘플입니다. 전체 운영 DB의 실제 통계로 취급하지 않습니다.

## 독립 검증

Python은 오프라인 검증에만 필요하며 운영 서버에 추가하지 않습니다.

```sh
python -m pip install -r scripts/pokerkit/requirements.txt
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/export-betting-fixtures.ts | python scripts/pokerkit/verify_betting.py
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/export-pokerkit-fixtures.ts | python scripts/pokerkit/verify_settlement.py
POKER_TEST_MODE=1 node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/pokerkit/generate_history.ts /tmp/hands.json
python scripts/pokerkit/audit_history.py /tmp/hands.json
node scripts/validate_holdem.js
```

`audit_history.py`는 PokerKit의 실제 actor / call / min raise / 액션 가능 여부를 사용합니다.
버튼과 블라인드로 좌석을 매핑하고, 실제 홀 카드·공개 보드를 재생하며, 칩 보존·새 레이크 정책·쇼다운 승자를 대조합니다.
오류가 있으면 exit(1), 정상은 exit(0)입니다. 숨겨진 패가 포함되지 않은 공개 기록의 쇼다운은 검증 불가로 명시합니다.
GTO 최적성이나 수익성의 증명은 아닙니다. 승률 계산 실패를 50%로 덮지 않습니다.
