// ============================================================
// AdaptiveCPUBrain.cs - 적응형 CPU 두뇌 (Python 포팅)
// ============================================================
// Python의 AdaptiveCPUBrain 클래스를 C#으로 포팅한 버전
// - Warm-Start 앵커 (처음부터 포커 정석 셋업)
// - 5가지 액션: FOLD / CHECK_CALL / RAISE_STD / RERAISE_POT / ALL_IN
// - 7단계 핸드 티어 (AIR/OVERCARDS/DRAW/WEAK_PAIR/TOP_PAIR/TWO_PAIR_PLUS/MONSTER)
// - ★ AIR 버그 수정 적용: 노히트 패는 투페어로 둔갑하지 않음
// - 잔차 Q-Learning (핸드 종료 후 가중치 업데이트)
// - 상대방 HUD 프로파일링
//
// 사용법:
//   var brain = new AdaptiveCPUBrain(myPersona);
//   var decision = brain.DecideAction(holeCards, boardCards, callAmount, ...);
//   // 핸드 종료 후
//   brain.LearnAfterHand(netChips, bigBlind);
// ============================================================

using System;
using System.Collections.Generic;
using UnityEngine;
using Poker;

namespace Poker
{
    [Serializable]
    public class BotPersona
    {
        public string name;
        public string style;
        public float tightness;   // 0.3 ~ 0.88 (높을수록 폴드 빈도 증가)
        public float aggression;  // 0.3 ~ 0.88 (높을수록 레이즈/리레이즈 빈도 증가)
        public float bluffFreq;   // 0.04 ~ 0.30 (드로우/에어에서 리레이즈 블러프 빈도)

        public BotPersona(string name, string style, float tightness, float aggression, float bluffFreq)
        {
            this.name = name;
            this.style = style;
            this.tightness = tightness;
            this.aggression = aggression;
            this.bluffFreq = bluffFreq;
        }
    }

    public class AdaptiveCPUBrain
    {
        public BotPersona persona;
        public int HandsPlayed { get; private set; }
        public float TotalProfitBB { get; private set; }
        public float LearningRate { get; set; } = 0.22f;

        // 잔차 Q 테이블: state_key → [5개 액션 가중치]
        Dictionary<string, float[]> residualQ = new Dictionary<string, float[]>();

        // 상대방 프로파일러 HUD
        public Dictionary<string, OpponentStats> OpponentHud { get; } = new Dictionary<string, OpponentStats>();

        // 현재 핸드 의사결정 기록
        List<HandDecision> handMemory = new List<HandDecision>();

        public AdaptiveCPUBrain(BotPersona persona)
        {
            this.persona = persona;
        }

        // ============================================================
        // 상대방 관찰 (액션 로그)
        // ============================================================

        public void ObserveOpponent(string actorName, string actionTag)
        {
            if (actorName == persona.name) return;
            if (!OpponentHud.ContainsKey(actorName))
                OpponentHud[actorName] = new OpponentStats();
            OpponentHud[actorName].acts++;
            if (actionTag.Contains("RAISE") || actionTag == "ALL-IN")
                OpponentHud[actorName].raises++;
            else if (actionTag == "FOLD")
                OpponentHud[actorName].folds++;
        }

        // ============================================================
        // 의사결정 (메인)
        // ============================================================

