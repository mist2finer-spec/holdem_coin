// ============================================================
// HoldemSubGameManager.cs - Unity 홀덤 게임 매니저
// ============================================================
// 이 파일은 Next.js 프로토타입의 usePokerTable.ts 훅을 Unity C#으로 포팅한 것입니다.
// - WebSocket 서버(poker_server.py)와 통신
// - 5가지 액션 버튼 (FOLD / CHECK_CALL / RAISE_STD / RERAISE_POT / ALL_IN)
// - 커스텀 레이즈 슬라이더
// - 10초 타이머 (자동 폴드/체크)
// - 테이블 상태 동기화
//
// 사용법:
//   1. 이 파일을 Assets/Scripts/Poker/ 폴더에 넣으세요
//   2. PokerProtocol.cs 도 같은 폴더에 넣으세요
//   3. NativeWebSocket 패키지를 설치하세요 (https://github.com/endel/NativeWebSocket)
//   4. 빈 GameObject에 HoldemSubGameManager 컴포넌트를 추가하세요
//   5. 서버 URL을 inspector에서 설정하세요 (기본: ws://localhost:8765)
// ============================================================

using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using NativeWebSocket;
using Poker;

namespace Poker
{
    public class HoldemSubGameManager : MonoBehaviour
    {
        [Header("서버 연결")]
        public string serverUrl = "ws://localhost:8765";
        public string playerName = "용사";
        public int buyin = 20000;

        [Header("타이머")]
        public float decisionTimeout = 10f;

        // WebSocket
        private WebSocket websocket;

        // 현재 테이블 상태
        public TableStatePacket LatestState { get; private set; }
        public bool IsUserTurn { get; private set; }
        public float RemainingTime { get; private set; }

        // 액션 대기
        private bool waitingForUserAction = false;
        private float turnStartTime;

        // ============================================================
        // Unity 라이프사이클
        // ============================================================

        async void Start()
        {
            await ConnectToServer();
        }

        void Update()
        {
            #if !UNITY_WEBGL || UNITY_EDITOR
            if (websocket != null)
                websocket.DispatchMessageQueue();
            #endif

            // 타이머 업데이트
            if (waitingForUserAction)
            {
                RemainingTime = decisionTimeout - (Time.time - turnStartTime);
                if (RemainingTime <= 0)
                {
                    // 시간 초과: 자동 액션
                    TimeoutAction();
                }
            }
        }

        async void OnApplicationQuit()
        {
            if (websocket != null)
                await websocket.Close();
        }

        // ============================================================
        // WebSocket 연결
        // ============================================================

        async System.Threading.Tasks.Task ConnectToServer()
        {
            websocket = new WebSocket(serverUrl);

            websocket.OnOpen += () =>
            {
                Debug.Log("[Holdem] WebSocket 연결 성공");
                SendJoinTable();
            };

            websocket.OnMessage += (bytes) =>
            {
                var json = System.Text.Encoding.UTF8.GetString(bytes);
                HandleServerMessage(json);
            };

            websocket.OnError += (e) =>
            {
                Debug.LogError($"[Holdem] WebSocket 에러: {e}");
            };

            websocket.OnClose += (e) =>
            {
                Debug.Log($"[Holdem] WebSocket 종료: {e}");
            };

            await websocket.Connect();
        }

        void SendJoinTable()
        {
            var packet = new JoinTablePacket
            {
                playerId = "user_" + System.Guid.NewGuid().ToString("N").Substring(0, 8),
                name = playerName,
                buyin = buyin
            };
            SendPacket(packet);
        }

        void SendPacket<T>(T packet)
        {
            if (websocket != null && websocket.State == WebSocketState.Open)
            {
                string json = PokerJson.ToJson(packet);
                websocket.SendText(json);
            }
        }

        // ============================================================
        // 서버 메시지 처리
        // ============================================================

