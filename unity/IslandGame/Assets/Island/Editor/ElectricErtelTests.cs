using NUnit.Framework;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;

namespace IslandGame.Tests {
 // ertel-electric-20261123 stage 2 (ElectricErtelVfx): prefabs, the sword-out judgement on the kit rig, and the kernel-clock sync of
 // the strike (first bolt on the strike time), the lightning ball flight and the arc mine (armed, fuse charge, proximity detonate).
 public sealed class ElectricErtelTests {
  static readonly string[] Prefabs={"Electric_SwordCharge","Electric_Slash","Electric_HitDischarge","Electric_StormSkill","Electric_LightningBall","Electric_ArcDischarge","Electric_ArcArmed","Electric_GroundAura"};

  [Test] public void Game_prefabs_load_on_the_battle_layer(){
   foreach(var name in Prefabs){var p=Resources.Load<GameObject>("ElectricVfx/"+name);Assert.IsNotNull(p,name);foreach(var t in p.GetComponentsInChildren<Transform>(true))Assert.AreEqual(30,t.gameObject.layer,name+"/"+t.name);}
   Assert.IsNotNull(Resources.Load<Material>(IslandVfx.BurnDissolve.TemplateResource),"burn material");
  }

  // Kit prefab (prefab metres): at rest and at the end of a recover / the skill the blade is home; mid swing and at the skill hit it is out.
  // Over the skill clip the blade goes out once and comes home once (no flicker of the charge).
  [Test] public void Kit_blade_is_out_only_between_the_draw_and_the_sheathe(){
   var kit=Battle3DAssets.LoadKit();if(!kit)Assert.Ignore("no kit asset");
   var root=PrefabUtility.LoadPrefabContents(AssetDatabase.GetAssetPath(kit.hero));
   try{
    var blade=root.transform.Find(kit.bladeBone);var sheath=ElectricErtelVfx.FindSheathGrip(root.transform);Assert.IsNotNull(blade,"blade bone");Assert.IsNotNull(sheath,"sheath grip");
    bool In(AnimationClip c,float t){c.SampleAnimation(root,t);return ElectricErtelVfx.Sheathed(sheath,blade.TransformPoint(kit.bladeGuardLocal),blade.TransformPoint(kit.bladeTipLocal));}
    Assert.IsTrue(In(kit.idle,0),"idle: sheathed");
    Assert.IsFalse(In(kit.iai1,.38f),"1st hit mid swing: out");Assert.IsFalse(In(kit.iai3,.50f),"3rd hit mid swing: out");
    Assert.IsTrue(In(kit.iaiRecover,kit.iaiRecover.length),"recover end: sheathed");
    Assert.IsFalse(In(kit.skill,28/60f),"skill hit tick: out");Assert.IsTrue(In(kit.skill,kit.skill.length),"skill end: sheathed");
    int n=Mathf.RoundToInt(kit.skill.length*60)+1,changes=0;bool was=In(kit.skill,0);
    for(int k=1;k<n;k++){bool now=In(kit.skill,k/60f);if(now!=was)changes++;was=now;}
    Assert.AreEqual(2,changes,"skill clip: one draw and one sheathe");
   }finally{PrefabUtility.UnloadPrefabContents(root);}
  }

  static JObject State(float time,JArray fx=null,JObject motion=null,JArray mines=null){
   var s=new JObject{{"id","electric-test"},{"elapsed",time},{"hero",new JObject{{"facing",1},{"motion",motion}}},{"fx",fx??new JArray()}};if(mines!=null)s["arcMines"]=mines;return s;
  }
  static void Run(System.Action<ElectricErtelVfx> body){var go=new GameObject("electric test");var e=new ElectricErtelVfx(go.transform);try{body(e);}finally{e.Dispose();Object.DestroyImmediate(go);}}

  [Test] public void Strike_first_bolt_is_on_the_strike_time_and_the_cast_cue_is_reused(){
   Run(e=>{
    e.Update(State(9.9f),9.9f,null,null,null,default,default,1.2f,false); // first frame of the session
    Assert.IsTrue(e.Strike(new Vector3(2,0,0),10),"strike shown");e.Update(State(10),10,null,null,null,default,default,1.2f,false);
    Assert.AreEqual(ElectricErtelVfx.StormStrikeAt,e.FirstStormTime,1e-4f,"bolt at the strike time");
    e.Update(State(10.5f),10.5f,null,null,null,default,default,1.2f,false);Assert.AreEqual(ElectricErtelVfx.StormStrikeAt+.5f,e.FirstStormTime,1e-4f,"kernel clock");
    e.Update(State(14),14,null,null,null,default,default,1.2f,false);Assert.AreEqual(0,e.ActiveStorms,"ends after the effect");
   });
   Run(e=>{
    var cast=new JObject{{"kind","skill"},{"skillId","storm-call"},{"attackId",7},{"start",20},{"hitAt",.4f},{"target",new JObject{{"x",300},{"y",5000}}}};
    e.Update(State(20.1f,null,cast),20.1f,null,null,null,default,default,1.2f,false);Assert.AreEqual(1,e.ActiveStorms,"cue from the cast");
    Assert.AreEqual(ElectricErtelVfx.StormStrikeAt-.3f,e.FirstStormTime,1e-4f,"cue runs toward the strike");
    Assert.IsTrue(e.Strike(new Vector3(3,0,0),20.4f));e.Update(State(20.4f,null,cast),20.4f,null,null,null,default,default,1.2f,false);
    Assert.AreEqual(1,e.ActiveStorms,"strike pinned the cue (no second storm)");Assert.AreEqual(ElectricErtelVfx.StormStrikeAt,e.FirstStormTime,1e-4f);
   });
  }

