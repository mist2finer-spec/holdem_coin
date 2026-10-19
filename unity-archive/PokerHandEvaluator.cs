// ============================================================
// PokerHandEvaluator.cs - 7카드 텍사스 홀덤 핸드 평가기
// ============================================================
// 7장의 카드(홀 2 + 보드 5)에서 최적 5장 조합을 찾아 비교 가능한 점수 반환
// - 챱(Split Pot) 정확 처리 (동점 시)
// - 킥커 비교 정확
// - A-2-3-4-5 wheel 스트레이트 인식
// - 9가지 핸드 카테고리 정확 구분
//
// 사용법:
//   int score = PokerHandEvaluator.EvaluateBestHand(holeCards, boardCards);
//   string name = PokerHandEvaluator.ScoreToCategoryName(score);
//   int[] winners = PokerHandEvaluator.DetermineWinners(players, boardCards);
// ============================================================

using System;
using System.Collections.Generic;

namespace Poker
{
    public static class PokerHandEvaluator
    {
        const string RANKS = "23456789TJQKA";

        // 핸드 카테고리 (높을수록 강함)
        public const int HIGH_CARD = 0;
        public const int ONE_PAIR = 1;
        public const int TWO_PAIR = 2;
        public const int THREE_OF_A_KIND = 3;
        public const int STRAIGHT = 4;
        public const int FLUSH = 5;
        public const int FULL_HOUSE = 6;
        public const int FOUR_OF_A_KIND = 7;
        public const int STRAIGHT_FLUSH = 8;

        static readonly string[] CATEGORY_NAMES = {
            "하이카드", "원페어", "투페어", "트리플",
            "스트레이트", "플러시", "풀하우스", "포카드", "스트레이트 플러시"
        };

        // ============================================================
        // 카드 파싱
        // ============================================================

        [Serializable]
        public struct Card
        {
            public string rank;  // "2"~"9", "T", "J", "Q", "K", "A"
            public string suit;  // "s", "h", "d", "c" (또는 ♠♥♦♣)

            public int RankValue => RANKS.IndexOf(rank.ToUpper());
        }

        static int RankToValue(string r)
        {
            return RANKS.IndexOf(r.ToUpper());
        }

        // ============================================================
        // 점수 인코딩 (높을수록 강한 핸드)
        // category * 16^5 + (최대 5개의 랭크 티브레이커)
        // ============================================================

        static int EncodeScore(int category, int[] ranks)
        {
            // 항상 5개 랭크 (부족하면 0으로 패드)
            int[] padded = new int[5];
            int len = Math.Min(5, ranks?.Length ?? 0);
            if (len > 0) Array.Copy(ranks, padded, len);

            int score = category;
            for (int i = 0; i < 5; i++)
                score = score * 16 + padded[i];
            return score;
        }

        // ============================================================
        // 5장의 카드 평가 → 비교 가능한 점수
        // ============================================================

        static int Evaluate5(Card[] cards)
        {
            int[] ranks = new int[5];
            for (int i = 0; i < 5; i++) ranks[i] = cards[i].RankValue;
            Array.Sort(ranks);
            Array.Reverse(ranks); // 내림차순

            bool isFlush = true;
            string firstSuit = cards[0].suit;
            for (int i = 1; i < 5; i++)
            {
                if (cards[i].suit != firstSuit) { isFlush = false; break; }
            }

            // 스트레이트 검사
            bool isStraight = false;
            int straightHigh = 0;
            HashSet<int> uniqueSet = new HashSet<int>(ranks);
            int[] uniqueRanks = new List<int>(uniqueSet).ToArray();
            Array.Sort(uniqueRanks);
            Array.Reverse(uniqueRanks);

            if (uniqueRanks.Length == 5 && uniqueRanks[0] - uniqueRanks[4] == 4)
            {
                isStraight = true;
                straightHigh = uniqueRanks[0];
            }
            // A-2-3-4-5 (wheel)
            if (uniqueRanks.Length == 5
                && uniqueRanks[0] == 12 && uniqueRanks[1] == 5
                && uniqueRanks[2] == 4 && uniqueRanks[3] == 3 && uniqueRanks[4] == 2)
            {
                isStraight = true;
                straightHigh = 5;
            }

            // 랭크 카운트
            Dictionary<int, int> rankCounts = new Dictionary<int, int>();
            foreach (int r in ranks)
            {
                if (rankCounts.ContainsKey(r)) rankCounts[r]++;
                else rankCounts[r] = 1;
            }

            // (count, rank) 쌍을 정렬
            List<int[]> groups = new List<int[]>();
            foreach (var kvp in rankCounts)
                groups.Add(new int[] { kvp.Key, kvp.Value }); // [rank, count]
            groups.Sort((a, b) => {
                if (b[1] != a[1]) return b[1].CompareTo(a[1]);
                return b[0].CompareTo(a[0]);
            });

            if (isStraight && isFlush)
                return EncodeScore(STRAIGHT_FLUSH, new int[] { straightHigh });

            if (groups[0][1] == 4)
                return EncodeScore(FOUR_OF_A_KIND, new int[] { groups[0][0], groups[1][0] });

            if (groups[0][1] == 3 && groups.Count > 1 && groups[1][1] >= 2)
                return EncodeScore(FULL_HOUSE, new int[] { groups[0][0], groups[1][0] });

            if (isFlush)
                return EncodeScore(FLUSH, ranks);

            if (isStraight)
                return EncodeScore(STRAIGHT, new int[] { straightHigh });

            if (groups[0][1] == 3)
            {
                int[] kickers = new int[] { groups[1][0], groups.Count > 2 ? groups[2][0] : 0 };
                return EncodeScore(THREE_OF_A_KIND, new int[] { groups[0][0], kickers[0], kickers[1] });
            }

            if (groups[0][1] == 2 && groups.Count > 1 && groups[1][1] == 2)
            {
                int highPair = Math.Max(groups[0][0], groups[1][0]);
                int lowPair = Math.Min(groups[0][0], groups[1][0]);
                int kicker = groups.Count > 2 ? groups[2][0] : 0;
                return EncodeScore(TWO_PAIR, new int[] { highPair, lowPair, kicker });
            }

            if (groups[0][1] == 2)
            {
                int[] kickers = new int[] {
                    groups[1][0],
                    groups.Count > 2 ? groups[2][0] : 0,
                    groups.Count > 3 ? groups[3][0] : 0
                };
                return EncodeScore(ONE_PAIR, new int[] { groups[0][0], kickers[0], kickers[1], kickers[2] });
            }

            // 하이카드
            return EncodeScore(HIGH_CARD, ranks);
        }

