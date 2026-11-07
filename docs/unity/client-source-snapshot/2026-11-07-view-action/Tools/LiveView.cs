using UnityEngine;using UnityEditor;using IslandGame;
public static class LiveView {
 public static object Start(){var a=Object.FindFirstObjectByType<IslandApp>();a.server="http://127.0.0.1:18104";a.SendMessage("StartRpg",false);return Inspect();}
 public static object Inspect(){var a=Object.FindFirstObjectByType<IslandApp>();var v=a?.HudBattle?.GetComponent<Battle3DView>();return new{frame=Time.frameCount,playing=EditorApplication.isPlaying,room=(int?)a?.HudSession?.State?["room"],sequence=(int?)a?.HudSession?.State?["sequence"],state=v?.Presentation?.State.ToString(),activeGraphs=RuntimeAnimationPlayer.ActiveGraphs,createdGraphs=RuntimeAnimationPlayer.CreatedGraphs,feedback=v?.ContactFeedback?.ConsumedContacts,late=v?.ContactFeedback?.MaximumLateSeconds};}
 public static object Side(){Object.FindFirstObjectByType<IslandApp>().HudBattle.SetPresentationView(ViewMode.Side25D);return Inspect();}
 public static object Quarter(){Object.FindFirstObjectByType<IslandApp>().HudBattle.SetPresentationView(ViewMode.QuarterView);return Inspect();}
 public static object Debug(){var v=Object.FindFirstObjectByType<IslandApp>().HudBattle.GetComponent<Battle3DView>();v.ContactDebug.Visible=true;return Inspect();}
}
