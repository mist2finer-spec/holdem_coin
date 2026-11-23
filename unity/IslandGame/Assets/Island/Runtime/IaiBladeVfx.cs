using System;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace IslandGame {
 public enum IaiPalette { A, B }

 // QA only: GC.Alloc sample count of one Battle3DView.UpdateContact (hero effect + feedback router), per frame.
 // Same method as O1FrameAllocTests and the Test Framework AllocatingGCMemory constraint: the "GC.Alloc" recorder
 // filtered to this thread around the call. Off by default (one bool test per frame).
 public static class IaiAllocProbe {
  public static bool On;
  public static int LastCount { get; private set; }
  static UnityEngine.Profiling.Recorder recorder;
  public static void Begin() { if (!On) return; if (recorder == null) recorder = UnityEngine.Profiling.Recorder.Get("GC.Alloc"); recorder.enabled = false; recorder.FilterToCurrentThread(); recorder.enabled = true; }
  public static void End() { if (!On || recorder == null) return; recorder.enabled = false; recorder.CollectFromAllThreads(); LastCount = recorder.sampleBlockCount; }
 }

 // V2: basic attack VFX of the kit hero (pink-iai) in the normal zones. Replaces the gold crescent, the decorative
 // tip smear and the orange contact spark for that hero only (Battle3DView decides; ReferenceCombatVfx /
 // CombatFeedbackRouter keep flash, shake, sound and every skill effect).
 // Layers: blade arc (R1+R2+R0), hit star (R3 / R4), embers (R6), 3rd hit line / ground glow / dust (R7 / R9 / R5),
 // sheathe glint (R8). Materials: maintenance/vfx-basic-attack-20261119/art/out_v1 (README_KO.md).
 // Timing: stars, embers, 3rd hit layers and glints from kernel values (fx contactAt, hitstopUntil, recover start / sheatheAt);
 // the arc from the per-row clip window ArcClipFrom/To (V2b), falling back to the kernel timeline.active window.
 // The arc is built from the blade bone the hero pose already sampled through ClipAt this frame, so it follows the
 // tempo stage by construction. All layers run on one effect clock that does not advance during the kernel hitstop.
 // Every buffer, mesh and material is made once; the snapshot is read by value each frame and never kept.
 public sealed class IaiBladeVfx : IDisposable {
  // The one colour switch. A = 청람 유리 (R0_ramp_A), B = 홍먹 (R0_ramp_B). Default B (user decision 2026-11-19).
  public static IaiPalette Palette = IaiPalette.B;
  // Off = the hero keeps the old effect (crescent, smear, spark). QA uses it for the before/after counts.
  public static bool Enabled = true;
  // QA only (never set by the game): replace the profile mode / the whole profile text for the next effect built, so a
  // side-by-side capture or a placement trial needs no asset write. null = Resources/IaiVfx/IaiSlashProfile.json as it is.
  public static string ModeOverride, ProfileOverride;

  const float Frame = 1f / 60;
  // README hold frames (60 fps) and plate sizes in standing heights (H).
  static readonly int[] StarHold = { 1, 2, 2, 3, 3, 4 }, HeavyHold = { 1, 2, 2, 2, 3, 3, 4, 5 }, DustHold = { 3, 4, 5, 6, 7, 9, 12, 15 }, GlintHold = { 1, 2, 2, 3 };
  static readonly float[] DustStage = { 224 / 255f, 222 / 255f, 213 / 255f, 204 / 255f, 187 / 255f, 160 / 255f, 130 / 255f, 104 / 255f };
  const float StarPlate = .48f, HeavyPlate = .60f, GlintPlate = .46f, DustWidth = 1.0f, LineWidth = 2.9f, PoolWidth = 1.8f;
  // Look parameters (not timing): the arc holds its full shape a few frames after the swing, then breaks up.
  const float ArcHold = 4 * Frame, ArcBreak = .22f, ArcOuter = 1.06f;
  // V2b arc window, per row (1st, 2nd, 3rd): clip seconds in which the blade is SEEN swinging. This is a property of the
  // clip, not of the hit: it is compared with the clip time the hero pose shows (HeroSampleTime), which already carries the
  // tempo clipMap and the hitstop hold. Stars, hitstop and sound stay on the kernel values (contactAt, hitstopUntil).
  // A row without a value (NaN) falls back to the kernel active window (timeline.active[0]).
  // First values: tip 40 cm or more in front of the body (T0 / REVIEW_T1 3). Final values: REPORT_V2b.
  static readonly float[] ArcClipFrom = { .330f, .200f, .470f }, ArcClipTo = { .430f, .310f, .545f };
  // Band from this fraction of the blade to just past the tip, per hit.
  static readonly float[] ArcInner = { .70f, .60f, .45f };
  // Least band width across the path on screen (H), per hit; the mask then tapers it (thin tail, full head).
  static readonly float[] ArcMinFace = { .14f, .18f, .26f };
  // The band is not drawn until the tip has swept ArcMinLength (H); it then widens to full by ArcMinLength + ArcGrowLength.
  const float ArcMinLength = .10f, ArcGrowLength = .25f;
  // While the tip has not yet moved this far (H) from the first key, the first key slides with it (a blade that waits at the
  // start of the window starts its arc where the real swing starts).
  const float ArcStartStep = .12f;
  static float RowV(int row) => 1 - (row + .5f) / 4; // 0 = 1st hit, 1 = 2nd, 2 = 3rd, 3 = hit row

  // DBFZ-style arc life (2026-11-21), values in Resources/IaiVfx/IaiSlashProfile.json. Read from the DBFZ Trunks standing K
  // particle (reverse_eng): one sweep face spawned once at the contact pose, a cols x rows flipbook advanced linearly over
  // its life, colour multiplied up over life (HDR), alpha held for the first part of the life then down to 0, attached to
  // the character (local space). Missing file or "mode": "legacy" = the V2b arc above (hold ArcHold, grain erosion ArcBreak).
  // Fixed-shape slash per sword motion (modes "C" and "ember", 2026-11-21). key = kernel row (iai1..iai3) or "skill" (the one
  // kit skill clip every skill slot plays). window = clip seconds in which the blade is seen swinging (NaN = the row's
  // ArcClipFrom/To). C: which of the three art_helper arcs, its offset (H), rotation (deg) and scale, in a frame whose +X is the
  // hero facing, +Y up, Z world depth. ember: pivot (H), rotation, Size and the playback values of the EmberSlash shader.
  sealed class MotionSlash {
   public string key, clip; public float from = float.NaN, to = float.NaN;
   public int arc = 1; public Vector3 cPos, cRot; public float cScale = 1, cRoll; public bool cMirror;
   public Vector3 ePivot = new Vector3(.3f, .55f, 0), eRot; public float eRoll, eSize = .75f, eDuration = .6f, eSweep = .3f, ePersist = .5f, eIntensity = 1, eGlow = 0, eFloor = -1; public Color eTint = Color.white; public bool eMirror;
  }
  // Which of the V2 extra layers a fixed mode keeps (the C art is arc + flash only; ember has its own sparks and flare).
  sealed class Extras { public bool stars, embers, finish, glint = true; }

  sealed class SlashProfile {
   public bool flip, grow, onHitstop = true, local = true;
   // "C" (art_helper 백광 플립북) or "ember" (EmberSlash package): fixed-shape slash on every kit sword motion.
   public bool c, ember; public string modeName = "legacy";
   public string cTexture = "IaiVfx/C/C_arc_flip_2x4", cFlash = "IaiVfx/C/C_hit_flash"; public string[] cMeshes = { "IaiVfx/C/C_arc1_draw", "IaiVfx/C/C_arc2_fall", "IaiVfx/C/C_arc3_finish" };
   public int cCols = 2, cRows = 4; public Vector2 cInset = new Vector2(1 / 1024f, 1 / 256f); public float cHeightM = 1.217f, cHead0 = .6f, cHead1 = 1;
   public int[] cHold = { 5, 5, 8 }, cDissolve = { 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 7, 7 };
   public float cFlashSize = 1.3f, cFlashToward = .3f; public float[] cFlashScale = { .55f, .85f, 1, 1.08f, 1.12f, 1.15f, 1.17f, 1.18f, 1.19f }, cFlashAlpha = { 1, 1, 1, .85f, .65f, .45f, .28f, .14f, .05f };
   public string cFlashAt = "hit"; public Vector2[] cFlashCenter = { new Vector2(.95f, .45f), new Vector2(1, .35f), new Vector2(1.25f, .55f) };
   public string emberPrefab = "IaiVfx/EmberSlash_Island"; public int emberBudgetOffLevel = 1;
   public Extras cExtras = new Extras(), emberExtras = new Extras();
   public readonly System.Collections.Generic.List<MotionSlash> motions = new System.Collections.Generic.List<MotionSlash>();
   public MotionSlash Motion(string key) { foreach (var m in motions) if (m.key == key) return m; return null; }
   static Vector3 V3(JToken t, Vector3 d) => t is JArray a && a.Count >= 3 ? new Vector3((float)a[0], (float)a[1], (float)a[2]) : d;
   static float[] Fs(JToken t, float[] d) { if (!(t is JArray a) || a.Count == 0) return d; var r = new float[a.Count]; for (int i = 0; i < a.Count; i++) r[i] = (float)a[i]; return r; }
   static int[] Is(JToken t, int[] d) { if (!(t is JArray a) || a.Count == 0) return d; var r = new int[a.Count]; for (int i = 0; i < a.Count; i++) r[i] = (int)a[i]; return r; }
   static void ReadExtras(JToken t, Extras e) { if (t == null) return; e.stars = (bool?)t["stars"] ?? e.stars; e.embers = (bool?)t["embers"] ?? e.embers; e.finish = (bool?)t["finish"] ?? e.finish; e.glint = (bool?)t["glint"] ?? e.glint; }
   void ReadFixed(JObject j) {
    var c = j["C"];
    if (c != null) {
     cTexture = (string)c["texture"] ?? cTexture; cFlash = (string)c["flash"] ?? cFlash; if (c["meshes"] is JArray ms && ms.Count == 3) cMeshes = new[] { (string)ms[0], (string)ms[1], (string)ms[2] };
     cCols = Mathf.Max(1, (int?)c["cols"] ?? cCols); cRows = Mathf.Max(1, (int?)c["rows"] ?? cRows); if (c["cellInset"] is JArray i && i.Count >= 2) cInset = new Vector2((float)i[0], (float)i[1]);
     cHeightM = Mathf.Max(.1f, (float?)c["heightM"] ?? cHeightM); if (c["growHead"] is JArray g && g.Count >= 2) { cHead0 = (float)g[0]; cHead1 = (float)g[1]; }
     cHold = Is(c["holdFrames"], cHold); if (cHold.Length < 3) cHold = new[] { 5, 5, 8 }; cDissolve = Is(c["dissolveCells"], cDissolve);
     var f = c["flashFx"]; if (f != null) { cFlashSize = (float?)f["sizeH"] ?? cFlashSize; cFlashToward = (float?)f["towardCameraM"] ?? cFlashToward; cFlashScale = Fs(f["scale"], cFlashScale); cFlashAlpha = Fs(f["alpha"], cFlashAlpha); cFlashAt = (string)f["at"] ?? cFlashAt;
      if (f["centerH"] is JArray cc && cc.Count == 3) for (int k = 0; k < 3; k++) cFlashCenter[k] = new Vector2((float)cc[k][0], (float)cc[k][1]); }
     ReadExtras(c["extras"], cExtras);
    }
    var e = j["ember"];
    if (e != null) { emberPrefab = (string)e["prefab"] ?? emberPrefab; emberBudgetOffLevel = (int?)e["budgetOffLevel"] ?? emberBudgetOffLevel; ReadExtras(e["extras"], emberExtras); }
    if (j["motions"] is JObject mo) foreach (var p in mo.Properties()) {
     var v = p.Value; var m = new MotionSlash { key = p.Name, clip = (string)v["clip"] };
     if (v["window"] is JArray w && w.Count >= 2 && w[0].Type != JTokenType.Null) { m.from = (float)w[0]; m.to = (float)w[1]; }
     var mc = v["C"]; if (mc != null) { m.arc = Mathf.Clamp((int?)mc["arc"] ?? 1, 1, 3); m.cPos = V3(mc["posH"], m.cPos); m.cRot = V3(mc["rotDeg"], m.cRot); m.cScale = (float?)mc["scale"] ?? 1; m.cRoll = (float?)mc["rollDeg"] ?? 0; m.cMirror = (bool?)mc["mirror"] ?? false; }
     var me = v["ember"]; if (me != null) {
      m.ePivot = V3(me["pivotH"], m.ePivot); m.eRot = V3(me["rotDeg"], m.eRot); m.eRoll = (float?)me["rollDeg"] ?? 0; m.eSize = (float?)me["size"] ?? m.eSize; m.eDuration = Mathf.Max(.05f, (float?)me["duration"] ?? m.eDuration);
      m.eSweep = (float?)me["sweep"] ?? m.eSweep; m.ePersist = (float?)me["persistence"] ?? m.ePersist; m.eIntensity = (float?)me["intensity"] ?? m.eIntensity; m.eGlow = (float?)me["groundGlow"] ?? m.eGlow;
      m.eFloor = me["floorDistance"] == null || me["floorDistance"].Type == JTokenType.String ? -1 : (float)me["floorDistance"]; m.eTint = Rgb(me["tint"], m.eTint); m.eMirror = (bool?)me["mirror"] ?? false;
     }
     motions.Add(m);
    }
   }
   public float life = .165f, subImageEnd = 7.99f, hold = .25f; public int cols = 4, rows = 2; public Vector2 inset = new Vector2(4 / 512f, 4 / 128f);
   public Color start = Color.white, end = new Color(2, 2, 2, 1); public string texture = "IaiVfx/R10_arc_flip";
   public int Cells => cols * rows;
   static Color Rgb(JToken t, Color d) => t is JArray a && a.Count >= 3 ? new Color((float)a[0], (float)a[1], (float)a[2], 1) : d;
   public static SlashProfile Load() {
    var p = new SlashProfile(); string json = ProfileOverride; if (json == null) { var text = Resources.Load<TextAsset>("IaiVfx/IaiSlashProfile"); if (!text) return p; json = text.text; }
    try {
     var j = JObject.Parse(json); string mode = ModeOverride ?? (string)j["mode"] ?? "legacy"; p.modeName = mode;
     p.flip = mode == "flipbook" || mode == "dbfz"; p.c = mode == "C" || mode == "c"; p.ember = mode == "ember"; if (p.c || p.ember) p.ReadFixed(j);
     p.texture = (string)j["texture"] ?? p.texture; p.cols = Mathf.Max(1, (int?)j["cols"] ?? p.cols); p.rows = Mathf.Max(1, (int?)j["rows"] ?? p.rows);
     if (j["cellInset"] is JArray i && i.Count >= 2) p.inset = new Vector2((float)i[0], (float)i[1]);
     p.life = Mathf.Max(Frame, (float?)j["life"] ?? p.life); p.subImageEnd = (float?)j["subImageEnd"] ?? p.subImageEnd; p.hold = Mathf.Clamp((float?)j["alphaHold"] ?? p.hold, 0, .99f);
     p.start = Rgb(j["colorStart"], p.start); p.end = Rgb(j["colorEnd"], p.end);
     p.grow = (bool?)j["growDuringSwing"] ?? p.grow; p.onHitstop = (bool?)j["spawnOnHitstop"] ?? p.onHitstop; p.local = (bool?)j["localSpace"] ?? p.local;
    } catch (Exception e) { Debug.LogWarning("IaiBladeVfx: IaiSlashProfile.json unreadable, legacy arc: " + e.Message); p.flip = p.c = p.ember = false; p.modeName = "legacy"; }
    return p;
   }
  }

  sealed class Batch {
   readonly GameObject go; readonly Mesh mesh; readonly MeshRenderer renderer; readonly Vector3[] v; readonly Vector2[] uv; readonly Color[] c; readonly int cap; int count, last;
   public readonly Material material;
   public Batch(Transform parent, string name, Material m, int quads) {
    material = m; cap = quads; v = new Vector3[quads * 4]; uv = new Vector2[quads * 4]; c = new Color[quads * 4];
    var tris = new int[quads * 6]; for (int i = 0; i < quads; i++) { int k = i * 6, q = i * 4; tris[k] = q; tris[k + 1] = q + 1; tris[k + 2] = q + 2; tris[k + 3] = q; tris[k + 4] = q + 2; tris[k + 5] = q + 3; }
    go = new GameObject(name); go.layer = 30; go.transform.SetParent(parent, false);
    mesh = new Mesh { name = name }; mesh.MarkDynamic(); mesh.vertices = v; mesh.uv = uv; mesh.colors = c; mesh.triangles = tris; mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 4000);
    go.AddComponent<MeshFilter>().sharedMesh = mesh; renderer = go.AddComponent<MeshRenderer>(); renderer.sharedMaterial = m;
    renderer.shadowCastingMode = ShadowCastingMode.Off; renderer.receiveShadows = false; renderer.lightProbeUsage = LightProbeUsage.Off; renderer.reflectionProbeUsage = ReflectionProbeUsage.Off; renderer.enabled = false;
   }
   public int Count => count;
   public void Begin() { count = 0; }
   // rect = (u, v, w, h) of the cell; right/up are half extents.
   public void Quad(Vector3 center, Vector3 right, Vector3 up, Vector4 rect, Color col) {
    if (count >= cap) return; int k = count++ * 4;
    v[k] = center - right - up; v[k + 1] = center - right + up; v[k + 2] = center + right + up; v[k + 3] = center + right - up;
    uv[k] = new Vector2(rect.x, rect.y); uv[k + 1] = new Vector2(rect.x, rect.y + rect.w); uv[k + 2] = new Vector2(rect.x + rect.z, rect.y + rect.w); uv[k + 3] = new Vector2(rect.x + rect.z, rect.y);
    c[k] = c[k + 1] = c[k + 2] = c[k + 3] = col;
   }
   public void End() {
    for (int i = count * 4; i < last * 4; i++) v[i] = Vector3.zero;
    if (count > 0 || last > 0) { mesh.vertices = v; mesh.uv = uv; mesh.colors = c; }
    renderer.enabled = count > 0; last = count;
   }
   public void Dispose() { if (go) UnityEngine.Object.Destroy(go); if (mesh) UnityEngine.Object.Destroy(mesh); }
  }

  // Blade sweep: one key per shown frame inside the arc window (guard point, blade direction, blade length).
  // Between keys the blade is swung, not slid: the guard follows a Catmull-Rom path and the blade direction is
  // interpolated on the unit sphere, so a fast swing with few frames still makes a round crescent instead of a polygon.
  sealed class Arc {
   public const int Keys = 40, Sub = 8, Columns = (Keys - 1) * Sub + 1;
   // Keys as recorded: world space, or (local) in the space of the hero root. Draw reads G / D / L, the world keys of this frame.
   readonly Vector3[] guard = new Vector3[Keys], dir = new Vector3[Keys]; readonly float[] len = new float[Keys];
   readonly Vector3[] wGuard = new Vector3[Keys], wDir = new Vector3[Keys]; readonly float[] wLen = new float[Keys];
   Vector3[] G, D; float[] L;
   public int keys, attack, row; public bool recording, live; public float end;
   // Flipbook life (SlashProfile): born = the sweep face exists (contact pose); bornAt on the effect clock.
   public bool born; public float bornAt; public Transform space;
   static readonly int CellId = Shader.PropertyToID("_Cell"), LifeColorId = Shader.PropertyToID("_LifeColor");
   readonly MaterialPropertyBlock block = new MaterialPropertyBlock();
   readonly GameObject go; readonly Mesh mesh; readonly MeshRenderer renderer; readonly Vector3[] v = new Vector3[Columns * 2]; readonly Vector2[] uv = new Vector2[Columns * 2]; readonly Color[] c = new Color[Columns * 2];
   readonly float[] along = new float[Columns]; readonly Vector3[] across = new Vector3[Columns];
   public Arc(Transform parent, Material m, int index) {
    G = guard; D = dir; L = len;
    var tris = new int[(Columns - 1) * 6]; for (int i = 0; i < Columns - 1; i++) { int k = i * 6, q = i * 2; tris[k] = q; tris[k + 1] = q + 1; tris[k + 2] = q + 3; tris[k + 3] = q; tris[k + 4] = q + 3; tris[k + 5] = q + 2; }
    go = new GameObject("Iai blade arc " + index); go.layer = 30; go.transform.SetParent(parent, false);
    mesh = new Mesh { name = "Iai blade arc " + index }; mesh.MarkDynamic(); mesh.vertices = v; mesh.uv = uv; mesh.colors = c; mesh.triangles = tris; mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 4000);
    go.AddComponent<MeshFilter>().sharedMesh = mesh; renderer = go.AddComponent<MeshRenderer>(); renderer.sharedMaterial = m;
    renderer.shadowCastingMode = ShadowCastingMode.Off; renderer.receiveShadows = false; renderer.lightProbeUsage = LightProbeUsage.Off; renderer.reflectionProbeUsage = ReflectionProbeUsage.Off; renderer.enabled = false;
   }
   public void Kill() { live = recording = born = false; keys = 0; renderer.enabled = false; }
   public void Hide() { renderer.enabled = false; }
   public void SetMaterial(Material m) { renderer.sharedMaterial = m; }
   Vector3 Tip(int i) => G[i] + D[i] * (L[i] * ArcOuter);
   Vector3 Edge(int i, float f) => G[i] + D[i] * (L[i] * f);
   Vector3 RecordedTip(int i) => guard[i] + dir[i] * (len[i] * ArcOuter);
   const float WideTurn = -.34f; // cos 110 deg
   // World keys for this frame: the recorded keys as they are, or carried along with the hero root (local space).
   void Place() {
    if (!space) { G = guard; D = dir; L = len; return; }
    var m = space.localToWorldMatrix;
    for (int i = 0; i < keys; i++) { wGuard[i] = m.MultiplyPoint3x4(guard[i]); var d = m.MultiplyVector(dir[i]); float s = d.magnitude; wDir[i] = s > 1e-6f ? d / s : dir[i]; wLen[i] = len[i] * s; }
    G = wGuard; D = wDir; L = wLen;
   }
   public void Add(Vector3 g, Vector3 tip, float H) {
    if (space) { g = space.InverseTransformPoint(g); tip = space.InverseTransformPoint(tip); H /= Mathf.Max(1e-4f, Mathf.Abs(space.lossyScale.y)); }
    var d = tip - g; float l = d.magnitude; if (l < 1e-4f) return; d /= l;
    var b = g + d * (l * ArcOuter);
    if (keys > 0 && (b - RecordedTip(keys - 1)).sqrMagnitude < 1e-6f && (g - guard[keys - 1]).sqrMagnitude < 1e-6f) return; // frozen pose (hitstop): no new key
    if (keys == 1 && (b - RecordedTip(0)).sqrMagnitude < ArcStartStep * H * ArcStartStep * H) { guard[0] = g; dir[0] = d; len[0] = l; return; }
    if (keys == Keys) { Array.Copy(guard, 1, guard, 0, Keys - 1); Array.Copy(dir, 1, dir, 0, Keys - 1); Array.Copy(len, 1, len, 0, Keys - 1); keys--; }
    guard[keys] = g; dir[keys] = d; len[keys] = l; keys++;
   }
   public Vector3 TipTangent { get { if (keys < 2) return Vector3.zero; Place(); return Tip(keys - 1) - Tip(keys - 2); } }
   static Vector3 CR(Vector3 p0, Vector3 p1, Vector3 p2, Vector3 p3, float t) { float t2 = t * t, t3 = t2 * t; return .5f * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3); }
   // Flipbook cell and colour over life for this arc's renderer (only the _IAI_FLIP material reads them).
   public void Life(float cell, Color color) { block.SetFloat(CellId, cell); block.SetColor(LifeColorId, color); renderer.SetPropertyBlock(block); }
   public void Draw(float rowV, float opacity, float erode, float H, Vector3 camForward) {
    if (keys < 2) { renderer.enabled = false; return; }
    Place();
    int cols = (keys - 1) * Sub + 1; float inner = ArcInner[row];
    // Pass 1: swing the blade between keys; outer edge in v[k + 1], inner edge in v[k], length along the outer edge.
    for (int j = 0; j < cols; j++) {
     int k = j * 2, seg = Mathf.Min(j / Sub, keys - 2); float t = (j - seg * Sub) / (float)Sub;
     int i0 = Mathf.Max(seg - 1, 0), i3 = Mathf.Min(seg + 2, keys - 1);
     if (row == 2 && Vector3.Dot(D[seg], D[seg + 1]) < WideTurn) {
      // 3rd hit only: a turn this wide in one frame is its draw around the body (behind -> front); seen from the side it is a
      // flat sweep, so the edges follow the recorded points (Catmull-Rom) instead of rotating the blade the short way round.
      v[k + 1] = CR(Tip(i0), Tip(seg), Tip(seg + 1), Tip(i3), t); v[k] = CR(Edge(i0, inner), Edge(seg, inner), Edge(seg + 1, inner), Edge(i3, inner), t);
     } else {
      var g = CR(G[i0], G[seg], G[seg + 1], G[i3], t);
      var d = CR(D[i0], D[seg], D[seg + 1], D[i3], t); float m = d.magnitude; d = m > .2f ? d / m : Vector3.Slerp(D[seg], D[seg + 1], t);
      float l = Mathf.Lerp(L[seg], L[seg + 1], t);
      v[k + 1] = g + d * (l * ArcOuter); v[k] = g + d * (l * inner);
     }
     along[j] = j == 0 ? 0 : along[j - 1] + (v[k + 1] - v[k - 1]).magnitude;
    }
    float length = along[cols - 1];
    float thick = Mathf.Clamp01((length / H - ArcMinLength) / ArcGrowLength); if (thick <= 0) { renderer.enabled = false; return; }
    // Minimum face on screen: a blade swung in the ground plane (3rd hit) has both edges on one line seen from the side.
    // Push the inner edge across the path (in the camera plane) to at least ArcMinFace[row] H, on one side for the whole arc:
    // the side the blade already shows, or toward the ground when it shows none.
    float minFace = ArcMinFace[row] * H, side = 0;
    for (int j = 0; j < cols; j++) {
     var tan = v[Mathf.Min(j + Sub, cols - 1) * 2 + 1] - v[Mathf.Max(j - Sub, 0) * 2 + 1]; var p = Vector3.Cross(camForward, tan); // tangent over one key each way: no zigzag at a sharp turn
     across[j] = p.sqrMagnitude > 1e-12f ? p.normalized : Vector3.zero; side += Vector3.Dot(v[j * 2] - v[j * 2 + 1], across[j]);
    }
    if (Mathf.Abs(side) < .02f * H * cols) { side = 0; for (int j = 0; j < cols; j++) side += Vector3.Dot(Vector3.down, across[j]); }
    float sign = side < 0 ? -1 : 1;
    for (int j = 0; j < cols; j++) { var n = across[j] * sign; float face = Vector3.Dot(v[j * 2] - v[j * 2 + 1], n); if (face < minFace) v[j * 2] += n * (minFace - face); }
    // Pass 2: thickness ramp, U by arc length (tail 0 .. head 1) so the mask is not stretched by uneven frame steps.
    for (int j = 0; j < Columns; j++) {
     int k = j * 2;
     if (j >= cols) { v[k] = v[k + 1] = v[(cols - 1) * 2 + 1]; c[k] = c[k + 1] = Color.clear; continue; }
     v[k] = Vector3.LerpUnclamped(v[k + 1], v[k], thick);
     float u = along[j] / length; uv[k] = new Vector2(u, 0); uv[k + 1] = new Vector2(u, 1);
     c[k] = c[k + 1] = new Color(rowV, opacity, erode, 1);
    }
    mesh.vertices = v; mesh.uv = uv; mesh.colors = c; renderer.enabled = true;
   }
   public void Dispose() { if (go) UnityEngine.Object.Destroy(go); if (mesh) UnityEngine.Object.Destroy(mesh); }
  }

  // One fixed-shape slash on screen (C arc mesh or an EmberSlash instance). The root follows the hero feet every frame and is
  // mirrored by the facing taken when it spawned (X scale sign); the body carries the motion's offset and rotation.
  sealed class FixedSlot {
   public readonly Transform root, body; public readonly MeshRenderer renderer; readonly MeshFilter filter; readonly MaterialPropertyBlock block = new MaterialPropertyBlock();
   public bool live, growing, isEmber; public string key; public int attack, arc; public float facing = 1, grow, spawnAt, bornAt; public MotionSlash m;
   // Boss QuarterView (boss-kit-hero-20261121): the hero heading turned to a yaw that takes +X (side forward) to the hero forward.
   // NaN = side view: +X mirrored by facing, as before.
   public float yaw = float.NaN;
   public Vector3 Forward => float.IsNaN(yaw) ? new Vector3(facing, 0, 0) : Quaternion.Euler(0, yaw, 0) * Vector3.right;
   static readonly int CellId = Shader.PropertyToID("_Cell"), HeadId = Shader.PropertyToID("_Head"), AlphaId = Shader.PropertyToID("_Alpha"),
    TimingId = Shader.PropertyToID("_Timing"), PlacementId = Shader.PropertyToID("_Placement"), TintId = Shader.PropertyToID("_Tint");
   // C: a mesh renderer with the C material. Ember: an instance of the package prefab whose own EmberSlash component has built the
   // mesh in OnEnable and is then switched off, so playback runs on this effect clock (frozen in the hitstop) instead of Time.deltaTime.
   public FixedSlot(Transform parent, string name, Material c, GameObject emberPrefab) {
    root = new GameObject(name).transform; root.gameObject.layer = 30; root.SetParent(parent, false);
    if (emberPrefab) {
     isEmber = true; var go = UnityEngine.Object.Instantiate(emberPrefab, root, false); go.name = name + " · ember"; go.layer = 30; body = go.transform;
     var player = go.GetComponent("EmberSlash") as Behaviour; if (player) player.enabled = false; renderer = go.GetComponent<MeshRenderer>();
    } else {
     var go = new GameObject(name + " · C"); go.layer = 30; body = go.transform; body.SetParent(root, false);
     filter = go.AddComponent<MeshFilter>(); renderer = go.AddComponent<MeshRenderer>(); renderer.sharedMaterial = c;
    }
    renderer.shadowCastingMode = ShadowCastingMode.Off; renderer.receiveShadows = false; renderer.lightProbeUsage = LightProbeUsage.Off; renderer.reflectionProbeUsage = ReflectionProbeUsage.Off; renderer.enabled = false;
   }
   public bool Ready => renderer && (!isEmber || (body.GetComponent<MeshFilter>() && body.GetComponent<MeshFilter>().sharedMesh));
   public void Kill() { live = growing = false; if (renderer) renderer.enabled = false; }
   // rollDeg turns the shape inside its own plane (about the body's local Y: the C mesh depth axis, the Ember slash-plane normal)
   // before rotDeg places it; mirror flips the shape about its own origin (the offset stays in front of the hero).
   public void Place(Vector3 feet, float k, Vector3 posH, Vector3 rotDeg, float rollDeg, float heightM, bool mirror) {
    root.position = feet; root.rotation = float.IsNaN(yaw) ? Quaternion.identity : Quaternion.Euler(0, yaw, 0); root.localScale = new Vector3((float.IsNaN(yaw) ? facing : 1) * k, k, k);
    body.localPosition = posH * heightM; body.localRotation = Quaternion.Euler(rotDeg) * Quaternion.AngleAxis(rollDeg, Vector3.up); body.localScale = new Vector3(mirror ? -1 : 1, 1, 1);
   }
   public void SetMesh(Mesh mesh) { if (filter && filter.sharedMesh != mesh) filter.sharedMesh = mesh; }
   public void C(float cell, float head, float alpha) { block.SetFloat(CellId, cell); block.SetFloat(HeadId, head); block.SetFloat(AlphaId, alpha); renderer.SetPropertyBlock(block); renderer.enabled = true; }
   // Same property contract as EmberSlash.Show (package Runtime/EmberSlash.cs).
   public void Ember(float phase, float sweep, float persistence, float size, float intensity, float glow, float floor, Color tint) {
    size = Mathf.Max(.05f, size); floor = Mathf.Max(0, floor);
    renderer.localBounds = new Bounds(new Vector3(0, -floor * .5f * size, 0), new Vector3(10, 6 + floor, 9) * size);
    block.SetVector(TimingId, new Vector4(phase, Mathf.Clamp(sweep, .16f, .58f), Mathf.Clamp(persistence, .18f, .72f), 1));
    block.SetVector(PlacementId, new Vector4(size, Mathf.Max(0, intensity), glow, floor)); block.SetColor(TintId, tint); renderer.SetPropertyBlock(block); renderer.enabled = true;
   }
   public void Dispose() { if (root) UnityEngine.Object.Destroy(root.gameObject); }
  }
  struct Flash { public bool live; public float born, size; public Vector3 pos; }

  struct Star { public bool live, heavy; public float born, size; public Vector3 pos; }
  struct Ember { public bool live; public float born, life, len, row; public Vector3 p0, vel; }
  struct Puff { public bool live, flip; public float born, width, alpha, side; public Vector3 pos; }
  struct Finish { public bool live; public float born, facing; public Vector3 line, pool; }
  struct Glint { public bool live, big; public float born; }

  readonly GameObject root; Material[] materials; readonly Texture2D rampA, rampB; IaiPalette shown;
  readonly SlashProfile slash;
  // Fixed modes: C slots (also the Ember fallback when the frame budget level is high), Ember slots, C meshes, C hit flashes.
  readonly FixedSlot[] cSlots = new FixedSlot[2], emberSlots = new FixedSlot[2]; readonly Mesh[] cMeshes = new Mesh[3]; Batch flashes; readonly Flash[] flashPool = new Flash[3]; int nextFlash, fixedAttack;
  bool cReady, emberReady; Extras extras = new Extras { stars = true, embers = true, finish = true, glint = true };
  readonly Arc[] arcs = new Arc[2]; readonly Batch stars, heavies, lines, embers, glints, pools, dusts;
  readonly Star[] starPool = new Star[6]; readonly Ember[] emberPool = new Ember[64]; readonly Puff[] puffPool = new Puff[6]; readonly Finish[] finishPool = new Finish[2]; readonly Glint[] glintPool = new Glint[2];
  int nextStar, nextEmber, nextPuff, nextFinish, nextGlint;
  // Snapshot reading state (values only).
  float clock, previousVisual = -1; int lastDamage = -1, finishAttack, glintAttack, starAttack, starStrike, starCount, heroAttack; string session; bool glintSmall, glintBig;
  Transform mouth, mouthHero; bool mouthSearched;
  int mapAttack = -1, mapCount; float[] mapAge, mapClip;
  public bool Ready { get; }
  // QA / report (read through reflection; building the string allocates, so only on request).
  static IaiBladeVfx current;
  public static string DebugState => current == null ? "" : current.Describe();
  string Describe() {
   int s = 0, e = 0, p = 0; foreach (var x in starPool) if (x.live) s++; foreach (var x in emberPool) if (x.live) e++; foreach (var x in puffPool) if (x.live) p++;
   return "iai clock=" + clock.ToString("0.000") + " arc0=" + (arcs[0].live ? arcs[0].keys + (arcs[0].recording ? "r" : "e") : "-") + " arc1=" + (arcs[1].live ? arcs[1].keys + (arcs[1].recording ? "r" : "e") : "-") + " stars=" + s + " embers=" + e + " dust=" + p + " line=" + lines.Count + " glint=" + glints.Count + " pal=" + shown + (slash.c || slash.ember ? " " + slash.modeName + " c0=" + SlotText(cSlots[0]) + " c1=" + SlotText(cSlots[1]) + " e0=" + SlotText(emberSlots[0]) + " e1=" + SlotText(emberSlots[1]) : slash.flip ? " flip0=" + LifeText(arcs[0]) + " flip1=" + LifeText(arcs[1]) : " legacy");
  }

  string SlotText(FixedSlot f) => f == null || !f.live ? "-" : f.key + (f.growing ? ":g" + f.grow.ToString("0.00") : ":" + ((clock - f.bornAt) / Frame).ToString("0"));
  string LifeText(Arc a) => !a.live ? "-" : !a.born ? "pre" : ((clock - a.bornAt) / slash.life).ToString("0.00");

  public IaiBladeVfx() {
   slash = SlashProfile.Load();
   var shader = Resources.Load<Shader>("IaiVfx/IaiVfx");
   rampA = Resources.Load<Texture2D>("IaiVfx/R0_ramp_A"); rampB = Resources.Load<Texture2D>("IaiVfx/R0_ramp_B");
   Texture2D arc = Resources.Load<Texture2D>("IaiVfx/R1_arc_mask"), grain = Resources.Load<Texture2D>("IaiVfx/R2_flow_grain"), r3 = Resources.Load<Texture2D>("IaiVfx/R3_hit_normal"), r4 = Resources.Load<Texture2D>("IaiVfx/R4_hit_heavy"),
    r5 = Resources.Load<Texture2D>("IaiVfx/R5_ground_dust"), r6 = Resources.Load<Texture2D>("IaiVfx/R6_streak_ember"), r7 = Resources.Load<Texture2D>("IaiVfx/R7_finish_line"), r8 = Resources.Load<Texture2D>("IaiVfx/R8_sheathe_glint"), r9 = Resources.Load<Texture2D>("IaiVfx/R9_ground_pool");
   Ready = shader && shader.isSupported && rampA && rampB && arc && grain && r3 && r4 && r5 && r6 && r7 && r8 && r9;
   if (!Ready) { Debug.LogWarning("IaiBladeVfx: materials missing under Resources/IaiVfx; the kit hero keeps the old effect."); return; }
   root = new GameObject("Iai blade VFX · pooled"); root.layer = 30;
   Material M(string name, string keyword, Texture2D main) { var m = new Material(shader) { name = name }; m.EnableKeyword(keyword); m.SetTexture("_MainTex", main); m.SetTexture("_Grain", grain); return m; }
   materials = new[] { M("Iai arc", "_IAI_ARC", arc), M("Iai star", "_IAI_INK", r3), M("Iai heavy star", "_IAI_INK", r4), M("Iai finish line", "_IAI_INK", r7), M("Iai ember", "_IAI_TINT", r6), M("Iai glint", "_IAI_TINT", r8), M("Iai ground glow", "_IAI_TINT", r9), M("Iai dust", "_IAI_DUST", r5) };
   // Draw order inside the transparent queue: ground first, then dust, arc, line, stars, embers, glint on top.
   int[] order = { 3002, 3005, 3005, 3004, 3006, 3006, 3000, 3001 }; for (int i = 0; i < materials.Length; i++) materials[i].renderQueue = order[i];
   // A hit star sits at the contact point inside the target; on-top layers ignore depth (fighting-game hit sparks).
   for (int i = 1; i <= 5; i++) materials[i].SetFloat("_ZTest", (float)CompareFunction.Always);
   for (int i = 0; i < 2; i++) arcs[i] = new Arc(root.transform, materials[0], i);
   stars = new Batch(root.transform, "Iai hit stars", materials[1], 6); heavies = new Batch(root.transform, "Iai heavy stars", materials[2], 6); lines = new Batch(root.transform, "Iai finish line", materials[3], 2);
   embers = new Batch(root.transform, "Iai embers", materials[4], 64); glints = new Batch(root.transform, "Iai sheathe glint", materials[5], 2); pools = new Batch(root.transform, "Iai ground glow", materials[6], 2); dusts = new Batch(root.transform, "Iai dust", materials[7], 6);
   // DBFZ-style arc: its own material (flipbook keyword, R10); the arcs use it instead of the legacy arc material.
   var flipTex = slash.flip ? Resources.Load<Texture2D>(slash.texture) : null;
   if (slash.flip && !flipTex) { Debug.LogWarning("IaiBladeVfx: " + slash.texture + " missing; legacy arc."); slash.flip = false; }
   if (slash.flip) {
    var f = M("Iai arc flipbook", "_IAI_FLIP", flipTex); f.renderQueue = order[0]; f.SetVector("_FlipGrid", new Vector4(slash.cols, slash.rows, slash.inset.x, slash.inset.y));
    Array.Resize(ref materials, materials.Length + 1); materials[materials.Length - 1] = f;
    foreach (var a in arcs) { a.SetMaterial(f); a.Life(0, slash.start); }
   }
   if (slash.c || slash.ember) BuildFixed(M, order);
   ApplyPalette(); current = this;
  }

  void BuildFixed(Func<string, string, Texture2D, Material> M, int[] order) {
   // C assets (also needed by Ember as its frame-budget fallback).
   var cTex = Resources.Load<Texture2D>(slash.cTexture); var fTex = Resources.Load<Texture2D>(slash.cFlash);
   for (int i = 0; i < 3; i++) cMeshes[i] = Resources.Load<Mesh>(slash.cMeshes[i]);
   cReady = cTex && fTex && cMeshes[0] && cMeshes[1] && cMeshes[2];
   if (cReady) {
    var cm = M("Iai C arc", "_IAI_CFLIP", cTex); cm.renderQueue = order[0]; cm.SetVector("_FlipGrid", new Vector4(slash.cCols, slash.cRows, slash.cInset.x, slash.cInset.y));
    var fm = M("Iai C flash", "_IAI_PREMUL", fTex); fm.renderQueue = order[4]; fm.SetFloat("_ZTest", (float)CompareFunction.Always);
    Array.Resize(ref materials, materials.Length + 2); materials[materials.Length - 2] = cm; materials[materials.Length - 1] = fm;
    for (int i = 0; i < cSlots.Length; i++) cSlots[i] = new FixedSlot(root.transform, "Iai C slash " + i, cm, null);
    flashes = new Batch(root.transform, "Iai C hit flash", fm, flashPool.Length);
   } else Debug.LogWarning("IaiBladeVfx: C assets missing under Resources/" + slash.cTexture + " ...; mode " + slash.modeName + " falls back.");
   if (slash.ember) {
    var prefab = Resources.Load<GameObject>(slash.emberPrefab);
    if (prefab) { for (int i = 0; i < emberSlots.Length; i++) emberSlots[i] = new FixedSlot(root.transform, "Iai ember slash " + i, null, prefab); emberReady = emberSlots[0].Ready; }
    if (!emberReady) Debug.LogWarning("IaiBladeVfx: Ember prefab " + slash.emberPrefab + " missing or not built; C is used.");
   }
   if (!cReady && !emberReady) { slash.c = slash.ember = false; return; }
   extras = slash.ember && emberReady ? slash.emberExtras : slash.cExtras;
  }
  void ApplyPalette() { shown = Palette; var r = shown == IaiPalette.A ? rampA : rampB; foreach (var m in materials) m.SetTexture("_Ramp", r); }

  void Reset() {
   foreach (var a in arcs) a.Kill(); for (int i = 0; i < starPool.Length; i++) starPool[i].live = false; for (int i = 0; i < emberPool.Length; i++) emberPool[i].live = false;
   for (int i = 0; i < puffPool.Length; i++) puffPool[i].live = false; for (int i = 0; i < finishPool.Length; i++) finishPool[i].live = false; KillGlints();
   lastDamage = -1; finishAttack = glintAttack = starAttack = starStrike = starCount = heroAttack = fixedAttack = 0; glintSmall = glintBig = false;
   foreach (var f in cSlots) f?.Kill(); foreach (var f in emberSlots) f?.Kill(); for (int i = 0; i < flashPool.Length; i++) flashPool[i].live = false;
  }
  void KillGlints() { for (int i = 0; i < glintPool.Length; i++) glintPool[i].live = false; }
  // Hash noise for spread (deterministic per attack, no Random object state).
  static float Hash(int a, int b) { uint h = (uint)(a * 374761393 + b * 668265263); h = (h ^ (h >> 13)) * 1274126177u; return (h ^ (h >> 16)) / 4294967295f; }

  // Called after the hero pose of this frame is sampled (blade bone valid). Kit hero in a normal zone only.
  void FinishArc(Arc a, Vector3 guard, Vector3 tip, Vector3 ground, float facing, float H) { a.recording = false; a.end = clock; Born(a); PeakEmbers(a, guard, tip, H); if (a.row == 2) SpawnFinish(a.attack, tip, ground, facing, H); }
  // The sweep face exists from here (flipbook life starts). Once per arc: the swing window ended, or the contact hitstop began.
  void Born(Arc a) { if (!a.born) { a.born = true; a.bornAt = clock; } }

  // heroClip / heroSample = the clip and clip time the hero pose shows this frame (Battle3DView.HeroClipName / HeroSampleTime).
  // Set by Battle3DView every frame: NaN in the side view; in the boss QuarterView the hero heading - 90 (degrees about +Y), so the
  // fixed C / Ember slash spawned now turns with the kit hero instead of the world X axis.
  public float PlanarYaw = float.NaN;
  public void Update(JObject state, float visualTime, Camera cam, Transform hero, Vector3 guard, Vector3 tip, float heroHeight, string heroClip, float heroSample) {
   if (!Ready || !hero || !cam) return;
   if (Palette != shown) ApplyPalette();
   string id = (string)state["id"]; if (id != session) { Reset(); session = id; }
   var h = state["hero"]; var motion = h?["motion"] as JObject;
   // Copy what this frame needs; the snapshot object is rewritten in place next frame.
   string kind = (string)motion?["kind"]; bool kit = motion?["kit"] != null; int attack = (int?)motion?["attackId"] ?? 0;
   float start = NativeCombatPresentation.N(motion?["start"]), duration = NativeCombatPresentation.N(motion?["duration"], 1), age = motion == null ? 0 : visualTime - start;
   bool held = NativeCombatPresentation.N(motion?["hitstopUntil"], -1) > visualTime;
   float facing = NativeCombatPresentation.N(h?["facing"], 1) < 0 ? -1 : 1;
   // Effect clock: frame time, frozen while the kernel hitstop holds the motion.
   float dt = previousVisual < 0 ? 0 : Mathf.Clamp(visualTime - previousVisual, 0, .1f); if (visualTime < previousVisual) dt = 0; previousVisual = visualTime;
   if (!held) clock += dt; float H = heroHeight > .1f ? heroHeight : 1.2f; Vector3 ground = hero.position;

   // Cut off (K5 cancel = 0.04 s stay1, a hurt, a dodge...): nothing blade-attached stays in the air.
   // attack -> next attack and attack -> recover are the combo / sheathe: the arc there finishes and breaks up normally.
   bool attacking = kit && kind == "attack";
   // A skill cast also cuts the attack: its own effect takes over, no arc of the cut hit is left on screen.
   // Instant evade (2026-11-23): a roll / jump / slide that replaced an attack starts at once and names it (cancelledAttackId): same cut.
   if (kind == "cancel" || kind == "skill" || motion?["cancelledAttackId"] != null) { foreach (var a in arcs) if (a.live) a.Kill(); for (int i = 0; i < finishPool.Length; i++) finishPool[i].live = false; }
   else if (!attacking && kind != "recover") foreach (var a in arcs) if (a.recording) a.Kill();

   // Blade arc. Window = the row's ArcClipFrom/To (clip seconds), compared with the clip time the hero shows this frame,
   // so the arc covers the swing on screen at tempo 0/1/2 and holds through the hitstop with the pose.
   // Fallback for a row without a value: kernel timeline.active[0] (ratios of the kernel duration) taken into clip time
   // with the motion's clipMap (ClipAt, the same mapping the hero pose uses).
   int row = 0; float clipFrom = float.MaxValue, clipTo = float.MaxValue; bool shownRow = false;
   if (attacking) {
    string r = (string)motion["row"]; row = r != null && r.Length == 4 ? Mathf.Clamp(r[3] - '1', 0, 2) : 0;
    if (!float.IsNaN(ArcClipFrom[row]) && !float.IsNaN(ArcClipTo[row])) { clipFrom = ArcClipFrom[row]; clipTo = ArcClipTo[row]; }
    else {
     var window = (motion["timeline"]?["active"] as JArray); var w0 = window != null && window.Count > 0 ? window[0] : null;
     float from = NativeCombatPresentation.N(w0?["from"], 1), to = NativeCombatPresentation.N(w0?["to"], 1);
     if (attack != mapAttack) { mapAttack = attack; mapCount = NativeCombatPresentation.ReadClipMap(motion["clipMap"] as JArray, ref mapAge, ref mapClip); }
     clipFrom = NativeCombatPresentation.ClipAt(mapAge, mapClip, mapCount, duration * from); clipTo = NativeCombatPresentation.ClipAt(mapAge, mapClip, mapCount, duration * to);
    }
    shownRow = r != null && heroClip != null && heroClip.EndsWith(r, StringComparison.Ordinal);
   }
   if (slash.c || slash.ember) UpdateFixed(motion, kind, kit, attacking, attack, row, clipFrom, clipTo, shownRow, held, facing, H, ground, tip, heroClip, heroSample);
   else {
   foreach (var a in arcs) if (a.recording && (a.attack != attack || !attacking)) FinishArc(a, guard, tip, ground, facing, H); // next hit / sheathe began
   if (attacking && shownRow && heroSample >= clipFrom && heroAttack != attack) {
    heroAttack = attack; var slot = arcs[0].live && (!arcs[1].live || arcs[1].end > arcs[0].end) ? arcs[1] : arcs[0];
    if (slot.live) slot.Kill(); slot.live = slot.recording = true; slot.born = false; slot.keys = 0; slot.attack = attack; slot.row = row;
    slot.space = slash.flip && slash.local ? hero : null; // local: the face follows the hero root (DBFZ bUseLocalSpace)
   }
   foreach (var a in arcs) {
    if (!a.recording || a.attack != attack) continue;
    // A pose already past the window end (sparse frames) is not keyed: the blade there is on its way back (hook).
    if (shownRow && heroSample <= clipTo + 1e-4f) a.Add(guard, tip, H);
    if (heroSample >= clipTo || !shownRow) FinishArc(a, guard, tip, ground, facing, H);
   }
   if (slash.flip) DrawFlipArcs(held, H, cam.transform.forward);
   else foreach (var a in arcs) {
    if (!a.live) continue;
    float erode = a.recording ? 0 : Mathf.Clamp01((clock - a.end - ArcHold) / ArcBreak);
    if (!a.recording && clock - a.end > ArcHold + ArcBreak) { a.Kill(); continue; }
    a.Draw(RowV(a.row), 1, erode, H, cam.transform.forward);
   }
   }

   // Hits: authoritative damage events of this kit (definitionId pink-iai-*), at contactAt.
   var fx = state["fx"] as JArray; int fxCount = fx?.Count ?? 0;
   for (int i = 0; i < fxCount; i++) {
    var t = fx[i]; if ((string)t["kind"] != "damage" || t["contactAt"] == null) continue;
    int eventId = (int?)t["id"] ?? 0; if (eventId <= lastDamage) continue;
    string def = (string)t["definitionId"]; if (def == null || !def.StartsWith("pink-iai", StringComparison.Ordinal)) continue;
    float contact = NativeCombatPresentation.N(t["contactAt"]); if (visualTime < contact) continue;
    lastDamage = eventId; if (visualTime - contact > .45f) continue;
    var p = t["point"]; if (p == null) continue;
    var point = new Vector3(NativeCombatPresentation.N(p["x"]) / 100, NativeCombatPresentation.N(p["y"]) / 100, (NativeCombatPresentation.N(p["z"]) - 5000) / 100);
    int hitRow = def.Length > 0 ? Mathf.Clamp(def[def.Length - 1] - '1', 0, 2) : 0; int hitAttack = (int?)t["attackId"] ?? 0, strike = (int?)t["strike"] ?? 0;
    if (hitAttack != starAttack || strike != starStrike) { starAttack = hitAttack; starStrike = strike; starCount = 0; }
    // Up to three stars per strike (AUTO multi-mob): first full size, then smaller. Embers for every target.
    // C: one flash per strike at the first target (art_helper spec flash, toward the camera); the R3/R4 stars only where the mode keeps them.
    if (flashes != null && (slash.c || !emberReady) && slash.cFlashAt == "hit" && starCount == 0) SpawnFlash(point, cam.transform.position, H, 1);
    if (extras.stars && starCount < 3) SpawnStar(point, hitRow == 2, H * (hitRow == 2 ? HeavyPlate : StarPlate) * (starCount == 0 ? 1 : starCount == 1 ? .8f : .7f), ground, H);
    starCount++;
    var tangent = Vector3.zero; foreach (var a in arcs) if (a.live && a.attack == hitAttack) tangent = a.TipTangent;
    if (extras.embers) HitEmbers(point, point - new Vector3(ground.x, point.y, ground.z), tangent, hitRow == 2 ? 14 : 8, eventId, H);
    if (extras.finish && hitRow == 2) SpawnFinish(hitAttack, tip, ground, facing, H);
   }

   // Sheathe glint at the scabbard mouth: small at the start of recover (flick), brightest once at sheatheAt.
   if (extras.glint && kit && kind == "recover") {
    if (attack != glintAttack) { glintAttack = attack; glintSmall = glintBig = false; KillGlints(); }
    float sheatheAt = NativeCombatPresentation.N(motion["sheatheAt"], duration);
    if (!glintSmall && age >= 0) { glintSmall = true; SpawnGlint(false); }
    if (!glintBig && age >= sheatheAt) { glintBig = true; SpawnGlint(true); }
   }
   else if (glintAttack != 0) { glintAttack = 0; if (!glintBig) KillGlints(); } // sheathe cut before the blade was home: no glint left

   DrawSprites(cam, hero, H, ground);
  }

  // ---- Fixed-shape slash (C / ember) ----------------------------------------------------------------------------------------
  // Which sword motion is on screen: a kit row (iai1..iai3, window = the row's arc window) or the kit skill (one clip for every
  // skill slot, window from the profile). The slash starts when the clip time the hero pose shows reaches the window start, so it
  // follows the tempo stage and the hitstop exactly like the V2b arc; nothing here moves a hitbox or a kernel time.
  void UpdateFixed(JObject motion, string kind, bool kit, bool attacking, int attack, int row, float rowFrom, float rowTo, bool shownRow, bool held, float facing, float H, Vector3 ground, Vector3 tip, string heroClip, float heroSample) {
   string key = null; float from = rowFrom, to = rowTo; bool shown = false; MotionSlash m = null;
   if (attacking) { key = (string)motion["row"]; m = slash.Motion(key); shown = shownRow; }
   else if (kit && kind == "skill") { key = "skill"; m = slash.Motion(key); shown = m != null && (m.clip == null || heroClip != null && heroClip.IndexOf(m.clip, StringComparison.OrdinalIgnoreCase) >= 0); }
   if (m != null && !float.IsNaN(m.from)) { from = m.from; to = m.to; }
   if (m == null || float.IsNaN(from) || float.IsNaN(to) || to <= from) shown = false;
   // Cut off: a cancel (into a move or a skill), a hurt or a dodge leaves no row slash that is still growing; a skill start ends the rows.
   bool cut = kind == "cancel" || kind == "skill" || motion?["cancelledAttackId"] != null;
   for (int s = 0; s < 4; s++) {
    var f = s < 2 ? cSlots[s] : emberSlots[s - 2]; if (f == null || !f.live) continue;
    bool same = f.attack == attack && f.key == key;
    if (cut && f.key != "skill") { f.Kill(); continue; }
    if (f.growing && !same) { if (attacking || kind == "recover" || kind == "skill") Born(f, ground, tip, facing, H); else { f.Kill(); continue; } }
   }
   // Spawn once per motion when the shown clip time enters the window.
   if (key != null && shown && heroSample >= from && fixedAttack != attack) {
    fixedAttack = attack;
    var lvl = IslandFrameBudget.Current ? IslandFrameBudget.Current.Policy.Level : 0;
    bool useEmber = slash.ember && emberReady && lvl < slash.emberBudgetOffLevel;
    var pool = useEmber ? emberSlots : cSlots;
    if (pool[0] != null) {
     var f = !pool[0].live ? pool[0] : !pool[1].live ? pool[1] : pool[0].spawnAt <= pool[1].spawnAt ? pool[0] : pool[1];
     f.Kill(); f.live = f.growing = true; f.key = key; f.attack = attack; f.m = m; f.arc = m.arc; f.facing = facing; f.yaw = PlanarYaw; f.spawnAt = clock; f.grow = 0;
    }
   }
   foreach (var f in cSlots) if (f != null && f.live) {
    if (f.growing) { if (f.attack == attack && f.key == key && shown) { f.grow = Mathf.Clamp01((heroSample - from) / (to - from)); if (heroSample >= to) Born(f, ground, tip, facing, H); } }
    var mm = f.m; float k = mm.cScale * H / slash.cHeightM; f.Place(ground, k, mm.cPos, mm.cRot, mm.cRoll, slash.cHeightM, mm.cMirror); f.SetMesh(cMeshes[f.arc - 1]);
    if (f.growing) { f.C(0, Mathf.Lerp(slash.cHead0, slash.cHead1, f.grow), 1); continue; }
    int frame = Mathf.FloorToInt((clock - f.bornAt) / Frame + 1e-3f) - slash.cHold[f.arc - 1];
    if (frame < 0) { f.C(0, slash.cHead1, 1); continue; }
    if (frame >= slash.cDissolve.Length) { f.Kill(); continue; }
    f.C(slash.cDissolve[frame], slash.cHead1, 1);
   }
   foreach (var f in emberSlots) if (f != null && f.live) {
    if (f.growing && (f.attack != attack || f.key != key || !shown || heroSample >= to)) { f.growing = false; f.bornAt = clock; }
    var mm = f.m; float phase = (clock - f.spawnAt) / mm.eDuration; if (phase >= 1) { f.Kill(); continue; }
    float k = H / slash.cHeightM; f.Place(ground, k, mm.ePivot, mm.eRot, mm.eRoll, slash.cHeightM, mm.eMirror);
    // Ground glow: the package pool plane is the effect-local XZ plane at -floorDistance (before Size). Level slash only: with the
    // plane tilted the pool would stand up, so it is off unless the profile sets a floor distance itself.
    bool level = Mathf.Abs(Mathf.DeltaAngle(0, mm.eRot.x)) < 1 && Mathf.Abs(Mathf.DeltaAngle(0, mm.eRot.z)) < 1;
    float floor = mm.eFloor >= 0 ? mm.eFloor : level ? mm.ePivot.y * slash.cHeightM / Mathf.Max(.05f, mm.eSize) : 0, glow = mm.eFloor >= 0 || level ? mm.eGlow : 0;
    f.Ember(phase, mm.eSweep, mm.ePersist, mm.eSize, mm.eIntensity, glow, floor, mm.eTint);
   }
  }
  // Grow ends (the swing window is over, or the next row / the sheathe began): the C hold and dissolve run from here.
  void Born(FixedSlot f, Vector3 ground, Vector3 tip, float facing, float H) {
   if (!f.growing) return; f.growing = false; f.bornAt = clock;
   if (f.isEmber) return;
   if (flashes != null && slash.cFlashAt == "hold") { var c = slash.cFlashCenter[f.arc - 1]; SpawnFlash(ground + f.Forward * (c.x * H) + new Vector3(0, c.y * H, 0), Vector3.zero, H, 1); }
   if (extras.finish && f.key == "iai3") SpawnFinish(f.attack, tip, ground, f.facing, H);
  }
  void SpawnFlash(Vector3 at, Vector3 camPos, float H, float size) {
   ref var x = ref flashPool[nextFlash++ % flashPool.Length];
   var toward = camPos == Vector3.zero ? Vector3.zero : (camPos - at).normalized * slash.cFlashToward;
   x.live = true; x.born = clock; x.size = slash.cFlashSize * H * size; x.pos = at + toward;
  }

  // DBFZ-style life. Before birth the face is hidden (or, growDuringSwing, drawn growing as cell 0). From birth: cell =
  // floor(t * subImageEnd) of cols x rows (linear, no blend), colour start -> end, alpha 1 until alphaHold then down to 0,
  // gone at t = 1. t runs on the effect clock, so the hitstop holds the face like the pose.
  void DrawFlipArcs(bool held, float H, Vector3 camForward) {
   foreach (var a in arcs) {
    if (!a.live) continue;
    if (!a.born && a.recording && held && slash.onHitstop && a.keys >= 2) Born(a); // contact pose: the hitstop began inside the window
    if (!a.born) { if (slash.grow) { a.Draw(RowV(a.row), 1, 0, H, camForward); a.Life(0, slash.start); } else a.Hide(); continue; }
    float t = (clock - a.bornAt) / slash.life; if (t >= 1) { a.Kill(); continue; }
    float cell = Mathf.Min(slash.Cells - 1, Mathf.Floor(t * slash.subImageEnd)), alpha = t <= slash.hold ? 1 : 1 - (t - slash.hold) / (1 - slash.hold);
    a.Draw(RowV(a.row), alpha, 0, H, camForward); a.Life(cell, Color.LerpUnclamped(slash.start, slash.end, t));
   }
  }

  void PeakEmbers(Arc a, Vector3 guard, Vector3 tip, float H) {
   var tangent = a.TipTangent; int n = a.row == 2 ? 10 : 6;
   for (int i = 0; i < n; i++) EmitEmber(tip, tangent, tip - guard, a.attack * 31 + i, a.row, H, .7f);
  }
  void HitEmbers(Vector3 point, Vector3 outward, Vector3 tangent, int n, int seed, float H) { for (int i = 0; i < n; i++) EmitEmber(point, tangent, outward, seed * 17 + i, 3, H, 1); }
  void EmitEmber(Vector3 at, Vector3 tangent, Vector3 outward, int seed, int row, float H, float power) {
   ref var e = ref emberPool[nextEmber++ % emberPool.Length];
   float r0 = Hash(seed, 1), r1 = Hash(seed, 2), r2 = Hash(seed, 3), r3 = Hash(seed, 4);
   var t = tangent.sqrMagnitude > 1e-8f ? tangent.normalized : Vector3.zero; var o = outward.sqrMagnitude > 1e-8f ? outward.normalized : Vector3.up;
   var dir = (t * (.6f + r0) + o * (.5f + r1 * .8f) + new Vector3(r2 - .5f, r3 * .6f, (r1 - .5f) * .3f)).normalized;
   e.live = true; e.born = clock; e.life = .22f + r1 * .2f; e.len = H * (.09f + .08f * r2); e.row = RowV(row); e.p0 = at; e.vel = dir * H * (1.6f + 2.2f * r0) * power;
  }
  void SpawnStar(Vector3 point, bool heavy, float size, Vector3 ground, float H) {
   ref var s = ref starPool[nextStar++ % starPool.Length];
   // Keep the lower spikes above the feet line so they stay off the HUD text under the hero.
   point.y = Mathf.Max(point.y, ground.y + size * (heavy ? .50f : .38f));
   s.live = true; s.heavy = heavy; s.born = clock; s.size = size; s.pos = point;
  }
  void SpawnFinish(int attack, Vector3 tip, Vector3 ground, float facing, float H) {
   if (finishAttack == attack) return; finishAttack = attack;
   ref var f = ref finishPool[nextFinish++ % finishPool.Length];
   f.live = true; f.born = clock; f.facing = facing;
   // Placement from the art concept (R10 3rd hit): line just above the ground ahead of the hero, glow under it.
   f.line = new Vector3(ground.x + facing * .86f * H, ground.y + Mathf.Clamp(tip.y - ground.y, .12f * H, .40f * H), ground.z);
   f.pool = new Vector3(ground.x + facing * .72f * H, ground.y + .02f, ground.z);
   for (int k = 0; k < 2; k++) {
    ref var p = ref puffPool[nextPuff++ % puffPool.Length];
    p.live = true; p.born = clock + k * 2 * Frame; p.flip = k == 1; p.side = -facing; p.width = DustWidth * H * (k == 0 ? 1 : .75f); p.alpha = k == 0 ? .55f : .40f;
    p.pos = new Vector3(ground.x - facing * (k == 0 ? .26f : .55f) * H, ground.y, ground.z + .02f * (k + 1));
   }
  }
  void SpawnGlint(bool big) { ref var g = ref glintPool[nextGlint++ % glintPool.Length]; g.live = true; g.big = big; g.born = clock; }

  static int Cell(int[] hold, float age, out bool done) {
   int f = Mathf.FloorToInt(age / Frame + 1e-3f); for (int i = 0; i < hold.Length; i++) { if (f < hold[i]) { done = false; return i; } f -= hold[i]; }
   done = true; return hold.Length - 1;
  }
  static Vector4 Rect(int cell, int cols, int rows) { float w = 1f / cols, hgt = 1f / rows; return new Vector4(cell % cols * w, 1 - (cell / cols + 1) * hgt, w, hgt); }
  static readonly Vector4 Whole = new Vector4(0, 0, 1, 1);

  Transform Mouth(Transform hero) {
   if (mouthHero != hero) { mouthHero = hero; mouth = null; mouthSearched = false; }
   if (mouth || mouthSearched) return mouth; mouthSearched = true;
   // Scabbard rig: Mirror/Scabbard/G_weapon_root/G_katana_saya_grip sits on the blade guard when the blade is home (probed in the Editor).
   foreach (var t in hero.GetComponentsInChildren<Transform>(true)) if (t.name == "G_katana_saya_grip" && t.parent && t.parent.parent && t.parent.parent.name == "Scabbard") { mouth = t; break; }
   return mouth;
  }

  void DrawSprites(Camera cam, Transform hero, float H, Vector3 ground) {
   var right = cam.transform.right; var up = cam.transform.up; var forward = cam.transform.forward;
   stars.Begin(); heavies.Begin();
   for (int i = 0; i < starPool.Length; i++) {
    ref var s = ref starPool[i]; if (!s.live) continue;
    int cell = Cell(s.heavy ? HeavyHold : StarHold, clock - s.born, out bool done); if (done) { s.live = false; continue; }
    float half = s.size * .5f; (s.heavy ? heavies : stars).Quad(s.pos - forward * .05f, right * half, up * half, s.heavy ? Rect(cell, 4, 4) : Rect(cell, 4, 2), new Color(RowV(3), 1, 0, 1));
   }
   stars.End(); heavies.End();

   embers.Begin();
   for (int i = 0; i < emberPool.Length; i++) {
    ref var e = ref emberPool[i]; if (!e.live) continue; float t = clock - e.born; if (t > e.life) { e.live = false; continue; }
    var vel = e.vel + Vector3.down * (H * 3.5f) * t; var p = e.p0 + e.vel * t + Vector3.down * (H * 1.75f) * t * t;
    var sv = vel - Vector3.Dot(vel, forward) * forward; var dir = sv.sqrMagnitude > 1e-8f ? sv.normalized : up;
    float k = t / e.life, len = e.len * (1 - .4f * k), wid = len * .45f, a = k < .6f ? 1 : 1 - (k - .6f) / .4f;
    var side = Vector3.Cross(forward, dir).normalized;
    embers.Quad(p - dir * len * .5f, side * wid * .5f, dir * len * .5f, Whole, new Color(e.row, a, 0, 1));
   }
   embers.End();

   lines.Begin(); pools.Begin();
   for (int i = 0; i < finishPool.Length; i++) {
    ref var f = ref finishPool[i]; if (!f.live) continue; float t = (clock - f.born) / Frame; if (t > 26) { f.live = false; continue; }
    // Line: in over 2 frames, hold to 6, narrow to 42 % / thin to 29 % by 14, gone by 22 (concept stages 1-2).
    if (t <= 22) {
     float wx = t < 2 ? Mathf.Lerp(.45f, 1, t / 2) : t < 6 ? 1 : t < 14 ? Mathf.Lerp(1, .42f, (t - 6) / 8) : .42f;
     float hy = t < 6 ? 1 : t < 14 ? Mathf.Lerp(1, .29f, (t - 6) / 8) : .29f, a = t < 14 ? Mathf.Lerp(1, .47f, Mathf.Clamp01((t - 6) / 8)) : Mathf.Lerp(.47f, 0, (t - 14) / 8);
     float w = LineWidth * H * wx, hh = LineWidth * H / 16 * hy;
     lines.Quad(f.line - forward * .1f, right * (w * .5f) * f.facing, up * (hh * .5f), Whole, new Color(RowV(2), a, 0, 1));
    }
    float pa = t < 10 ? .65f : t < 16 ? Mathf.Lerp(.65f, .30f, (t - 10) / 6) : Mathf.Lerp(.30f, 0, (t - 16) / 10);
    pools.Quad(f.pool, right * (PoolWidth * H * .5f), up * (PoolWidth * H * .5f * 27 / 413f * 1.6f), Whole, new Color(RowV(2), pa, 0, 1));
   }
   lines.End(); pools.End();

   dusts.Begin();
   for (int i = 0; i < puffPool.Length; i++) {
    ref var p = ref puffPool[i]; if (!p.live) continue; float t = clock - p.born; if (t < 0) continue;
    int cell = Cell(DustHold, t, out bool done); if (done) { p.live = false; continue; }
    // Softened: slow rise and drift back, a little growth, partial transparency on top of the cell's own fade.
    float grow = 1 + .25f * Mathf.Clamp01(t), w = p.width * grow, hgt = w * .66f;
    var c = p.pos + Vector3.up * (hgt * .42f + H * .18f * t) + Vector3.right * p.side * H * .20f * t;
    var r = Rect(cell, 4, 2); if (p.flip) { r.x += r.z; r.z = -r.z; }
    dusts.Quad(c, right * (w * .5f), up * (hgt * .5f), r, new Color(0, DustStage[cell] * p.alpha, 0, 1));
   }
   dusts.End();

   if (flashes != null) {
    flashes.Begin(); var fs = slash.cFlashScale; var fa = slash.cFlashAlpha;
    for (int i = 0; i < flashPool.Length; i++) {
     ref var x = ref flashPool[i]; if (!x.live) continue; int k = Mathf.FloorToInt((clock - x.born) / Frame + 1e-3f);
     if (k >= fs.Length || k >= fa.Length) { x.live = false; continue; }
     float half = x.size * fs[k] * .5f; flashes.Quad(x.pos, right * half, up * half, Whole, new Color(0, fa[k], 0, 1));
    }
    flashes.End();
   }

   glints.Begin();
   var m = Mouth(hero);
   for (int i = 0; i < glintPool.Length; i++) {
    ref var g = ref glintPool[i]; if (!g.live) continue;
    int cell = Cell(GlintHold, clock - g.born, out bool done); if (done || !m) { g.live = false; continue; }
    float size = GlintPlate * H * (g.big ? 1 : .53f); if (!g.big) cell = Mathf.Min(cell, 2);
    glints.Quad(m.position - forward * .08f, right * (size * .5f), up * (size * .5f), Rect(cell, 4, 1), new Color(RowV(3), 1, 0, 1));
   }
   glints.End();
  }

  public void Dispose() {
   if (current == this) current = null; if (!Ready) return;
   foreach (var a in arcs) a?.Dispose(); foreach (var f in cSlots) f?.Dispose(); foreach (var f in emberSlots) f?.Dispose(); flashes?.Dispose(); stars?.Dispose(); heavies?.Dispose(); lines?.Dispose(); embers?.Dispose(); glints?.Dispose(); pools?.Dispose(); dusts?.Dispose();
   if (materials != null) foreach (var m in materials) if (m) UnityEngine.Object.Destroy(m);
   if (root) UnityEngine.Object.Destroy(root);
  }
 }
}
