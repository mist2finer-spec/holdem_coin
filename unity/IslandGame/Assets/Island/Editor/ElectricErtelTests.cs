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

  static JObject State(float time,JArray fx=null,JObject motion=null,JArray mines=null,string ertel=null){
   var s=new JObject{{"id","electric-test"},{"elapsed",time},{"hero",new JObject{{"facing",1},{"motion",motion}}},{"fx",fx??new JArray()}};if(mines!=null)s["arcMines"]=mines;if(ertel!=null)s["ertel"]=ertel;return s;
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

  static JObject Damage(int id,string kind,string element,float at=3,float x=100)=>new JObject{{"id",id},{"kind","damage"},{"born",at},{"contactAt",at},{"damageKind",kind},{"element",element},{"point",new JObject{{"x",x},{"y",60},{"z",5000}}}};
  // Hit discharge (2nd adjustment 2026-11-24): an electric normal attack, and every target an electric skill hits (storm 'lightning', ball and
  // arc 'electric'), once per damage event at its contact time, equipped or not. Water skills and plain hits get none. A ball burst adds
  // no discharge of its own (its targets' damage events carry it: no second discharge at the burst point).
  [Test] public void Hit_discharge_for_electric_attacks_and_every_electric_skill_target(){
   Run(e=>{
    e.Update(State(2.9f,new JArray(Damage(1,"attack","electric"))),2.9f,null,null,null,default,default,1.2f,false);Assert.AreEqual(0,e.ActiveHits,"not before contact");
    e.Update(State(3f,new JArray(Damage(1,"attack","electric"),Damage(2,"skill","electric"),Damage(3,"attack",null))),3f,null,null,null,default,default,1.2f,false);
    Assert.AreEqual(2,e.ActiveHits,"electric attack + electric skill hit; the plain attack none");
   });
   Run(e=>{
    // Not equipped (no ertel key): storm on two targets, ball burst on two targets, arc on one, a water skill hit and a plain attack.
    var burst=new JObject{{"id",14},{"kind","elemental-burst"},{"ballId",4},{"born",3},{"x",450},{"z",5000},{"elevation",60},{"radius",90},{"reason","target"}};
    var fx=new JArray(Damage(10,"skill","lightning",3,100),Damage(11,"skill","lightning",3,200),Damage(12,"skill","water"),Damage(13,"attack",null),burst,Damage(15,"skill","electric",3,440),Damage(16,"skill","electric",3,470),Damage(17,"skill","electric",3,300));
    e.Update(State(3.05f,fx),3.05f,null,null,null,default,default,1.2f,false);
    Assert.AreEqual(5,e.ActiveHits,"one discharge per electric skill target (2 storm + 2 ball + 1 arc), none at the ball burst point");
    e.Update(State(3.1f,fx),3.1f,null,null,null,default,default,1.2f,false);Assert.AreEqual(5,e.ActiveHits,"each damage event once");
   });
  }

  // The row slash lives on the Ember slash's effect clock: snapshot time, held while the kernel hitstop holds the pose; gone at its end.
  [Test] public void Row_slash_runs_on_the_effect_clock_and_holds_in_the_hitstop(){
   Run(e=>{
    var hero=new GameObject("hero root");
    try{
     var pose=new IaiBladeVfx.SlashPose{pivotH=new Vector3(.35f,.6f,0),size=.7f,heightM=1.217f,yaw=float.NaN};
     JObject At(float t,float hitstopUntil)=>State(t,null,new JObject{{"kind","attack"},{"attackId",3},{"hitstopUntil",hitstopUntil}},null,"electric");
     e.Update(At(5,-1),5,hero.transform,null,null,default,default,1.217f,false);Assert.IsTrue(e.PlaySlash(3,0,1,Vector3.zero,1.217f,pose));var fx=e.LastSlash;
     e.Update(At(5.1f,-1),5.1f,hero.transform,null,null,default,default,1.217f,false);Assert.AreEqual(.1f,fx.TimeSeconds,1e-4f,"snapshot clock");Assert.IsFalse(fx.IsPlaying,"not on Time.deltaTime");
     e.Update(At(5.2f,5.3f),5.2f,hero.transform,null,null,default,default,1.217f,false);Assert.AreEqual(.1f,fx.TimeSeconds,1e-4f,"held in the hitstop");
     e.Update(At(5.3f,-1),5.3f,hero.transform,null,null,default,default,1.217f,false);Assert.AreEqual(.2f,fx.TimeSeconds,1e-4f,"runs again");
     for(float t=5.4f;t<6.4f;t+=.1f)e.Update(At(t,-1),t,hero.transform,null,null,default,default,1.217f,false);Assert.AreEqual(0,e.ActiveSlashes,"gone after its duration");
    }finally{Object.DestroyImmediate(hero);}
   });
  }

  // 3rd adjustment (2026-11-24): rows 1 and 2 show the part of the Ember arc the Ember slash shows at that moment (head where its head is,
  // tail where its glow is gone, same length and direction, gone with it). Ember visible part: EmberCommon.cginc envelope x tips x end
  // fade > .3; electric: LightningScore.Sweep [tail, head] at RowTime(age), alpha > .15; both through the transforms of the row.
  static float Sm(float a,float b,float x){x=Mathf.Clamp01((x-a)/(b-a));return x*x*(3-2*x);}
  static Vector3 EmberAt(float u,float phase){float a=.39f+4.55f*u,r=(1.66f+.17f*Mathf.Sin(4.3f*u-.35f))*(.934f+.08f*Sm(0,.46f,phase));return new Vector3(r*Mathf.Cos(a)+.075f*u,.10f*Mathf.Sin(a-.45f)+.068f*Mathf.Cos(a*1.61f),r*.85f*Mathf.Sin(a));}
  static Vector3 SweepAt(float u){float an=-2.93f+4.93f*u,r=1.49f*(.87f+.19f*u);return new Vector3(0,1.15f,0)+(new Vector3(1,.21f,.05f)*Mathf.Cos(an)+new Vector3(.04f,.29f,1)*Mathf.Sin(an))*r;}
  static bool EmberShown(float phase,float sweep,float pers,out float lo,out float hi){lo=hi=-1;
   for(int i=0;i<=400;i++){float u=i/400f,age=phase-sweep*(1-Mathf.Pow(Mathf.Max(0,1-u),.8f));
    if(Sm(-.009f,.014f,age)*(1-Sm(.03f,pers*(.68f+.39f*u),age))*Sm(0,.08f,u)*(1-Sm(.885f,1,u))*(1-Sm(.86f,1,phase))>.3f){if(lo<0)lo=u;hi=u;}}return lo>=0;}
  static bool SweepShown(float t,out float lo,out float hi){lo=Sm(.145f,.72f,t)*.998f;hi=Sm(.005f,.22f,t);return t>0&&t<.76f&&Sm(0,.055f,t)*(1-Sm(.43f,.75f,t))>.15f&&hi-lo>.007f;}
  static float ArcLength(System.Func<float,Vector3> p,float lo,float hi){float L=0;var a=p(lo);for(int i=1;i<=60;i++){var b=p(lo+(hi-lo)*i/60f);L+=(b-a).magnitude;a=b;}return L;}
  [Test] public void Rows_1_and_2_show_the_ember_arc_of_each_moment(){
   var profile=JObject.Parse(Resources.Load<TextAsset>("IaiVfx/IaiSlashProfile").text);float heightM=(float)profile["C"]["heightM"];
   var kit=Battle3DAssets.LoadKit();float H=kit?kit.heroHeight:1.2172658f;var report=new System.Text.StringBuilder();
   foreach(float yaw in new[]{float.NaN,35f})foreach(float facing in new[]{1f,-1f})for(int row=0;row<3;row++){
    if(!float.IsNaN(yaw)&&facing<0)continue;
    var em=profile["motions"]["iai"+(row+1)]["ember"];
    var pose=new IaiBladeVfx.SlashPose{pivotH=V3(em["pivotH"]),rotDeg=V3(em["rotDeg"]),rollDeg=(float)em["rollDeg"],size=(float)em["size"],mirror=(bool)em["mirror"],heightM=heightM,yaw=yaw,
     duration=(float)em["duration"],sweep=(float)em["sweep"],persistence=(float)em["persistence"]};
    var rootGo=new GameObject("ember root");var bodyGo=new GameObject("ember body");bodyGo.transform.SetParent(rootGo.transform,false);
    var heroGo=new GameObject("hero root");var host=new GameObject("electric test");var e=new ElectricErtelVfx(host.transform);
    try{
     float k=H/heightM;rootGo.transform.rotation=float.IsNaN(yaw)?Quaternion.identity:Quaternion.Euler(0,yaw,0);rootGo.transform.localScale=new Vector3((float.IsNaN(yaw)?facing:1)*k,k,k);
     bodyGo.transform.localPosition=pose.pivotH*heightM;bodyGo.transform.localRotation=Quaternion.Euler(pose.rotDeg)*Quaternion.AngleAxis(pose.rollDeg,Vector3.up);bodyGo.transform.localScale=new Vector3(pose.mirror?-1:1,1,1);
     JObject At(float t)=>State(t,null,new JObject{{"kind","attack"},{"attackId",7}},null,"electric");
     e.Update(At(2),2,heroGo.transform,null,null,default,default,H,!float.IsNaN(yaw));Assert.IsTrue(e.PlaySlash(7,row,facing,Vector3.zero,H,pose));var fx=e.LastSlash;var T=fx.transform;float size=fx.size;
     Assert.AreEqual(row<2?ElectricErtelVfx.RowGlow:1,fx.intensity,1e-5f,"row "+(row+1)+" brightness");
     // the effect time each frame: RowTime for rows 1 and 2, the plain clock for row 3 (kept)
     e.Update(At(2.1f),2.1f,heroGo.transform,null,null,default,default,H,!float.IsNaN(yaw));
     Assert.AreEqual(row<2?ElectricErtelVfx.RowTime(.1f,pose.duration,pose.sweep,pose.persistence):.1f,fx.TimeSeconds,1e-3f,"row "+(row+1)+" effect time");
     if(row==2)continue;
     foreach(float a in new[]{.033f,.07f,.11f,.15f,.2f,.25f}){
      float phase=a/pose.duration;Assert.IsTrue(EmberShown(phase,pose.sweep,pose.persistence,out float elo,out float ehi),"Ember shown at "+a);
      Assert.IsTrue(SweepShown(ElectricErtelVfx.RowTime(a,pose.duration,pose.sweep,pose.persistence),out float xlo,out float xhi),"row "+(row+1)+" electric shown at "+a);
      System.Func<float,Vector3> E=u=>bodyGo.transform.TransformPoint(EmberAt(u,phase)*pose.size);System.Func<float,Vector3> X=u=>T.TransformPoint(SweepAt(u)*size);
      var ed=E(ehi)-E(elo);var xd=X(xhi)-X(xlo);float eL=ArcLength(E,elo,ehi),xL=ArcLength(X,xlo,xhi),dir=Vector3.Angle(xd,ed),headGap=(X(xhi)-E(ehi)).magnitude,tailGap=(X(xlo)-E(elo)).magnitude;
      string tag="row "+(row+1)+" facing "+facing+" yaw "+yaw+" age "+a;
      report.Append(tag+": direction diff "+dir.ToString("F0")+" deg, length ember "+eL.ToString("F2")+" electric "+xL.ToString("F2")+", head gap "+headGap.ToString("F2")+", tail gap "+tailGap.ToString("F2")+"\n");
      Assert.Less(dir,15,tag+": same direction (start to end)");Assert.That(xL/eL,Is.InRange(.85f,1.25f),tag+": same length");
      Assert.Less(headGap,.25f*H,tag+": head on the Ember head");Assert.Less(tailGap,.2f*H,tag+": tail on the Ember tail");
     }
     // gone with the Ember slash (nothing drawn past it), its pool slot freed
     Assert.IsFalse(EmberShown(.36f/pose.duration,pose.sweep,pose.persistence,out _,out _),"Ember gone");
     Assert.IsFalse(SweepShown(ElectricErtelVfx.RowTime(.37f,pose.duration,pose.sweep,pose.persistence),out _,out _),"row "+(row+1)+" electric gone with it");
     for(float t=2.15f;t<2.5f;t+=.05f)e.Update(At(t),t,heroGo.transform,null,null,default,default,H,!float.IsNaN(yaw));Assert.AreEqual(0,e.ActiveSlashes,"row "+(row+1)+" slot freed");
    }finally{e.Dispose();Object.DestroyImmediate(host);Object.DestroyImmediate(heroGo);Object.DestroyImmediate(rootGo);}
   }
   TestContext.WriteLine(report.ToString());
  }

  // 2nd adjustment item 2: while an electric skill (slot 1 storm-call, 3 lightning-ball, 4 arc-discharge) is cast, none of the old warm
  // effects come with it, equipped or not: no Ember / C skill slash, the cast ring is violet (not the orange one), and its hits get no
  // orange contact spark (the violet discharge instead). Other skills (water-ring, sun-cleave) keep theirs.
  [Test] public void Electric_skills_bring_no_ember_or_warm_effects(){
   foreach(var id in new[]{"storm-call","lightning-ball","arc-discharge"}){
    Assert.IsTrue(ElectricErtelVfx.IsElectricSkill(id),id);Assert.IsFalse(IaiBladeVfx.SkillSlash(id),id+": no kit skill slash");
    var c=ReferenceCombatVfx.EffectColor(ReferenceCombatVfx.CastEffect(id));Assert.Greater(c.b,c.r,id+": cast ring not warm");Assert.Greater(c.b,c.g,id+": cast ring not warm");
   }
   Assert.IsTrue(IaiBladeVfx.SkillSlash("water-ring"),"slot 2 keeps its slash");Assert.IsTrue(IaiBladeVfx.SkillSlash(null));Assert.AreEqual(7,ReferenceCombatVfx.CastEffect("water-ring"));Assert.AreEqual(5,ReferenceCombatVfx.CastEffect("sun-cleave"));
   Assert.IsFalse(CombatFeedbackRouter.ContactSpark(Damage(1,"skill","lightning"),false),"storm hit");Assert.IsFalse(CombatFeedbackRouter.ContactSpark(Damage(2,"skill","electric"),false),"ball / arc hit");
   Assert.IsFalse(CombatFeedbackRouter.ContactSpark(Damage(3,"attack","electric"),false),"ertel attack");Assert.IsTrue(CombatFeedbackRouter.ContactSpark(Damage(4,"skill","water"),false),"water keeps it");
   Assert.IsTrue(CombatFeedbackRouter.ContactSpark(Damage(5,"attack",null),false),"plain hit keeps it");var kit=Damage(6,"attack",null);kit["definitionId"]="pink-iai-1";Assert.IsFalse(CombatFeedbackRouter.ContactSpark(kit,true),"kit star replaces it");
  }

  // 2nd adjustment item 1: the electric row slash is drawn where the Ember row slash of that row is (profile ember pivot H, rotation, roll,
  // mirror, Size; root on the feet, facing / quarter yaw), and follows the feet. Reference = the Ember path (EmberCommon.cginc emberPath)
  // placed with the same transforms IaiBladeVfx.FixedSlot.Place builds; electric = the drawn Electric_Slash vertices at full sweep.
  static Vector3 EmberPath(float u){float a=.39f+4.55f*u,r=(1.66f+.17f*Mathf.Sin(4.3f*u-.35f))*1.014f;return new Vector3(r*Mathf.Cos(a)+.075f*u,.10f*Mathf.Sin(a-.45f)+.068f*Mathf.Cos(a*1.61f),r*.85f*Mathf.Sin(a));}
  static Vector3 V3(JToken t)=>new Vector3((float)t[0],(float)t[1],(float)t[2]);
  [Test] public void Row_slash_sits_on_the_ember_row_slash(){
   var profile=JObject.Parse(Resources.Load<TextAsset>("IaiVfx/IaiSlashProfile").text);float heightM=(float)profile["C"]["heightM"];
   var kit=Battle3DAssets.LoadKit();float H=kit?kit.heroHeight:1.2172658f;
   var report=new System.Text.StringBuilder();
   foreach(float yaw in new[]{float.NaN,35f})foreach(float facing in new[]{1f,-1f})for(int row=0;row<3;row++){
    if(!float.IsNaN(yaw)&&facing<0)continue;
    var em=profile["motions"]["iai"+(row+1)]["ember"];
    var pose=new IaiBladeVfx.SlashPose{pivotH=V3(em["pivotH"]),rotDeg=V3(em["rotDeg"]),rollDeg=(float)em["rollDeg"],size=(float)em["size"],mirror=(bool)em["mirror"],heightM=heightM,yaw=yaw};
    var ground=new Vector3(4,.3f,-.5f);
    // Reference: the FixedSlot transforms (root on the feet, facing / yaw, scale H / heightM; body = pivot, rotation x roll, mirror).
    var rootGo=new GameObject("ember root");var bodyGo=new GameObject("ember body");bodyGo.transform.SetParent(rootGo.transform,false);
    var heroGo=new GameObject("hero root");var host=new GameObject("electric test");var e=new ElectricErtelVfx(host.transform);
    try{
     float k=H/heightM;rootGo.transform.position=ground;rootGo.transform.rotation=float.IsNaN(yaw)?Quaternion.identity:Quaternion.Euler(0,yaw,0);rootGo.transform.localScale=new Vector3((float.IsNaN(yaw)?facing:1)*k,k,k);
     bodyGo.transform.localPosition=pose.pivotH*heightM;bodyGo.transform.localRotation=Quaternion.Euler(pose.rotDeg)*Quaternion.AngleAxis(pose.rollDeg,Vector3.up);bodyGo.transform.localScale=new Vector3(pose.mirror?-1:1,1,1);
     const int n=41;var ember=new Vector3[n];var ec=Vector3.zero;for(int i=0;i<n;i++){ember[i]=bodyGo.transform.TransformPoint(EmberPath(.1f+.9f*i/(n-1))*pose.size);ec+=ember[i]/n;}
     heroGo.transform.position=ground;
     e.Update(State(1,null,null,null,"electric"),1,heroGo.transform,null,null,default,default,H,!float.IsNaN(yaw));
     Assert.IsTrue(e.PlaySlash(1,row,facing,ground,H,pose),"slash taken");var fx=e.LastSlash;Assert.IsNotNull(fx);
     fx.Seek(.24f); // head at the end of the sweep, tail near its start
     var mesh=fx.GetComponent<MeshFilter>().sharedMesh;var verts=new System.Collections.Generic.List<Vector3>();mesh.GetVertices(verts);var used=new System.Collections.Generic.HashSet<int>(mesh.GetIndices(0));
     var pts=new System.Collections.Generic.List<Vector3>();var xc=Vector3.zero;foreach(int i in used){var p=fx.transform.TransformPoint(verts[i]);pts.Add(p);xc+=p;}xc/=Mathf.Max(1,pts.Count);
     Assert.Greater(pts.Count,50,"slash drawn");
     float near=0;foreach(var q in ember){float best=float.MaxValue;foreach(var p in pts)best=Mathf.Min(best,(p-q).sqrMagnitude);near+=Mathf.Sqrt(best)/n;}
     float dh=xc.y-ec.y,dc=(xc-ec).magnitude;
     report.Append("row"+(row+1)+" facing"+facing+" yaw"+yaw+": centre height ember "+(ec.y-ground.y).ToString("F3")+" electric "+(xc.y-ground.y).ToString("F3")+" | centre gap "+dc.ToString("F3")+" | path-to-slash mean "+near.ToString("F3")+"\n");
     Assert.Less(Mathf.Abs(dh),.12f*H,"row "+(row+1)+": same height");Assert.Less(dc,.2f*H,"row "+(row+1)+": same place");Assert.Less(near,.12f*H,"row "+(row+1)+": the electric sweep lies on the Ember path (angle and size)");
     // Follows the feet like the Ember root.
     var before=fx.transform.position;heroGo.transform.position=ground+new Vector3(.7f,0,.2f);
     e.Update(State(1.02f,null,null,null,"electric"),1.02f,heroGo.transform,null,null,default,default,H,!float.IsNaN(yaw));
     Assert.Less((fx.transform.position-before-new Vector3(.7f,0,.2f)).magnitude,1e-4f,"follows the feet");
    }finally{e.Dispose();Object.DestroyImmediate(host);Object.DestroyImmediate(heroGo);Object.DestroyImmediate(rootGo);}
   }
   TestContext.WriteLine(report.ToString());
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
