using NUnit.Framework;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.TestTools.Constraints; // AllocatingGCMemory() extension on Is.Not

namespace IslandGame.Tests {
 // Rev2 port display (1b/1c): kit asset selection and fallback, boot JSON, side framing, pixel switch.
 // The kit is found by a Resources path string only; nothing here references the local-only folder.
 public sealed class Rev2PortDisplayTests {
  string savedPath;
  [SetUp] public void Save(){savedPath=Battle3DAssets.KitResourcePath;}
  [TearDown] public void Restore(){Battle3DAssets.KitResourcePath=savedPath;}

  static JObject Build()=>new JObject{{"skills",new JArray()}};

  [Test] public void Missing_kit_asset_selects_the_original_hero_and_the_old_boot(){
   Battle3DAssets.KitResourcePath="IslandRev2Port/__missing_kit_asset__";
   var chosen=Battle3DAssets.LoadForBattle();var original=Battle3DAssets.LoadDefault();
   Assert.IsNotNull(original,"Resources/Battle3DAssets");
   Assert.AreSame(original,chosen);Assert.IsFalse(chosen.IsKit);
   Assert.IsNull(Battle3DAssets.HeroKitBootId());
   var practice=RpgSession.ReferenceBoot(0,false,Build());var server=RpgSession.TrainingBoot(true,Build());
   Assert.IsNull(practice["heroKit"],practice.ToString());Assert.IsNull(server["heroKit"],server.ToString());
   Assert.AreEqual("mount",(string)practice["mode"]);Assert.AreEqual(0,(int)practice["previewZone"]);Assert.AreEqual("source-run-v2",(string)server["traversalProfile"]);
  }

  [Test] public void Present_kit_asset_is_chosen_and_the_mount_and_boss_boots_carry_heroKit(){
   var kit=Battle3DAssets.LoadKit();
   if(!kit)Assert.Ignore("local kit asset not present in this checkout (expected on machines without the local-only port)");
   Assert.AreSame(kit,Battle3DAssets.LoadForBattle());Assert.AreEqual("pink-iai",kit.kit);
   Assert.AreEqual("pink-iai",(string)RpgSession.ReferenceBoot(0,false,Build())["heroKit"]);
   Assert.AreEqual("pink-iai",(string)RpgSession.TrainingBoot(true,Build())["heroKit"]);
   // boss-kit-hero-20261121 (user): the boss fight runs on the kit hero. Before, both boss boots stayed without the kit.
   var was=Battle3DAssets.BossHeroOverride;
   try{
    Battle3DAssets.BossHeroOverride="kit";
    Assert.AreEqual("pink-iai",(string)RpgSession.ReferenceBoot(9,true,Build())["heroKit"],"boss practice boot takes the kit");
    Assert.AreEqual("pink-iai",(string)RpgSession.TrainingBoot(false,Build())["heroKit"],"boss training boot takes the kit");
    Assert.IsNull(RpgSession.ReferenceBoot(9,true,Build())["bossHero"]);
   }finally{Battle3DAssets.BossHeroOverride=was;}
  }