        void HandleServerMessage(string json)
        {
            try
            {
                // 먼저 type 필드를 확인
                var temp = JsonUtility.FromJson<PacketTypeChecker>(json);
                if (temp == null || string.IsNullOrEmpty(temp.type)) return;

                switch (temp.type)
                {
                    case "TABLE_STATE":
                        var state = PokerJson.FromJson<TableStatePacket>(json);
                        OnTableState(state);
                        break;

                    case "PLAYER_ACTION":
                        var action = PokerJson.FromJson<PlayerActionPacket>(json);
                        OnPlayerAction(action);
                        break;

                    case "SYSTEM_NOTICE":
                        var notice = PokerJson.FromJson<SystemNoticePacket>(json);
                        OnSystemNotice(notice);
                        break;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[Holdem] 메시지 파싱 에러: {e.Message}\nJSON: {json}");
            }
        }

        [Serializable]
        private class PacketTypeChecker { public string type; }

        void OnTableState(TableStatePacket state)
        {
            LatestState = state;
            IsUserTurn = (state.activeSeatId >= 0 && state.seats != null
                          && state.activeSeatId < state.seats.Count
                          && !state.seats[state.activeSeatId].isBot);

            if (IsUserTurn && !waitingForUserAction)
            {
                waitingForUserAction = true;
                turnStartTime = Time.time;
                RemainingTime = decisionTimeout;
            }
            else if (!IsUserTurn)
            {
                waitingForUserAction = false;
            }

            // Unity 이벤트 트리거 (UI 갱신용)
            OnStateChanged?.Invoke(state);
        }

        void OnPlayerAction(PlayerActionPacket action)
        {
            Debug.Log($"[Holdem] {action.name}: {action.action} {action.amount}");
            OnActionLog?.Invoke(action);
        }

        void OnSystemNotice(SystemNoticePacket notice)
        {
            if (notice.messages != null)
            {
                foreach (var msg in notice.messages)
                    Debug.Log($"[Holdem] {msg}");
            }
            OnNotice?.Invoke(notice);
        }

        // ============================================================
        // 5가지 메인 액션 버튼 핸들러 (UI 버튼에 연결)
        // ============================================================

        /// <summary>0: FOLD 버튼</summary>
        public async void OnClickFold()
        {
            await SendActionAsync(ActionIndex.ToAction(ActionIndex.FOLD), 0, "FOLD");
        }

        /// <summary>1: CHECK_OR_CALL 버튼 (callAmount가 0이면 check, 아니면 call)</summary>
        public async void OnClickCheckOrCall()
        {
            if (LatestState == null) return;
            int amt = LatestState.callAmount;
            string tag = amt == 0 ? "CHECK" : "CALL";
            await SendActionAsync(ActionIndex.ToAction(ActionIndex.CHECK_OR_CALL), amt, tag);
        }

        /// <summary>2: RAISE_STD 버튼 (2.2x 스탠다드 리레이즈)</summary>
        public async void OnClickStdReraise()
        {
            if (LatestState == null || !LatestState.canRaise) return;
            int amt = LatestState.stdReraiseTo > 0
                ? LatestState.stdReraiseTo
                : LatestState.minRaise;
            string tag = "RAISE";
            await SendActionAsync(ActionIndex.ToAction(ActionIndex.RAISE_STD), amt, tag);
        }

        /// <summary>3: RERAISE_POT 버튼 (팟 리레이즈 / 3-Bet)</summary>
        public async void OnClickPotReraise()
        {
            if (LatestState == null || !LatestState.canRaise) return;
            int amt = LatestState.potReraiseTo > 0
                ? LatestState.potReraiseTo
                : LatestState.maxRaise;
            await SendActionAsync(ActionIndex.ToAction(ActionIndex.RERAISE_POT), amt, "POT-RERAISE");
        }

        /// <summary>4: ALL_IN 버튼</summary>
        public async void OnClickAllIn()
        {
            if (LatestState == null) return;
            await SendActionAsync(ActionIndex.ToAction(ActionIndex.ALL_IN), LatestState.maxRaise, "ALL-IN");
        }

        // ============================================================
        // 커스텀 금액 (슬라이더)
        // ============================================================

        /// <summary>커스텀 금액으로 레이즈 (슬라이더 값)</summary>
        public async void OnClickCustomRaise(int amount)
        {
            if (LatestState == null || !LatestState.canRaise) return;
            int clamped = Mathf.Max(LatestState.minRaise, Mathf.Min(amount, LatestState.maxRaise));
            await SendActionAsync("raise", clamped, "RAISE");
        }

        // ============================================================
        // 퀵 베팅 (1/3, 1/2, 3/4, 1:1 pot)
        // ============================================================

        public async void OnClickBetThirdPot()
        {
            int pot = LatestState?.totalPot ?? 0;
            int callAmt = LatestState?.callAmount ?? 0;
            int target = callAmt + Mathf.FloorToInt(pot * 1f / 3f);
            await OnClickCustomRaise(target);
        }

        public async void OnClickBetHalfPot()
        {
            int pot = LatestState?.totalPot ?? 0;
            int callAmt = LatestState?.callAmount ?? 0;
            int target = callAmt + Mathf.FloorToInt(pot * 1f / 2f);
            await OnClickCustomRaise(target);
        }

        public async void OnClickBetThreeQuarterPot()
        {
            int pot = LatestState?.totalPot ?? 0;
            int callAmt = LatestState?.callAmount ?? 0;
            int target = callAmt + Mathf.FloorToInt(pot * 3f / 4f);
            await OnClickCustomRaise(target);
        }

        public async void OnClickBetPotSized()
        {
            int pot = LatestState?.totalPot ?? 0;
            int callAmt = LatestState?.callAmount ?? 0;
            int target = callAmt + pot;
            await OnClickCustomRaise(target);
        }

        public async void OnClickMinRaise()
        {
            if (LatestState == null) return;
            await OnClickCustomRaise(LatestState.minRaise);
        }

        // ============================================================
        // 액션 전송 공통
        // ============================================================

        async System.Threading.Tasks.Task SendActionAsync(string action, int amount, string tag)
        {
            if (!waitingForUserAction || LatestState == null)
            {
                Debug.LogWarning("[Holdem] 유저 턴이 아닌데 액션 시도");
                return;
            }

            var packet = new ActionPacket
            {
                action = action,
                amount = amount,
                tag = tag
            };

            SendPacket(packet);
            waitingForUserAction = false;
            IsUserTurn = false;
            Debug.Log($"[Holdem] 액션 전송: {action} {amount} ({tag})");
        }

        /// <summary>타임아웃 시 자동 액션 (체크 가능하면 체크, 아니면 폴드)</summary>
        void TimeoutAction()
        {
            if (LatestState == null) return;
            int callAmt = LatestState.callAmount;
            if (callAmt == 0)
            {
                Debug.Log("[Holdem] ⏱ 시간 초과! 자동 CHECK");
                _ = SendActionAsync("call", 0, "CHECK");
            }
            else
            {
                Debug.Log("[Holdem] ⏱ 시간 초과! 자동 FOLD");
                _ = SendActionAsync("fold", 0, "FOLD");
            }
        }

        // ============================================================
        // Unity 이벤트 (UI에서 구독)
        // ============================================================
        public event Action<TableStatePacket> OnStateChanged;
        public event Action<PlayerActionPacket> OnActionLog;
        public event Action<SystemNoticePacket> OnNotice;
    }
}