  // Hit discharge: electric normal-attack damage at its contact time; electric skill damage (ball, arc, spark) and plain hits get none.
  [Test] public void Hit_discharge_only_for_electric_normal_attacks(){
   Run(e=>{
    JObject Damage(int id,string kind,string element)=>new JObject{{"id",id},{"kind","damage"},{"born",3},{"contactAt",3},{"damageKind",kind},{"element",element},{"point",new JObject{{"x",100},{"y",60},{"z",5000}}}};
    e.Update(State(2.9f,new JArray(Damage(1,"attack","electric"))),2.9f,null,null,null,default,default,1.2f,false);Assert.AreEqual(0,e.ActiveHits,"not before contact");
    e.Update(State(3f,new JArray(Damage(1,"attack","electric"),Damage(2,"skill","electric"),Damage(3,"attack",null))),3f,null,null,null,default,default,1.2f,false);
    Assert.AreEqual(1,e.ActiveHits,"one discharge: the electric normal attack only");
   });
  }

  [Test] public void Ball_follows_the_kernel_flight_and_ends_on_the_burst(){
   Run(e=>{
    var launch=new JObject{{"id",1},{"kind","elemental-launch"},{"ballId",4},{"born",5},{"x",100},{"z",5000},{"elevation",60},{"dirX",1},{"dirZ",0},{"speed",880},{"range",550},{"radius",22}};
    e.Update(State(5.3f,new JArray(launch)),5.3f,null,null,null,default,default,1.2f,false);Assert.AreEqual(1,e.ActiveBalls);Assert.AreEqual(.3f,e.FirstBallTime,1e-4f,"flight on the kernel clock");
    var burst=new JObject{{"id",2},{"kind","elemental-burst"},{"ballId",4},{"born",5.4f},{"x",450},{"z",5000},{"elevation",60},{"radius",90},{"reason","target"}};
    e.Update(State(5.45f,new JArray(launch,burst)),5.45f,null,null,null,default,default,1.2f,false);Assert.AreEqual(.4f,e.FirstBallTime,1e-4f,"head stops at the burst");
   });
  }

  [Test] public void Arc_mine_arms_charges_before_the_fuse_and_detonates_on_proximity(){
   Run(e=>{
    var mine=new JObject{{"id",3},{"x",300},{"y",5000},{"elevation",0},{"from",new JObject{{"x",0},{"y",5000},{"elevation",60}}},{"thrownAt",1},{"landAt",1.35f},{"fuseAt",4.35f},{"radius",150},{"trigger",150}};
    e.Update(State(1.2f,null,null,new JArray(mine)),1.2f,null,null,null,default,default,1.2f,false);Assert.IsTrue(e.MineArmed(3),"armed in flight");
    e.Update(State(2,null,null,new JArray(mine)),2,null,null,null,default,default,1.2f,false);Assert.IsTrue(e.MineArmed(3),"armed on the ground");Assert.AreEqual(-1,e.MineArcTime(3));
    float charge=4.35f-VioletDischarge.DischargeScore.BurstTime;
    e.Update(State(charge+.2f,null,null,new JArray(mine)),charge+.2f,null,null,null,default,default,1.2f,false);
    Assert.IsFalse(e.MineArmed(3),"armed loop replaced");Assert.AreEqual(.2f,e.MineArcTime(3),.02f,"fuse charge started BurstTime before fuseAt");
    e.Update(State(charge+1f,null,null,new JArray(mine)),charge+1f,null,null,null,default,default,1.2f,false);Assert.AreEqual(1f,e.MineArcTime(3),.02f,"charge kept on the kernel clock");
    e.Update(State(4.5f,null,null,new JArray(mine)),4.5f,null,null,null,default,default,1.2f,false);Assert.Less(e.MineArcTime(3),VioletDischarge.DischargeScore.BurstTime,"held before the burst until the burst tick");
   });
   Run(e=>{
    var mine=new JObject{{"id",5},{"x",300},{"y",5000},{"elevation",0},{"from",new JObject{{"x",0},{"y",5000},{"elevation",60}}},{"thrownAt",1},{"landAt",1.35f},{"fuseAt",4.35f},{"radius",150},{"trigger",150}};
    e.Update(State(2,null,null,new JArray(mine)),2,null,null,null,default,default,1.2f,false);
    var burst=new JObject{{"id",9},{"kind","elemental-burst"},{"mineId",5},{"born",2.1f},{"x",300},{"z",5000},{"elevation",0},{"radius",150},{"reason","proximity"}};
    e.Update(State(2.1f,new JArray(burst)),2.1f,null,null,null,default,default,1.2f,false);
    Assert.IsFalse(e.MineArmed(5));Assert.AreEqual(VioletDischarge.DischargeScore.BurstTime,e.MineArcTime(5),1e-3f,"Detonate on the burst tick");
   });
  }
 }
}