        /// <summary>
        /// 5가지 액션 결정
        /// </summary>
        /// <param name="hole">홀카드 2장</param>
        /// <param name="board">보드카드 (0~5장)</param>
        /// <param name="callAmount">콜 필요 금액 (0이면 체크 가능)</param>
        /// <param name="minRaise">최소 레이즈 금액</param>
        /// <param name="maxRaise">최대 레이즈 금액 (올인)</param>
        /// <param name="pot">현재 팟 크기</param>
        /// <param name="myStack">내 스택</param>
        /// <param name="myCurrentBet">현재 라운드 내 베팅</param>
        /// <param name="activeOpponents">생존 적 수</param>
        /// <param name="streetRaises">현재 라운드 레이즈 횟수</param>
        /// <param name="aggressor">레이즈 건 상대 이름 (없으면 null)</param>
        public Decision DecideAction(
            PokerHandEvaluator.Card[] hole,
            PokerHandEvaluator.Card[] board,
            int callAmount,
            int minRaise,
            int maxRaise,
            int pot,
            int myStack,
            int myCurrentBet,
            int activeOpponents,
            int streetRaises,
            string aggressor = null
        )
        {
            // 1) 핸드 티어 분류 (★ AIR 버그 수정 적용)
            var (tier, rawEquity) = HandTierClassifier.Classify(hole, board);
            float multiEq = Mathf.Pow(rawEquity, 1.0f + (activeOpponents - 1) * 0.28f);
            float potOdds = callAmount > 0 ? (float)callAmount / (pot + callAmount) : 0f;

            // 2) 베팅 압박 수위 (0~3)
            int pressure;
            if (callAmount == 0) pressure = 0;
            else if (streetRaises >= 2
                     || (float)callAmount / (myStack + callAmount) >= 0.28f
                     || (float)callAmount / pot >= 0.80f) pressure = 3;
            else if (streetRaises == 1 || (float)callAmount / pot >= 0.30f) pressure = 2;
            else pressure = 1;

            // 3) Warm-Start 앵커 로짓
            float[] anchor = GetWarmStartAnchor(pressure, tier);
            float[] logits = (float[])anchor.Clone();

            // 잔차 Q 적용
            string stateKey = $"{(board.Length == 0 ? "PRE" : "POST")}_P{pressure}_T{tier}";
            if (residualQ.ContainsKey(stateKey))
            {
                var rq = residualQ[stateKey];
                for (int i = 0; i < 5; i++) logits[i] += rq[i];
            }

            // 4) 팟 오즈 실시간 대조
            if (callAmount > 0 && multiEq < potOdds)
            {
                float gap = (potOdds - multiEq) * 6.5f;
                logits[0] += gap;   // FOLD 상승
                logits[1] -= gap;   // CALL 하락
            }

            // 5) 상대방 HUD 적응
            if (aggressor != null && OpponentHud.ContainsKey(aggressor) && OpponentHud[aggressor].acts >= 5)
            {
                float oppAgg = (float)OpponentHud[aggressor].raises / OpponentHud[aggressor].acts;
                if (oppAgg > 0.40f && tier >= HandTier.TOP_PAIR)
                {
                    logits[2] += 0.9f;  // 스탠다드 리레이즈 상승
                    logits[3] += 0.6f;  // 팟 리레이즈 상승
                    logits[0] -= 1.0f;  // 폴드 억제
                }
                else if (oppAgg < 0.15f && pressure >= 2 && tier <= HandTier.TOP_PAIR)
                {
                    logits[0] += 1.0f;  // 타이트한 상대의 레이즈엔 폴드 강화
                }
            }

            // 6) 하드 룰 마스킹
            bool canRaise = maxRaise > minRaise && streetRaises < 4;
            bool[] mask = { true, true, canRaise, canRaise, canRaise };
            if (callAmount == 0) mask[0] = false; // 체크 가능하면 폴드 금지
            // ★ 핵심: AIR 또는 레이즈 직면 OVERCARDS는 단순 콜 금지!
            if (callAmount > 0 && (tier == HandTier.AIR || (tier == HandTier.OVERCARDS && pressure >= 2)))
            {
                mask[1] = false;
            }

            // 7) Softmax 샘플링
            float[] expVals = new float[5];
            float tot = 0f;
            for (int i = 0; i < 5; i++)
            {
                if (!mask[i] || logits[i] < -50f) expVals[i] = 0f;
                else expVals[i] = Mathf.Exp(Mathf.Clamp(logits[i], -6f, 6f));
                tot += expVals[i];
            }

            int actIdx;
            if (tot <= 0)
            {
                actIdx = callAmount > 0 ? 0 : 1;
            }
            else
            {
                float r = UnityEngine.Random.value * tot;
                actIdx = 0;
                for (int i = 0; i < 5; i++)
                {
                    r -= expVals[i];
                    if (r <= 0) { actIdx = i; break; }
                }
            }

            // 8) 금액 계산
            int amount = 0;
            bool isBluff = false;
            string tag = "";

            switch (actIdx)
            {
                case 0:
                    amount = 0;
                    tag = "FOLD";
                    break;
                case 1:
                    amount = Mathf.Min(callAmount, myStack);
                    tag = callAmount == 0 ? "CHECK" : "CALL";
                    break;
                case 2:
                    float baseTo = callAmount > 0
                        ? (myCurrentBet + callAmount) * 2.2f
                        : (minRaise + pot * 0.6f);
                    amount = Mathf.Max(minRaise, Mathf.Min(Mathf.FloorToInt(baseTo), maxRaise));
                    if (tier <= HandTier.OVERCARDS) isBluff = true;
                    tag = streetRaises == 0 ? "RAISE" : "RE-RAISE";
                    break;
                case 3:
                    amount = Mathf.Max(minRaise, Mathf.Min(Mathf.FloorToInt(minRaise + pot * 1.0f), maxRaise));
                    if (tier <= HandTier.DRAW) isBluff = true;
                    tag = "POT-RERAISE";
                    break;
                case 4:
                    amount = maxRaise;
                    if (tier < HandTier.TOP_PAIR) isBluff = true;
                    tag = "ALL-IN";
                    break;
            }

            // 메모리 기록 (학습용)
            handMemory.Add(new HandDecision
            {
                stateKey = stateKey,
                actIdx = actIdx,
                tier = tier,
                potOdds = potOdds,
                callCostBB = callAmount / 200f
            });

            return new Decision
            {
                action = actIdx,
                amount = amount,
                isBluff = isBluff,
                tier = tier,
                tierName = HandTierClassifier.GetName(tier),
                tag = tag
            };
        }