  // The old (3-head) hero of the boss fight stays one option away: boss boots lose heroKit, every boot says bossHero legacy.
  // Boss scale/camera (2026-11-21): the kit boss fight passes a smaller display height; without one the asset height is kept (legacy).
  [Test] public void Kit_boss_is_shown_smaller_and_the_legacy_boss_keeps_the_asset_height(){
   var a=Resources.Load<UnityBossAssets>("UnityBossAssets");if(!a||!a.boss)Assert.Ignore("boss assets not present");
   var parent=new GameObject("boss scale test").transform;var map=new JObject{{"laneY",192}};
   var legacy=new UnityBossPresentation(parent,a,map);var kit=new UnityBossPresentation(parent,a,map,Battle3DView.KitBossHeight);
   try{Assert.AreEqual(a.bossHeight,legacy.Height,1e-6f,"legacy keeps the asset height");Assert.AreEqual(Battle3DView.KitBossHeight,kit.Height,1e-6f);
    Assert.Less(kit.Height,a.bossHeight*.6f,"kit boss is clearly smaller");Assert.Greater(kit.Height,2f,"still a giant next to the 1.2 m kit hero");
    var q=Battle3DView.KitBossQuarter;Assert.Less(q.verticalFov,38f,"narrower than the old zone-10 preset (80 deg in portrait)");Assert.Less(q.distance,19f);}
   finally{legacy.Dispose();kit.Dispose();Object.DestroyImmediate(parent.gameObject);}
  }
  [Test] public void Boss_hero_legacy_option_keeps_the_old_boss_fight(){
   if(!Battle3DAssets.LoadKit())Assert.Ignore("local kit asset not present in this checkout");
   var was=Battle3DAssets.BossHeroOverride;
   try{
    Battle3DAssets.BossHeroOverride="legacy";Assert.IsTrue(Battle3DAssets.BossHeroLegacy);
    var bossPractice=RpgSession.ReferenceBoot(9,true,Build());var bossServer=RpgSession.TrainingBoot(false,Build());var mount=RpgSession.ReferenceBoot(9,false,Build());
    Assert.IsNull(bossPractice["heroKit"]);Assert.IsNull(bossServer["heroKit"]);Assert.IsNull(bossPractice["kitTempo"]);
    Assert.AreEqual("legacy",(string)bossPractice["bossHero"]);Assert.AreEqual("legacy",(string)bossServer["bossHero"]);
    Assert.AreEqual("pink-iai",(string)mount["heroKit"],"zones 1-9 keep the kit");Assert.AreEqual("legacy",(string)mount["bossHero"],"the kernel keeps the zone-10 boss on the old hero");
   }finally{Battle3DAssets.BossHeroOverride=was;}
  }

  [Test] public void Kit_asset_missing_a_required_clip_is_not_used(){
   var a=ScriptableObject.CreateInstance<Battle3DAssets>();
   try{
    a.kit="pink-iai";Assert.IsFalse(a.KitComplete);
    var d=Battle3DAssets.LoadDefault();a.hero=d.hero;a.slime=d.slime;a.slimeIdle=d.slimeIdle;
    a.idle=a.run=a.iai1=a.iai2=a.iai3=a.iaiRecover=new AnimationClip();Assert.IsFalse(a.KitComplete,"no skill clip");
    a.skill=new AnimationClip();Assert.IsTrue(a.KitComplete);
   }finally{Object.DestroyImmediate(a);}
  }

  [Test] public void Kit_clip_table_follows_the_kernel_contract(){
   var a=ScriptableObject.CreateInstance<Battle3DAssets>();
   try{
    a.kit="pink-iai";AnimationClip C(string n)=>new AnimationClip{name=n};
    a.idle=C("idle");a.run=C("run");a.iai1=C("i1");a.iai2=C("i2");a.iai3=C("i3");a.iaiRecover=C("r3");a.iaiRecoverFrom1=C("r1");a.iaiRecoverFrom2=C("r2");a.skill=C("mist");a.avoid=C("burst");a.roll=C("roll");
    a.jumpStart=C("js");a.jumpLoop=C("jl");a.jumpLand=C("jd");a.slide=C("sl");a.hit=C("hit");a.death=C("death");a.knockback=C("kb");
    Assert.AreEqual("idle",a.HeroClip("stay1").name);Assert.AreEqual("run",a.HeroClip("run1").name);Assert.AreEqual("run",a.HeroClip("dash").name,"AUTO dash without a dash clip runs");
    Assert.AreEqual("i1",a.HeroClip("iai1").name);Assert.AreEqual("i2",a.HeroClip("iai2").name);Assert.AreEqual("i3",a.HeroClip("iai3").name);
    Assert.AreEqual("r1",a.HeroClip("iai_recover","iai1").name);Assert.AreEqual("r2",a.HeroClip("iai_recover","iai2").name);Assert.AreEqual("r3",a.HeroClip("iai_recover","iai3").name);
    Assert.AreEqual("mist",a.HeroClip("skill2").name);Assert.AreEqual("burst",a.HeroClip("avoid1").name,"roll is drawn as the front dash, never the game roll");
    Assert.AreEqual("js",a.HeroClip("jump1").name);Assert.AreEqual("jl",a.HeroClip("jump3").name);Assert.AreEqual("jd",a.HeroClip("jump5").name);Assert.AreEqual("sl",a.HeroClip("sliding1").name);
    Assert.AreEqual("hit",a.HeroClip("damage").name);Assert.AreEqual("death",a.HeroClip("death").name);Assert.AreEqual("kb",a.HeroClip("knockback").name);
    a.kit="";Assert.AreEqual("roll",a.HeroClip("avoid1").name,"without the kit the original table is used");
   }finally{Object.DestroyImmediate(a);}
  }

