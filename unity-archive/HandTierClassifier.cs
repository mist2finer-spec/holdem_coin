// ============================================================
// HandTierClassifier.cs - 7단계 핸드 티어 분류기 (C# 포팅)
// ============================================================
// Python의 evaluate_hand()와 classifyHandTier()를 C#으로 포팅
// ★ AIR 버그 수정 적용: rankCounts[r] >= 2 조건 필수
// - 노히트 패는 투페어로 둔갑하지 않음
// - 드로우 감지 (플러시/스트레이트)
// - 보드 페어 착시 완벽 제거
//
// 사용법:
//   var (tier, equity) = HandTierClassifier.Classify(holeCards, boardCards);
//   string name = HandTierClassifier.GetName(tier);
// ============================================================

using System;
using System.Collections.Generic;

namespace Poker
{
    public static class HandTierClassifier
    {
        const string RANKS = "23456789TJQKA";

        /// <summary>
        /// 핸드 티어 분류
        /// </summary>
        /// <returns>(tier 0~6, rawEquity 0.0~1.0)</returns>
        public static (int tier, float rawEquity) Classify(PokerHandEvaluator.Card[] hole, PokerHandEvaluator.Card[] board)
        {
            if (hole == null || hole.Length < 2) return (HandTier.AIR, 0.10f);

            int[] hRanks = new int[2];
            hRanks[0] = hole[0].RankValue;
            hRanks[1] = hole[1].RankValue;
            Array.Sort(hRanks);
            Array.Reverse(hRanks); // 내림차순

            bool suited = hole[0].suit == hole[1].suit;
            int high = hRanks[0];
            int low = hRanks[1];
            int gap = high - low;

            // [A] 프리플랍 평가
            if (board == null || board.Length == 0)
            {
                if (high == low)
                {
                    // 포켓 페어
                    if (high >= RANKS.IndexOf("J")) return (HandTier.MONSTER, 0.82f);        // JJ~AA
                    if (high >= RANKS.IndexOf("8")) return (HandTier.TWO_PAIR_PLUS, 0.70f);  // 88~TT
                    if (high >= RANKS.IndexOf("5")) return (HandTier.TOP_PAIR, 0.60f);       // 55~77
                    return (HandTier.WEAK_PAIR, 0.52f);                                       // 22~44
                }
                if (high == RANKS.IndexOf("A") && low >= RANKS.IndexOf("Q"))
                    return (HandTier.TWO_PAIR_PLUS, suited ? 0.68f : 0.65f); // AQ+
                if (high >= RANKS.IndexOf("K") && low >= RANKS.IndexOf("T"))
                    return (HandTier.TOP_PAIR, suited ? 0.60f : 0.56f);      // KT+
                if (suited && (high == RANKS.IndexOf("A") || (gap <= 2 && low >= RANKS.IndexOf("6"))))
                    return (HandTier.DRAW, 0.50f);
                if (suited || (gap == 1 && low >= RANKS.IndexOf("8")))
                    return (HandTier.OVERCARDS, 0.42f);
                return (HandTier.AIR, 0.22f);
            }

            // [B] 포스트플랍 평가
            int[] bRanks = new int[board.Length];
            for (int i = 0; i < board.Length; i++) bRanks[i] = board[i].RankValue;
            Array.Sort(bRanks);
            Array.Reverse(bRanks);

            // 전체 랭크
            List<int> allRanksList = new List<int>(hRanks);
            allRanksList.AddRange(bRanks);
            int[] allRanks = allRanksList.ToArray();

            // 1) 플러시 및 플러시 드로우
            Dictionary<string, int> suitCnt = new Dictionary<string, int>();
            HashSet<string> holeSuits = new HashSet<string> { hole[0].suit, hole[1].suit };
            foreach (var c in hole) suitCnt[c.suit] = (suitCnt.ContainsKey(c.suit) ? suitCnt[c.suit] : 0) + 1;
            foreach (var c in board) suitCnt[c.suit] = (suitCnt.ContainsKey(c.suit) ? suitCnt[c.suit] : 0) + 1;

            bool hasFlush = false;
            bool hasFlushDraw = false;
            foreach (var kvp in suitCnt)
            {
                if (kvp.Value >= 5 && holeSuits.Contains(kvp.Key)) hasFlush = true;
                if (board.Length < 5 && kvp.Value == 4 && holeSuits.Contains(kvp.Key)) hasFlushDraw = true;
            }

            // 2) 스트레이트 및 스트레이트 드로우
            HashSet<int> uRanks = new HashSet<int>(allRanks);
            if (uRanks.Contains(12)) uRanks.Add(-1); // A-2-3-4-5 wheel

            int maxSeq = 0;
            for (int start = -1; start <= 9; start++)
            {
                HashSet<int> win = new HashSet<int> { start, start + 1, start + 2, start + 3, start + 4 };
                int overlap = 0;
                bool holeContributes = false;
                foreach (int r in uRanks)
                {
                    if (win.Contains(r))
                    {
                        overlap++;
                        if (hRanks.Contains(r) || (r == -1 && hRanks.Contains(12)))
                            holeContributes = true;
                    }
                }
                if (holeContributes) maxSeq = Math.Max(maxSeq, overlap);
            }
            bool hasStraight = maxSeq == 5;
            bool hasStraightDraw = board.Length < 5 && maxSeq == 4;

            // 3) 페어/트립스 히트 판별 (★ AIR 버그 수정)
            Dictionary<int, int> totRc = new Dictionary<int, int>();
            Dictionary<int, int> brdRc = new Dictionary<int, int>();
            foreach (int r in allRanks) totRc[r] = (totRc.ContainsKey(r) ? totRc[r] : 0) + 1;
            foreach (int r in bRanks) brdRc[r] = (brdRc.ContainsKey(r) ? brdRc[r] : 0) + 1;

            // ★ 핵심: rankCounts[r] >= 2 조건 필수!
            // 내 홀카드가 개입하여 최소 2장 이상(페어 이상)이 된 랭크만 추출
            List<int> myPairedRanks = new List<int>();
            foreach (int r in hRanks)
            {
                if (totRc.ContainsKey(r) && totRc[r] >= 2 && totRc[r] > (brdRc.ContainsKey(r) ? brdRc[r] : 0))
                {
                    if (!myPairedRanks.Contains(r)) myPairedRanks.Add(r);
                }
            }

            // 몬스터: 플러시, 스트레이트, 셋/트립스/포카드
            bool hasTrips = false;
            foreach (int r in myPairedRanks)
            {
                if (totRc[r] >= 3) { hasTrips = true; break; }
            }
            if (hasFlush || hasStraight || hasTrips)
                return (HandTier.MONSTER, 0.92f);

            // 투페어 또는 오버페어
            if (myPairedRanks.Count >= 2)
                return (HandTier.TWO_PAIR_PLUS, 0.84f);
            if (hRanks[0] == hRanks[1] && hRanks[0] > bRanks[0])
                return (HandTier.TWO_PAIR_PLUS, 0.80f); // 오버페어

            // 원페어 히트
            if (myPairedRanks.Count == 1)
            {
                int hitR = myPairedRanks[0];
                if (hitR >= bRanks[0])
                {
                    // 탑페어 (킥커 보정)
                    int kicker = hRanks[1] == hitR ? hRanks[0] : hRanks[1];
                    return (HandTier.TOP_PAIR, 0.68f + (kicker / 12f) * 0.08f);
                }
                // 미들/바텀페어지만 드로우 겹치면 DRAW 등급
                if (hasFlushDraw || hasStraightDraw)
                    return (HandTier.DRAW, 0.56f);
                return (HandTier.WEAK_PAIR, 0.36f);
            }

            // 보드보다 낮은 언더 포켓페어
            if (hRanks[0] == hRanks[1])
                return (HandTier.WEAK_PAIR, 0.34f);

            // 노페어지만 드로우 보유
            if (hasFlushDraw || hasStraightDraw)
                return (HandTier.DRAW, 0.52f);

            // 노페어지만 보드 최고 카드보다 높은 오버카드 2장
            if (board.Length < 5 && hRanks[1] > bRanks[0] && hRanks[0] >= RANKS.IndexOf("Q"))
                return (HandTier.OVERCARDS, 0.28f);

            // ★ 순수 에어 (승률 0.08)
            return (HandTier.AIR, 0.08f);
        }

        /// <summary>
        /// 티어 번호를 이름으로 변환
        /// </summary>
        public static string GetName(int tier)
        {
            switch (tier)
            {
                case HandTier.AIR: return "AIR(노히트)";
                case HandTier.OVERCARDS: return "OVERCARDS(오버카드)";
                case HandTier.DRAW: return "DRAW(드로우)";
                case HandTier.WEAK_PAIR: return "WEAK_PAIR(약페어)";
                case HandTier.TOP_PAIR: return "TOP_PAIR(탑페어)";
                case HandTier.TWO_PAIR_PLUS: return "TWO_PAIR+(투페어/오버페어)";
                case HandTier.MONSTER: return "MONSTER(몬스터)";
                default: return "UNKNOWN";
            }
        }
    }
}