        // ============================================================
        // Warm-Start 앵커 (Python _get_warm_start_anchor와 동일)
        // ============================================================

        float[] GetWarmStartAnchor(int pressure, int tier)
        {
            float t = persona.tightness;
            float a = persona.aggression;
            float b = persona.bluffFreq;

            // 1) 체크 가능한 무료 상황 (pressure == 0)
            if (pressure == 0)
            {
                if (tier == HandTier.AIR)
                    return new float[] { -99f, 2.2f, -0.4f + b * 2.0f, -2.0f + b * 1.2f, -99f };
                if (tier == HandTier.OVERCARDS || tier == HandTier.WEAK_PAIR)
                    return new float[] { -99f, 2.0f, 0.4f + a * 0.8f, -1.5f, -99f };
                if (tier == HandTier.DRAW)
                    return new float[] { -99f, 1.1f, 1.6f + a * 1.2f, 0.5f + a * 1.0f, -99f };
                if (tier == HandTier.TOP_PAIR)
                    return new float[] { -99f, 0.5f, 2.5f + a * 1.0f, 1.1f + a * 0.8f, -2.5f };
                // TWO_PAIR_PLUS, MONSTER
                return new float[] { -99f, 0.2f, 2.2f + a, 2.8f + a * 1.5f, 0.8f + a };
            }

            // 2) 상대 베팅/레이즈에 직면한 상황
            if (tier == HandTier.AIR)
            {
                // ★ 핵심: 노히트(AIR)는 상대 베팅/레이즈에 절대 CALL(-99) 하지 않음!
                float bluffQ = (b * 2.2f) - (pressure * 1.1f) - (t * 0.9f);
                return new float[] { 3.2f + t * 2.0f, -99f, bluffQ, -99f, -99f };
            }
            if (tier == HandTier.OVERCARDS)
            {
                if (pressure == 1)
                    return new float[] { 1.3f + t, 0.9f - t * 0.5f, -0.6f + b, -99f, -99f };
                // 레이즈 직면 시 콜 금지 → 칼폴드
                return new float[] { 3.4f + t, -99f, -1.0f + b, -99f, -99f };
            }
            if (tier == HandTier.WEAK_PAIR)
            {
                if (pressure == 1)
                    return new float[] { 0.4f + t * 0.8f, 1.7f, -0.8f, -99f, -99f };
                if (pressure == 2)
                    return new float[] { 2.2f + t * 1.4f, 0.1f - t * 0.6f, -1.8f, -99f, -99f };
                return new float[] { 3.8f, -99f, -99f, -99f, -99f };
            }
            if (tier == HandTier.DRAW)
            {
                if (pressure <= 2)
                    return new float[] { 0.3f + t * 0.5f, 1.5f, 1.4f + a * 1.4f, 0.4f + a * 1.0f, -2.0f };
                return new float[] { 1.8f + t, 0.5f, -0.4f + a * 0.5f, -2.0f, -2.0f };
            }
            if (tier == HandTier.TOP_PAIR)
            {
                if (pressure <= 2)
                    return new float[] { -0.4f + t * 0.5f, 1.8f, 1.5f + a * 1.2f, 0.4f + a * 0.8f, -1.8f };
                return new float[] { 1.3f + t * 0.9f, 0.9f, -0.1f + a * 0.6f, -1.0f, -1.5f };
            }
            if (tier == HandTier.TWO_PAIR_PLUS)
            {
                if (pressure <= 2)
                    return new float[] { -99f, 1.0f, 2.5f + a * 1.2f, 1.9f + a * 1.2f, -0.2f + a };
                return new float[] { 0.1f + t * 0.4f, 1.3f, 1.6f + a, 1.3f + a, 0.5f + a };
            }
            // MONSTER
            return new float[] { -99f, 0.7f, 2.2f + a, 2.9f + a * 1.5f, 2.0f + a * 1.5f };
        }

