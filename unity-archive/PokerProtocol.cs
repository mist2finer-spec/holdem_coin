// ============================================================
// PokerProtocol.cs - WebSocket 통신 패킷 정의 (서버 ↔ 유니티)
// ============================================================
// 서버(poker_server.py)와 통신하는 JSON 프로토콜 매핑
// 사용법: 이 파일을 Assets/Scripts/Poker/ 폴더에 넣으세요.
// ============================================================

using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Poker
{
    // ============================================================
    // 클라이언트 → 서버 패킷
    // ============================================================

    /// <summary>
    /// 테이블 입장 요청
    /// </summary>
    [Serializable]
    public class JoinTablePacket
    {
        public string type = "JOIN_TABLE";
        public string playerId;
        public string name;
        public int buyin;
    }

    /// <summary>
    /// 유저 액션 전송
    /// action: "fold" | "call" | "check" | "raise" | "allin"
    /// tag: "FOLD" | "CHECK" | "CALL" | "RAISE" | "RE-RAISE" | "POT-RERAISE" | "ALL-IN"
    /// </summary>
    [Serializable]
    public class ActionPacket
    {
        public string type = "ACTION";
        public string action;     // "fold" | "call" | "check" | "raise" | "allin"
        public int amount;
        public string tag;        // 서버에서 표시용 (로그/말풍선)
    }

    // ============================================================
    // 서버 → 클라이언트 패킷
    // ============================================================

    [Serializable]
    public class SeatInfo
    {
        public int seatId;
        public string name;
        public bool isBot;
        public int stack;
        public int currentBet;
        public bool inHand;
        public List<string> holeCards; // ["Ah", "Kd"] 또는 ["??", "??"]
    }

    /// <summary>
    /// 메인 테이블 상태 패킷
    /// </summary>
    [Serializable]
    public class TableStatePacket
    {
        public string type = "TABLE_STATE";
        public int handNumber;
        public string phase;          // "HAND_START" | "TURN" | "SHOWDOWN"
        public int buttonSeat;
        public int activeSeatId;      // 현재 행동 중인 좌석 (-1이면 대기)
        public int totalPot;
        public List<string> boardCards;
        public bool canFold;
        public bool canRaise;
        public int callAmount;
        public int minRaise;
        public int stdReraiseTo;      // ★ 2.2x 스탠다드 리레이즈 금액 (NEW)
        public int potReraiseTo;      // ★ 팟 리레이즈 (3-Bet) 금액 (NEW)
        public int maxRaise;
        public List<SeatInfo> seats;
    }

    /// <summary>
    /// 플레이어 액션 로그 (브로드캐스트)
    /// </summary>
    [Serializable]
    public class PlayerActionPacket
    {
        public string type = "PLAYER_ACTION";
        public int seatId;
        public string name;
        public string action;   // "FOLD" | "CHECK" | "CALL" | "RAISE" | "RE-RAISE" | "POT-RERAISE" | "ALL-IN"
        public int amount;
    }

    /// <summary>
    /// 시스템 공지
    /// </summary>
    [Serializable]
    public class SystemNoticePacket
    {
        public string type = "SYSTEM_NOTICE";
        public List<string> messages;
    }

    // ============================================================
    // 5가지 액션 인덱스 (Python AdaptiveCPUBrain과 매칭)
    // ============================================================
    public static class ActionIndex
    {
        public const int FOLD = 0;
        public const int CHECK_OR_CALL = 1;
        public const int RAISE_STD = 2;       // 2.2x 스탠다드 리레이즈
        public const int RERAISE_POT = 3;     // 팟 리레이즈 (3-Bet)
        public const int ALL_IN = 4;

        /// <summary>
        /// 인덱스를 액션 문자열로 변환
        /// </summary>
        public static string ToAction(int idx)
        {
            switch (idx)
            {
                case FOLD: return "fold";
                case CHECK_OR_CALL: return "call";  // callAmount==0이면 서버가 check로 처리
                case RAISE_STD:
                case RERAISE_POT: return "raise";
                case ALL_IN: return "allin";
                default: return "fold";
            }
        }

        /// <summary>
        /// 인덱스를 태그 문자열로 변환 (UI 표시용)
        /// </summary>
        public static string ToTag(int idx, int streetRaises = 0)
        {
            switch (idx)
            {
                case FOLD: return "FOLD";
                case CHECK_OR_CALL: return "CHECK_OR_CALL";
                case RAISE_STD: return streetRaises == 0 ? "RAISE" : "RE-RAISE";
                case RERAISE_POT: return "POT-RERAISE";
                case ALL_IN: return "ALL-IN";
                default: return "FOLD";
            }
        }
    }

    // ============================================================
    // 7단계 핸드 티어 (Python HandTier와 매칭)
    // ============================================================
    public static class HandTier
    {
        public const int AIR = 0;
        public const int OVERCARDS = 1;
        public const int DRAW = 2;
        public const int WEAK_PAIR = 3;
        public const int TOP_PAIR = 4;
        public const int TWO_PAIR_PLUS = 5;
        public const int MONSTER = 6;

        public static readonly string[] Names = {
            "AIR(노히트)", "OVERCARDS(오버카드)", "DRAW(드로우)",
            "WEAK_PAIR(약페어)", "TOP_PAIR(탑페어)",
            "TWO_PAIR+(투페어/오버페어)", "MONSTER(몬스터)"
        };
    }

    // ============================================================
    // JSON 직렬화 헬퍼
    // ============================================================
    public static class PokerJson
    {
        public static string ToJson<T>(T obj)
        {
            return JsonConvert.SerializeObject(obj);
        }

        public static T FromJson<T>(string json)
        {
            return JsonConvert.DeserializeObject<T>(json);
        }
    }
}
