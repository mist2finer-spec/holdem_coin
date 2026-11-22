using UnityEditor;
using UnityEngine;

namespace IslandGame.EditorTools {
 // Boss beams test (2026-11-22): start the kit zone-10 boss at 520 / 2000 HP so the 25 % last-stand ring is one combo away
 // (dev pref island.dev.bossStartHP, read by Battle3DAssets.WithRunOptions on the next boot). Clear = the normal 2000.
 public static class BossBeamDevMenu {
  [MenuItem("Island/Dev/Boss start HP 520 (last-stand beams)")] static void Low(){Battle3DAssets.DevBossStartHP=520;Debug.Log("island.dev.bossStartHP = 520 (next boss boot)");}
  [MenuItem("Island/Dev/Boss start HP default")] static void Clear(){Battle3DAssets.DevBossStartHP=-1;Debug.Log("island.dev.bossStartHP cleared");}
 }
}