  // work/tech-director/frame_calc.py: direct output (pixel art off), side pitch 10, ground at 0.18, hero 1.3 m, 28 % of the visible 88 %.
  static float Fov(float w,float h){float rect=w/(h*.5f);return BattleCameraController.LockedVerticalFov(20,.5625f*1/.5f,rect);}
  [Test] public void Side_distance_for_a_28_percent_hero_matches_frame_calc(){
   float d1=BattleCameraController.SideDistanceForHeroFraction(1.3f,.28f*.88f,Fov(1080,2340),10,.18f);
   float d2=BattleCameraController.SideDistanceForHeroFraction(1.3f,.28f*.88f,Fov(1306,2299),10,.18f);
   Assert.AreEqual(24.26f,Fov(1080,2340),.01f);Assert.AreEqual(20f,Fov(1306,2299),.01f);
   Assert.AreEqual(11.73f,d1,.01f,"1080x2340");Assert.AreEqual(14.37f,d2,.01f,"1306x2299");
  }

  [Test] public void Solved_distance_puts_the_hero_at_the_fraction_through_a_real_camera(){
   var go=new GameObject("frame test");
   try{
    var cam=go.AddComponent<Camera>();float aspect=1080f/1170f,fov=Fov(1080,2340),pitch=10,gy=.18f,h=1.3f;
    cam.aspect=aspect;cam.fieldOfView=fov;cam.nearClipPlane=.1f;cam.farClipPlane=200;
    float d=BattleCameraController.SideDistanceForHeroFraction(h,.28f*.88f,fov,pitch,gy);
    // same pivot rule as BattleCameraController.Tick (keepGroundFraming)
    float q=(gy*2-1)*Mathf.Tan(fov*Mathf.Deg2Rad*.5f),p=pitch*Mathf.Deg2Rad,framed=-q*d/Mathf.Max(.1f,Mathf.Cos(p)+q*Mathf.Sin(p));
    var rot=Quaternion.Euler(pitch,0,0);cam.transform.rotation=rot;cam.transform.position=new Vector3(0,framed,0)+rot*new Vector3(0,0,-d);
    float feet=cam.WorldToViewportPoint(Vector3.zero).y,head=cam.WorldToViewportPoint(new Vector3(0,h,0)).y;
    Assert.AreEqual(.18f,feet,.002f);Assert.AreEqual(.28f,(head-feet)/.88f,.002f);
   }finally{Object.DestroyImmediate(go);}
  }

  // U0-2: one run-option helper on both boot builders. AUTO skills on; forks wait for U1; kitTempo only when a dev choice exists and the kit is in the boot.
  [Test] public void Run_options_turn_on_auto_skills_and_carry_the_dev_tempo_only_when_chosen(){
   bool had=PlayerPrefs.HasKey(Battle3DAssets.DevKitTempoKey);int was=PlayerPrefs.GetInt(Battle3DAssets.DevKitTempoKey,-1);
   try{
    Battle3DAssets.DevKitTempo=-1;
    foreach(var b in new[]{RpgSession.ReferenceBoot(0,false,Build()),RpgSession.ReferenceBoot(9,false,Build()),RpgSession.ReferenceBoot(9,true,Build()),RpgSession.TrainingBoot(true,Build()),RpgSession.TrainingBoot(false,Build())}){
     Assert.AreEqual(true,(bool?)b["autoSkills"],b.ToString());Assert.IsNull(b["forks"],"forks wait for U1");Assert.IsNull(b["kitTempo"],"no choice = no key = kernel default");}
    Battle3DAssets.DevKitTempo=2;Assert.AreEqual(2,(int)Battle3DAssets.WithRunOptions(new JObject{{"mode","mount"},{"heroKit","pink-iai"}})["kitTempo"]);
    Assert.IsNull(Battle3DAssets.WithRunOptions(new JObject{{"mode","boss"}})["kitTempo"],"no kit in the boot, no tempo key");
    Battle3DAssets.DevKitTempo=0;Assert.AreEqual(0,(int)Battle3DAssets.WithRunOptions(new JObject{{"mode","mount"},{"heroKit","pink-iai"}})["kitTempo"],"stage 0 is a choice too");
   }finally{Battle3DAssets.DevKitTempo=had?was:-1;}
  }