        // ============================================================
        // 핸드 종료 후 학습
        // ============================================================

        public void LearnAfterHand(int netChips, int bigBlind)
        {
            HandsPlayed++;
            float netBB = netChips / (float)Math.Max(bigBlind, 1);
            TotalProfitBB += netBB;

            foreach (var dec in handMemory)
            {
                if (!residualQ.ContainsKey(dec.stateKey))
                    residualQ[dec.stateKey] = new float[5];

                var rq = residualQ[dec.stateKey];
                if (dec.actIdx == 0)
                {
                    // 약한 패로 잘 폴드했다면 폴드 가중치 강화
                    if (dec.tier <= HandTier.WEAK_PAIR && dec.callCostBB > 0)
                        rq[0] = Mathf.Min(1.5f, rq[0] + LearningRate * 0.20f);
                }
                else
                {
                    float reward = Mathf.Clamp(netBB / 4f, -2f, 2f);
                    if (netBB < 0 && dec.tier <= HandTier.WEAK_PAIR)
                    {
                        reward -= 0.6f;
                        rq[0] = Mathf.Min(1.5f, rq[0] + LearningRate * 0.35f);
                    }
                    rq[dec.actIdx] = Mathf.Clamp(rq[dec.actIdx] + LearningRate * reward, -1.5f, 1.5f);
                }
            }

            handMemory.Clear();
        }

        // ============================================================
        // 학습 데이터 직렬화 (JSON 저장/로드용)
        // ============================================================

        public BrainSaveData ToSaveData()
        {
            return new BrainSaveData
            {
                name = persona.name,
                handsPlayed = HandsPlayed,
                profitBB = TotalProfitBB,
                residualQ = residualQ,
                oppHud = OpponentHud
            };
        }

        public void LoadFromData(BrainSaveData data)
        {
            if (data == null || data.name != persona.name) return;
            HandsPlayed = data.handsPlayed;
            TotalProfitBB = data.profitBB;
            if (data.residualQ != null)
            {
                foreach (var kvp in data.residualQ)
                    residualQ[kvp.Key] = kvp.Value;
            }
            if (data.oppHud != null)
            {
                foreach (var kvp in data.oppHud)
                    OpponentHud[kvp.Key] = kvp.Value;
            }
        }
    }

    // ============================================================
    // 보조 클래스
    // ============================================================

    [Serializable]
    public class OpponentStats
    {
        public int acts = 0;
        public int raises = 0;
        public int folds = 0;
    }

    [Serializable]
    public class HandDecision
    {
        public string stateKey;
        public int actIdx;
        public int tier;
        public float potOdds;
        public float callCostBB;
    }

    [Serializable]
    public class Decision
    {
        public int action;       // 0~4
        public int amount;
        public bool isBluff;
        public int tier;
        public string tierName;
        public string tag;       // FOLD / CHECK / CALL / RAISE / RE-RAISE / POT-RERAISE / ALL-IN
    }

    [Serializable]
    public class BrainSaveData
    {
        public string name;
        public int handsPlayed;
        public float profitBB;
        public Dictionary<string, float[]> residualQ;
        public Dictionary<string, OpponentStats> oppHud;
    }
}