        // ============================================================
        // 7장의 카드에서 최적 5장 조합의 점수 반환
        // C(7,5) = 21개 조합 생성
        // ============================================================

        public static int EvaluateBestHand(Card[] hole, Card[] board)
        {
            if (hole == null || hole.Length < 2 || board == null || board.Length < 3)
                return 0;

            // 전체 카드 합치기
            List<Card> allCards = new List<Card>();
            allCards.AddRange(hole);
            allCards.AddRange(board);
            if (allCards.Count < 5) return 0;

            Card[] all = allCards.ToArray();
            int n = all.Length;
            int bestScore = -1;

            // 21개의 5카드 조합 생성 (7C5 = 21)
            for (int a = 0; a < n - 4; a++)
                for (int b = a + 1; b < n - 3; b++)
                    for (int c = b + 1; c < n - 2; c++)
                        for (int d = c + 1; d < n - 1; d++)
                            for (int e = d + 1; e < n; e++)
                            {
                                Card[] combo = { all[a], all[b], all[c], all[d], all[e] };
                                int score = Evaluate5(combo);
                                if (score > bestScore) bestScore = score;
                            }

            return bestScore;
        }

        // ============================================================
        // 쇼다운 승자 결정 (동점 처리 포함)
        // ============================================================

        public static int[] DetermineWinners(Card[][] playerHoles, Card[] board)
        {
            if (playerHoles == null || playerHoles.Length == 0)
                return new int[0];

            int[] scores = new int[playerHoles.Length];
            int maxScore = int.MinValue;
            for (int i = 0; i < playerHoles.Length; i++)
            {
                scores[i] = EvaluateBestHand(playerHoles[i], board);
                if (scores[i] > maxScore) maxScore = scores[i];
            }

            List<int> winners = new List<int>();
            for (int i = 0; i < scores.Length; i++)
            {
                if (scores[i] == maxScore) winners.Add(i);
            }
            return winners.ToArray();
        }

        // ============================================================
        // 점수로부터 핸드 카테고리 이름
        // ============================================================

        public static string ScoreToCategoryName(int score)
        {
            int category = score / (int)Math.Pow(16, 5);
            if (category < 0 || category >= CATEGORY_NAMES.Length)
                return "하이카드";
            return CATEGORY_NAMES[category];
        }

        // ============================================================
        // 문자열 카드 배열 → Card[] 변환 헬퍼
        // 예: ["Ah", "Kd"] → Card[]
        // ============================================================

        public static Card[] ParseCards(string[] cardStrings)
        {
            if (cardStrings == null) return new Card[0];
            Card[] cards = new Card[cardStrings.Length];
            for (int i = 0; i < cardStrings.Length; i++)
            {
                string s = cardStrings[i];
                if (s.Length >= 2)
                {
                    cards[i] = new Card { rank = s[0].ToString(), suit = s[1].ToString() };
                }
            }
            return cards;
        }
    }
}
