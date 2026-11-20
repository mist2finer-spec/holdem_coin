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
 // Timing: on/off from kernel values only (timeline.active from/to, fx contactAt, recover start / sheatheAt).
 // The arc is built from the blade bone the hero pose already sampled through ClipAt this frame, so it follows the
 // tempo stage by construction. All layers run on one effect clock that does not advance during the kernel hitstop.
 // Every buffer, mesh and material is made once; the snapshot is read by value each frame and never kept.
 public sealed class IaiBladeVfx : IDisposable {
  // The one colour switch. A = 청람 유리 (R0_ramp_A), B = 홍먹 (R0_ramp_B). Default B (user decision 2026-11-19).
  public static IaiPalette Palette = IaiPalette.B;
  // Off = the hero keeps the old effect (crescent, smear, spark). QA uses it for the before/after counts.
  public static bool Enabled = true;

  const float Frame = 1f / 60;
  // README hold frames (60 fps) and plate sizes in standing heights (H).
  static readonly int[] StarHold = { 1, 2, 2, 3, 3, 4 }, HeavyHold = { 1, 2, 2, 2, 3, 3, 4, 5 }, DustHold = { 3, 4, 5, 6, 7, 9, 12, 15 }, GlintHold = { 1, 2, 2, 3 };
  static readonly float[] DustStage = { 224 / 255f, 222 / 255f, 213 / 255f, 204 / 255f, 187 / 255f, 160 / 255f, 130 / 255f, 104 / 255f };
  const float StarPlate = .48f, HeavyPlate = .60f, GlintPlate = .30f, DustWidth = 1.0f, LineWidth = 2.9f, PoolWidth = 1.4f;
  // Look parameters (not timing): the arc holds its peak 2 frames, then breaks up; shapes are gone by ~0.35 s.
  const float ArcHold = 2 * Frame, ArcBreak = .18f, ArcOuter = 1.06f;
  // Band from this fraction of the blade to just past the tip, per hit (concept R10 stroke widths 24 / 64 / 86 px at H 300).
  static readonly float[] ArcInner = { .84f, .60f, .45f };
  // The band is not drawn until the tip has swept ArcMinLength (H); it then widens to full by ArcMinLength + ArcGrowLength.
  // A blade held almost still in the window (3rd hit starts overhead) would otherwise show a small pennant at the tip.
  const float ArcMinLength = .15f, ArcGrowLength = .45f;
  // While the tip has not yet moved this far (H) from the first key, the first key slides with it: a blade that waits in the
  // window (3rd hit opens overhead) starts its arc where the real swing starts.
  const float ArcStartStep = .12f;
  static float RowV(int row) => 1 - (row + .5f) / 4; // 0 = 1st hit, 1 = 2nd, 2 = 3rd, 3 = hit row

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

  // Blade sweep: guard/tip keys recorded while the kernel active window is open, Catmull-Rom between keys.
  sealed class Arc {
   public const int Keys = 40, Sub = 4, Columns = (Keys - 1) * Sub + 1;
   public readonly Vector3[] inner = new Vector3[Keys], outer = new Vector3[Keys];
   public int keys, attack, row; public bool recording, live; public float end;
   readonly GameObject go; readonly Mesh mesh; readonly MeshRenderer renderer; readonly Vector3[] v = new Vector3[Columns * 2]; readonly Vector2[] uv = new Vector2[Columns * 2]; readonly Color[] c = new Color[Columns * 2];
   public Arc(Transform parent, Material m, int index) {
    var tris = new int[(Columns - 1) * 6]; for (int i = 0; i < Columns - 1; i++) { int k = i * 6, q = i * 2; tris[k] = q; tris[k + 1] = q + 1; tris[k + 2] = q + 3; tris[k + 3] = q; tris[k + 4] = q + 3; tris[k + 5] = q + 2; }
    go = new GameObject("Iai blade arc " + index); go.layer = 30; go.transform.SetParent(parent, false);
    mesh = new Mesh { name = "Iai blade arc " + index }; mesh.MarkDynamic(); mesh.vertices = v; mesh.uv = uv; mesh.colors = c; mesh.triangles = tris; mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 4000);
    go.AddComponent<MeshFilter>().sharedMesh = mesh; renderer = go.AddComponent<MeshRenderer>(); renderer.sharedMaterial = m;
    renderer.shadowCastingMode = ShadowCastingMode.Off; renderer.receiveShadows = false; renderer.lightProbeUsage = LightProbeUsage.Off; renderer.reflectionProbeUsage = ReflectionProbeUsage.Off; renderer.enabled = false;
   }
   public void Kill() { live = recording = false; keys = 0; renderer.enabled = false; }
   public void Add(Vector3 guard, Vector3 tip, float H) {
    var a = Vector3.LerpUnclamped(guard, tip, ArcInner[row]); var b = Vector3.LerpUnclamped(guard, tip, ArcOuter);
    if (keys > 0 && (b - outer[keys - 1]).sqrMagnitude < 1e-6f && (a - inner[keys - 1]).sqrMagnitude < 1e-6f) return; // frozen pose (hitstop): no new key
    if (keys == 1 && (b - outer[0]).sqrMagnitude < ArcStartStep * H * ArcStartStep * H) { inner[0] = a; outer[0] = b; return; }
    if (keys == Keys) { Array.Copy(inner, 1, inner, 0, Keys - 1); Array.Copy(outer, 1, outer, 0, Keys - 1); keys--; }
    inner[keys] = a; outer[keys] = b; keys++;
   }
   public Vector3 TipTangent => keys < 2 ? Vector3.zero : outer[keys - 1] - outer[keys - 2];
   static Vector3 CR(Vector3 p0, Vector3 p1, Vector3 p2, Vector3 p3, float t) { float t2 = t * t, t3 = t2 * t; return .5f * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3); }
   public void Draw(float rowV, float opacity, float erode, float H) {
    if (keys < 2) { renderer.enabled = false; return; }
    int cols = (keys - 1) * Sub + 1; float length = 0; for (int i = 1; i < keys; i++) length += (outer[i] - outer[i - 1]).magnitude;
    float thick = Mathf.Clamp01((length / H - ArcMinLength) / ArcGrowLength); if (thick <= 0) { renderer.enabled = false; return; }
    for (int j = 0; j < Columns; j++) {
     int k = j * 2;
     if (j >= cols) { v[k] = v[k + 1] = v[(cols - 1) * 2]; c[k] = c[k + 1] = Color.clear; continue; }
     int seg = Mathf.Min(j / Sub, keys - 2); float t = (j - seg * Sub) / (float)Sub;
     int i0 = Mathf.Max(seg - 1, 0), i3 = Mathf.Min(seg + 2, keys - 1);
     v[k + 1] = CR(outer[i0], outer[seg], outer[seg + 1], outer[i3], t); v[k] = Vector3.LerpUnclamped(v[k + 1], CR(inner[i0], inner[seg], inner[seg + 1], inner[i3], t), thick);
     float along = cols > 1 ? j / (float)(cols - 1) : 1; uv[k] = new Vector2(along, 0); uv[k + 1] = new Vector2(along, 1);
     c[k] = c[k + 1] = new Color(rowV, opacity, erode, 1);
    }
    mesh.vertices = v; mesh.uv = uv; mesh.colors = c; renderer.enabled = true;
   }
   public void Dispose() { if (go) UnityEngine.Object.Destroy(go); if (mesh) UnityEngine.Object.Destroy(mesh); }
  }

  struct Star { public bool live, heavy; public float born, size; public Vector3 pos; }
  struct Ember { public bool live; public float born, life, len, row; public Vector3 p0, vel; }
  struct Puff { public bool live, flip; public float born, width, alpha, side; public Vector3 pos; }
  struct Finish { public bool live; public float born, facing; public Vector3 line, pool; }
  struct Glint { public bool live, big; public float born; }

  readonly GameObject root; readonly Material[] materials; readonly Texture2D rampA, rampB; IaiPalette shown;
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
   return "iai clock=" + clock.ToString("0.000") + " arc0=" + (arcs[0].live ? arcs[0].keys + (arcs[0].recording ? "r" : "e") : "-") + " arc1=" + (arcs[1].live ? arcs[1].keys + (arcs[1].recording ? "r" : "e") : "-") + " stars=" + s + " embers=" + e + " dust=" + p + " line=" + lines.Count + " glint=" + glints.Count + " pal=" + shown;
  }

  public IaiBladeVfx() {
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
   ApplyPalette(); current = this;
  }
  void ApplyPalette() { shown = Palette; var r = shown == IaiPalette.A ? rampA : rampB; foreach (var m in materials) m.SetTexture("_Ramp", r); }

  void Reset() {
   foreach (var a in arcs) a.Kill(); for (int i = 0; i < starPool.Length; i++) starPool[i].live = false; for (int i = 0; i < emberPool.Length; i++) emberPool[i].live = false;
   for (int i = 0; i < puffPool.Length; i++) puffPool[i].live = false; for (int i = 0; i < finishPool.Length; i++) finishPool[i].live = false; KillGlints();
   lastDamage = -1; finishAttack = glintAttack = starAttack = starStrike = starCount = heroAttack = 0; glintSmall = glintBig = false;
  }
  void KillGlints() { for (int i = 0; i < glintPool.Length; i++) glintPool[i].live = false; }
  // Hash noise for spread (deterministic per attack, no Random object state).
  static float Hash(int a, int b) { uint h = (uint)(a * 374761393 + b * 668265263); h = (h ^ (h >> 13)) * 1274126177u; return (h ^ (h >> 16)) / 4294967295f; }

  // Called after the hero pose of this frame is sampled (blade bone valid). Kit hero in a normal zone only.
  void FinishArc(Arc a, Vector3 guard, Vector3 tip, Vector3 ground, float facing, float H) { a.recording = false; a.end = clock; PeakEmbers(a, guard, tip, H); if (a.row == 2) SpawnFinish(a.attack, tip, ground, facing, H); }

  // heroClip / heroSample = the clip and clip time the hero pose shows this frame (Battle3DView.HeroClipName / HeroSampleTime).
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
   if (kind == "cancel") { foreach (var a in arcs) if (a.live) a.Kill(); for (int i = 0; i < finishPool.Length; i++) finishPool[i].live = false; }
   else if (!attacking && kind != "recover") foreach (var a in arcs) if (a.recording) a.Kill();

   // Blade arc. Window = kernel timeline.active[0] (ratios of the kernel duration) taken into clip time with the motion's
   // clipMap (ClipAt, the same mapping the hero pose uses), and compared with the clip time the hero shows this frame.
   // So the arc covers exactly the swing on screen at tempo 0/1/2, also when the shown pose lags the kernel.
   int row = 0; float clipFrom = float.MaxValue, clipTo = float.MaxValue; bool shownRow = false;
   if (attacking) {
    string r = (string)motion["row"]; row = r != null && r.Length == 4 ? Mathf.Clamp(r[3] - '1', 0, 2) : 0;
    var window = (motion["timeline"]?["active"] as JArray); var w0 = window != null && window.Count > 0 ? window[0] : null;
    float from = NativeCombatPresentation.N(w0?["from"], 1), to = NativeCombatPresentation.N(w0?["to"], 1);
    if (attack != mapAttack) { mapAttack = attack; mapCount = NativeCombatPresentation.ReadClipMap(motion["clipMap"] as JArray, ref mapAge, ref mapClip); }
    clipFrom = NativeCombatPresentation.ClipAt(mapAge, mapClip, mapCount, duration * from); clipTo = NativeCombatPresentation.ClipAt(mapAge, mapClip, mapCount, duration * to);
    shownRow = r != null && heroClip != null && heroClip.EndsWith(r, StringComparison.Ordinal);
   }
   foreach (var a in arcs) if (a.recording && (a.attack != attack || !attacking)) FinishArc(a, guard, tip, ground, facing, H); // next hit / sheathe began
   if (attacking && shownRow && heroSample >= clipFrom && heroAttack != attack) {
    heroAttack = attack; var slot = arcs[0].live && (!arcs[1].live || arcs[1].end > arcs[0].end) ? arcs[1] : arcs[0];
    if (slot.live) slot.Kill(); slot.live = slot.recording = true; slot.keys = 0; slot.attack = attack; slot.row = row;
   }
   foreach (var a in arcs) {
    if (!a.recording || a.attack != attack) continue;
    a.Add(guard, tip, H);
    if (heroSample >= clipTo || !shownRow) FinishArc(a, guard, tip, ground, facing, H);
   }
   foreach (var a in arcs) {
    if (!a.live) continue;
    float erode = a.recording ? 0 : Mathf.Clamp01((clock - a.end - ArcHold) / ArcBreak);
    if (!a.recording && clock - a.end > ArcHold + ArcBreak) { a.Kill(); continue; }
    a.Draw(RowV(a.row), 1, erode, H);
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
    if (starCount < 3) { SpawnStar(point, hitRow == 2, H * (hitRow == 2 ? HeavyPlate : StarPlate) * (starCount == 0 ? 1 : starCount == 1 ? .8f : .7f), ground, H); starCount++; }
    var tangent = Vector3.zero; foreach (var a in arcs) if (a.live && a.attack == hitAttack) tangent = a.TipTangent;
    HitEmbers(point, point - new Vector3(ground.x, point.y, ground.z), tangent, hitRow == 2 ? 10 : 6, eventId, H);
    if (hitRow == 2) SpawnFinish(hitAttack, tip, ground, facing, H);
   }

   // Sheathe glint at the scabbard mouth: small at the start of recover (flick), brightest once at sheatheAt.
   if (kit && kind == "recover") {
    if (attack != glintAttack) { glintAttack = attack; glintSmall = glintBig = false; KillGlints(); }
    float sheatheAt = NativeCombatPresentation.N(motion["sheatheAt"], duration);
    if (!glintSmall && age >= 0) { glintSmall = true; SpawnGlint(false); }
    if (!glintBig && age >= sheatheAt) { glintBig = true; SpawnGlint(true); }
   }
   else if (glintAttack != 0) { glintAttack = 0; if (!glintBig) KillGlints(); } // sheathe cut before the blade was home: no glint left

   DrawSprites(cam, hero, H, ground);
  }

  void PeakEmbers(Arc a, Vector3 guard, Vector3 tip, float H) {
   var tangent = a.TipTangent; int n = a.row == 2 ? 8 : 4;
   for (int i = 0; i < n; i++) EmitEmber(tip, tangent, tip - guard, a.attack * 31 + i, a.row, H, .7f);
  }
  void HitEmbers(Vector3 point, Vector3 outward, Vector3 tangent, int n, int seed, float H) { for (int i = 0; i < n; i++) EmitEmber(point, tangent, outward, seed * 17 + i, 3, H, 1); }
  void EmitEmber(Vector3 at, Vector3 tangent, Vector3 outward, int seed, int row, float H, float power) {
   ref var e = ref emberPool[nextEmber++ % emberPool.Length];
   float r0 = Hash(seed, 1), r1 = Hash(seed, 2), r2 = Hash(seed, 3), r3 = Hash(seed, 4);
   var t = tangent.sqrMagnitude > 1e-8f ? tangent.normalized : Vector3.zero; var o = outward.sqrMagnitude > 1e-8f ? outward.normalized : Vector3.up;
   var dir = (t * (.6f + r0) + o * (.5f + r1 * .8f) + new Vector3(r2 - .5f, r3 * .6f, (r1 - .5f) * .3f)).normalized;
   e.live = true; e.born = clock; e.life = .22f + r1 * .2f; e.len = H * (.05f + .05f * r2); e.row = RowV(row); e.p0 = at; e.vel = dir * H * (1.6f + 2.2f * r0) * power;
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
    float k = t / e.life, len = e.len * (1 - .4f * k), wid = len * .4f, a = k < .6f ? 1 : 1 - (k - .6f) / .4f;
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
    float pa = t < 10 ? .30f : t < 16 ? Mathf.Lerp(.30f, .14f, (t - 10) / 6) : Mathf.Lerp(.14f, 0, (t - 16) / 10);
    pools.Quad(f.pool, right * (PoolWidth * H * .5f), up * (PoolWidth * H * .5f * 27 / 413f), Whole, new Color(RowV(2), pa, 0, 1));
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
   foreach (var a in arcs) a?.Dispose(); stars?.Dispose(); heavies?.Dispose(); lines?.Dispose(); embers?.Dispose(); glints?.Dispose(); pools?.Dispose(); dusts?.Dispose();
   if (materials != null) foreach (var m in materials) if (m) UnityEngine.Object.Destroy(m);
   if (root) UnityEngine.Object.Destroy(root);
  }
 }
}