  // U0-3 (K6): stage-1 maps from the kernel (rpg-hero-kit-iai.ts rowClipMap / recoverClipMap), values printed by run-structure-20261119/qa_U0/work/maps.mts.
  static JArray Map(params float[] v){var m=new JArray();for(int i=0;i<v.Length;i+=2)m.Add(new JArray(v[i],v[i+1]));return m;}
  static readonly float[] Iai1Stage1={0,0,.19111111f,.28666667f,.37444444f,.47f,.50539683f,.65333333f};
  static readonly float[] RecoverStage1={0,0,.62222222f,.93333333f,1.42222222f,1.73333333f};
  [Test] public void ClipAt_follows_the_kernel_map_and_is_one_to_one_without_one(){
   var iai1=Map(Iai1Stage1);
   foreach(var (age,clip) in new[]{(.05f,.075f),(.1f,.15f),(.2f,.29555556f),(.3f,.39555556f),(.5f,.64577778f),(.8f,.94793651f),(1f,1.14793651f)})Assert.AreEqual(clip,NativeCombatPresentation.ClipAt(iai1,age),1e-4f,"iai1 age "+age);
   Assert.AreEqual(.65333333f,NativeCombatPresentation.ClipAt(iai1,.50539683f),1e-4f,"motion end = clip end");
   Assert.AreEqual(.28666667f,NativeCombatPresentation.ClipAt(iai1,.19111111f),1e-4f,"kernel hitAt = clip activeFrom");
   var rec=Map(RecoverStage1);
   foreach(var (age,clip) in new[]{(.1f,.15f),(.3f,.45f),(.6f,.9f),(.9f,1.21111111f),(1.5f,1.81111111f)})Assert.AreEqual(clip,NativeCombatPresentation.ClipAt(rec,age),1e-4f,"recover age "+age);
   foreach(float age in new[]{-.1f,0,.3f,2f})Assert.AreEqual(age,NativeCombatPresentation.ClipAt((JArray)null,age),"no map (stage 0) = 1:1");
   float last=-1;for(float age=0;age<1.2f;age+=.01f){float c=NativeCombatPresentation.ClipAt(iai1,age);Assert.GreaterOrEqual(c,last,"never runs back");last=c;}
  }
  [Test] public void Clip_map_is_read_once_and_sampled_without_allocating(){
   var iai1=Map(Iai1Stage1);float[] ages=null,clips=null;
   int n=NativeCombatPresentation.ReadClipMap(iai1,ref ages,ref clips);Assert.AreEqual(4,n);
   Assert.AreEqual(0,NativeCombatPresentation.ReadClipMap(null,ref ages,ref clips),"no map");
   for(float age=-.05f;age<1.2f;age+=.013f)Assert.AreEqual(NativeCombatPresentation.ClipAt(iai1,age),NativeCombatPresentation.ClipAt(ages,clips,n,age),1e-5f,"cached = JArray at "+age);
   Assert.AreEqual(.6f,NativeCombatPresentation.ClipAt(ages,clips,0,.6f),"count 0 = 1:1");
   // GC.GetAllocatedBytesForCurrentThread is 0 on the Editor Mono; the Test Framework constraint counts GC.Alloc samples instead.
   var probe=ages;float sink=0;
   Assert.That(()=>{for(int i=0;i<1000;i++)sink+=NativeCombatPresentation.ClipAt(ages,clips,n,i*.001f);},UnityEngine.TestTools.Constraints.Is.Not.AllocatingGCMemory(),"per-frame ClipAt");
   Assert.That(()=>{n=NativeCombatPresentation.ReadClipMap(iai1,ref ages,ref clips);},UnityEngine.TestTools.Constraints.Is.Not.AllocatingGCMemory(),"re-read into the kept arrays");
   Assert.AreSame(probe,ages,"re-read keeps the arrays");
   Assert.That(()=>{var check=new float[16];sink+=check.Length;},UnityEngine.TestTools.Constraints.Is.AllocatingGCMemory(),"the counter sees an allocation ("+sink+")");
  }

  [Test] public void Pixel_art_is_off(){
   var s=Resources.Load<PixelArtSettings>("PixelArtSettings");Assert.IsNotNull(s);Assert.IsFalse(s.enabled);Assert.IsFalse(PixelArtSettings.Active);
  }
 }
}
