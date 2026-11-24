using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using StormglassVfx;
using UnityEngine;
using VioletCurrent;
using VioletDischarge;
namespace IslandGame {
 // ertel-electric-20261123 stage 2: display of the electric ertel and its two trial skills. Kernel state only: no damage, timing or
 // contact change, no added display delay. Prefabs: Resources/ElectricVfx (technical-artist HANDOFF 2026-11-23), layer 30, violet.
 //  Equipped (view key ertel == "electric"):
 //   - Electric_SwordCharge on the kit blade only while the blade is out of the scabbard (Sheathed: scabbard rig geometry, so the side
 //     view, the quarter view and the kit skill PG_mist_finer all follow the pose on screen). Shown from the draw, gone when sheathed.
 //   - Electric_Slash instead of the Ember row slash (IaiBladeVfx.AttackSlash, same spawn moment). The skill slash keeps its own.
 //   - Electric_HitDischarge at the contact point of damage events with element "electric" (normal attacks; mobs and the boss).
 //   - Electric_GroundAura under the hero (child of the hero root).
 //  Always (electric skills):
 //   - The lightning strike (slot 1 spark) as Electric_StormSkill: the effect is driven so its first bolt (StormStrikeAt) lands on the
 //     kernel strike time (fx born); the cast starts the cue early (born = cast start + hitAt), the strike event then pins it.
 //   - Lightning balls: elemental-launch / lightningBalls place the flight (driven by the kernel clock), elemental-burst ends it.
 //   - Arc mines: elemental-throw / arcMines fly the armed loop (Electric_ArcArmed) to the landing point; the fuse burst starts
 //     Electric_ArcDischarge BurstTime before fuseAt (so its burst is on the fuse tick); a proximity / overflow burst calls Detonate()
 //     on its tick. The discharge plays its own sound.
 public sealed class ElectricErtelVfx:IDisposable{
  public const string Electric="electric";
  // Electric_StormSkill score (LightningScore.Skill): the first downward bolt starts 1.42 s into the effect.
  public const float StormStrikeAt=1.42f;
  // Scabbard rig in sheath-grip local metres (kit-scabbard-v1; KitSkillSheatheTests): mouth and scabbard tip.
  public static readonly Vector3 SheathMouth=new Vector3(0,-.1939f,0),SheathTip=new Vector3(.0001f,-1.3302f,.0675f);
  // Sheathed = the blade grip is within DrawOut of its home along the scabbard and the blade tip is inside the scabbard tube.
  public const float DrawOut=.06f,TubeRadius=.06f;
  public static bool Sheathed(Transform sheathGrip,Vector3 bladeGrip,Vector3 bladeTip){
   if(!sheathGrip)return false;
   Vector3 axis=SheathTip-SheathMouth;float length=axis.magnitude;axis/=length;
   Vector3 g=sheathGrip.InverseTransformPoint(bladeGrip)-SheathMouth,t=sheathGrip.InverseTransformPoint(bladeTip)-SheathMouth;
   float home=Vector3.Dot(-SheathMouth,axis),dg=Vector3.Dot(g,axis),dt=Vector3.Dot(t,axis),side=(t-axis*dt).magnitude;
   return dg>=home-DrawOut&&dt>0&&dt<=length+.05f&&side<=TubeRadius;
  }
  public static Transform FindSheathGrip(Transform hero){
   if(!hero)return null;
   foreach(var t in hero.GetComponentsInChildren<Transform>(true))if(t.name=="G_katana_saya_grip"&&!t.GetComponent<Renderer>()&&t.parent&&t.parent.parent&&t.parent.parent.name=="Scabbard")return t;
   return null;
  }
  // Electric_Slash form per combo row (1st, 2nd, 3rd) and size against the prefab (its sweeps are centred 1.15-1.55 m up at size 1,
  // a 1.7 m figure): the kit hero height scales it.
  static readonly SlashForm[] RowForm={SlashForm.Overhead,SlashForm.Cross,SlashForm.Cross};
  static readonly float[] RowSize={1,1,1.2f};
  const float FigureHeight=1.7f,ArmedArc=.5f;

  // Destroy in play mode, DestroyImmediate in an EditMode test.
  static void Kill(UnityEngine.Object o){if(!o)return;if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
  static GameObject Prefab(string name)=>Resources.Load<GameObject>("ElectricVfx/"+name);
  static float N(JToken t,float f=0)=>NativeCombatPresentation.N(t,f);
  static Vector3 P(float x,float elevation,float laneY)=>new Vector3(x/100,elevation/100,(laneY-5000)/100);

  sealed class Pool<T> where T:Component{
   readonly string name;readonly Transform parent;readonly int cap;readonly List<T> items=new List<T>();int next;bool missing;
   public Pool(string name,Transform parent,int cap){this.name=name;this.parent=parent;this.cap=cap;}
   public bool Available=>!missing;
   public T Take(){
    foreach(var e in items)if(e&&!e.gameObject.activeSelf){e.gameObject.SetActive(true);return e;}
    if(items.Count<cap&&!missing){var prefab=Prefab(name);if(!prefab){missing=true;return null;}var go=UnityEngine.Object.Instantiate(prefab,parent,false);go.name=name+" "+items.Count;var c=go.GetComponent<T>();if(!c){Kill(go);missing=true;return null;}items.Add(c);return c;}
    if(items.Count==0)return null;var r=items[next++%items.Count];r.gameObject.SetActive(false);r.gameObject.SetActive(true);return r;
   }
   public int Active{get{int n=0;foreach(var e in items)if(e&&e.gameObject.activeSelf)n++;return n;}}
   public void RetireFinished(){foreach(var e in items)if(e&&e.gameObject.activeSelf&&e is LightningEffect l&&!l.IsPlaying)e.gameObject.SetActive(false);}
   public void Clear(){foreach(var e in items)if(e)e.gameObject.SetActive(false);}
   public void Dispose(){foreach(var e in items)if(e)Kill(e.gameObject);items.Clear();}
  }
  sealed class Storm{public LightningEffect fx;public float born;public bool pending;public Vector3 pos;}
  sealed class Ball{public LightningBall fx;public int id;public float born,flight,end;public bool released;}
  sealed class Mine{public int id;public Vector3 from,to;public float thrownAt,landAt,fuseAt,burstAt=float.NaN,lastSeen;public Vector3 burstPos;public LightningEffect armed;public ArcDischarge arc;public bool burst;}

  readonly Transform parent;
  readonly Pool<LightningEffect> slashes,hits,storms,armedPool;readonly Pool<LightningBall> ballPool;readonly Pool<ArcDischarge> arcPool;
  readonly List<Storm> stormRuns=new List<Storm>();readonly List<Ball> ballRuns=new List<Ball>();readonly List<Mine> mineRuns=new List<Mine>();
  readonly List<LightningEffect> attackSlashes=new List<LightningEffect>();
  LightningEffect charge;Transform chargeWeapon,chargeBase,chargeTip,sheathHero,sheathGrip;GameObject aura;Transform auraRoot;
  string session;float previous=-1;int lastDamage,lastLaunch,lastThrow,lastBurst,castAttack;
  Vector3 heroForward=Vector3.right;float heroHeight=1.2f;
  public bool Equipped{get;private set;}
  public bool BladeOut{get;private set;}
  public bool ChargeVisible=>charge&&charge.gameObject.activeSelf;
  public bool AuraVisible=>aura&&aura.activeSelf;
  public int ActiveStorms=>stormRuns.Count;public int ActiveBalls=>ballRuns.Count;public int ActiveMines=>mineRuns.Count;
  public int ActiveSlashes=>slashes.Active;public int ActiveHits=>hits.Active;
  // Tests / QA: clock of the first storm, of the first ball and the arc discharge of a mine (-1 = none).
  public float FirstStormTime=>stormRuns.Count>0&&stormRuns[0].fx?stormRuns[0].fx.TimeSeconds:-1;
  public float FirstBallTime=>ballRuns.Count>0&&ballRuns[0].fx?ballRuns[0].fx.TimeSeconds:-1;
  public float MineArcTime(int id){var m=MineOf(id,false);return m!=null&&m.arc?m.arc.TimeSeconds:-1;}
  public bool MineArmed(int id){var m=MineOf(id,false);return m!=null&&m.armed;}
  public string Describe()=>"ertel="+(Equipped?Electric:"none")+" blade="+(BladeOut?"out":"in")+" charge="+(ChargeVisible?1:0)+" aura="+(AuraVisible?1:0)+" slash="+slashes.Active+" hit="+hits.Active+" storm="+stormRuns.Count+" ball="+ballRuns.Count+" mine="+mineRuns.Count+(mineRuns.Count>0?"("+MineText()+")":"");
  string MineText(){var s="";foreach(var m in mineRuns)s+=(s.Length>0?",":"")+m.id+(m.burst?"B":m.arc?"C":"A");return s;}

  public ElectricErtelVfx(Transform parent){
   this.parent=parent;slashes=new Pool<LightningEffect>("Electric_Slash",parent,2);hits=new Pool<LightningEffect>("Electric_HitDischarge",parent,6);
   storms=new Pool<LightningEffect>("Electric_StormSkill",parent,6);armedPool=new Pool<LightningEffect>("Electric_ArcArmed",parent,4);
   ballPool=new Pool<LightningBall>("Electric_LightningBall",parent,4);arcPool=new Pool<ArcDischarge>("Electric_ArcDischarge",parent,4);
  }

  // Called by Battle3DView after the hero pose of this frame (blade bone valid) and before IaiBladeVfx.Update (AttackSlash uses heroForward).
  public void Update(JObject state,float time,Transform heroRoot,Transform heroModel,Transform weapon,Vector3 baseLocal,Vector3 tipLocal,float height,bool planar){
   string id=(string)state["id"];
   if(id!=session||time<previous-.5f){Reset();session=id;}previous=time;
   Equipped=(string)state["ertel"]==Electric;heroHeight=height>.1f?height:1.2f;
   var h=state["hero"];var motion=h?["motion"] as JObject;string kind=(string)motion?["kind"];
   float facing=N(h?["facing"],1)<0?-1:1;
   if(planar){var d=new Vector3(N(h?["direction"]?["x"],facing),0,N(h?["direction"]?["y"]));heroForward=d.sqrMagnitude>1e-6f?d.normalized:new Vector3(facing,0,0);}else heroForward=new Vector3(facing,0,0);
   // Cut off (cancel into a move or a skill, an evade that replaced an attack): no electric row slash stays in the air.
   if(kind=="cancel"||kind=="skill"||motion?["cancelledAttackId"]!=null)foreach(var s in attackSlashes)if(s&&s.gameObject.activeSelf)s.Stop();
   UpdateCharge(heroModel,weapon,baseLocal,tipLocal);UpdateAura(heroRoot);
   // Strike cue: the slot-1 lightning cast (kit storm-call) starts its Electric_StormSkill so the first bolt is on start + hitAt.
   int attack=(int?)motion?["attackId"]??0;
   if(kind=="skill"&&(string)motion["skillId"]=="storm-call"&&attack!=castAttack&&time>=N(motion["start"])){
    castAttack=attack;var target=motion["target"];float born=N(motion["start"])+N(motion["hitAt"]);
    var pos=new Vector3(N(target?["x"])/100,heroRoot?heroRoot.position.y:0,(N(target?["y"],5000)-5000)/100);
    if(born>time)StartStorm(pos,born,true);
   }
   var fx=state["fx"] as JArray;int count=fx?.Count??0;
   for(int i=0;i<count;i++){
    var t=fx[i];string k=(string)t["kind"];int eventId=(int?)t["id"]??0;
    if(k=="damage"){
     // Normal attacks only (damageKind attack): ball / arc / spark damage has its own burst on screen.
     if(eventId<=lastDamage||(string)t["element"]!=Electric||(string)t["damageKind"]!="attack")continue;var p=t["point"];if(p==null)continue;
     float contact=N(t["contactAt"],N(t["born"]));if(time<contact)continue;lastDamage=eventId;if(time-contact>.45f)continue;
     PlayHit(new Vector3(N(p["x"])/100,N(p["y"])/100,(N(p["z"])-5000)/100),1);
    }
    else if(k=="elemental-launch"){if(eventId<=lastLaunch)continue;lastLaunch=eventId;LaunchBall((int?)t["ballId"]??0,P(N(t["x"]),N(t["elevation"]),N(t["z"],5000)),new Vector3(N(t["dirX"],1),0,N(t["dirZ"])),N(t["range"])/100,N(t["range"])/Mathf.Max(1,N(t["speed"],880)),N(t["radius"],22)/100,N(t["born"]));}
    else if(k=="elemental-throw"){if(eventId<=lastThrow)continue;lastThrow=eventId;var m=MineOf((int?)t["mineId"]??0,true);m.from=P(N(t["fromX"]),N(t["fromElevation"]),N(t["fromZ"],5000));m.to=P(N(t["x"]),N(t["elevation"]),N(t["z"],5000));m.thrownAt=N(t["born"]);m.landAt=N(t["landAt"]);m.fuseAt=N(t["fuseAt"]);m.lastSeen=time;}
    else if(k=="elemental-burst"){
     float born=N(t["born"]);if(eventId<=lastBurst||time<born)continue;lastBurst=eventId;var pos=P(N(t["x"]),N(t["elevation"]),N(t["z"],5000));
     if(t["mineId"]!=null){var m=MineOf((int)t["mineId"],true);if(float.IsNaN(m.burstAt)){m.burstAt=born;m.burstPos=pos;if(m.to==Vector3.zero)m.to=pos;m.lastSeen=time;}}
     else if(t["ballId"]!=null){EndBall((int)t["ballId"],born,time);if((string)t["reason"]!="range")PlayHit(pos,1.3f);}
    }
   }
   // View fallback (a launch or throw event not seen, e.g. joined late): the flight and the placed mines from lightningBalls / arcMines.
   if(state["lightningBalls"] is JArray balls)foreach(var b in balls){int bid=(int?)b["id"]??0;if(FindBall(bid)!=null)continue;var dir=new Vector3(N(b["dirX"],1),0,N(b["dirY"]));var now=P(N(b["x"]),N(b["elevation"]),N(b["y"],5000));LaunchBall(bid,now-dir.normalized*N(b["travelled"])/100,dir,N(b["range"])/100,N(b["range"])/Mathf.Max(1,N(b["speed"],880)),N(b["radius"],22)/100,N(b["born"]));}
   if(state["arcMines"] is JArray mines)foreach(var v in mines){var m=MineOf((int?)v["id"]??0,true);m.lastSeen=time;if(m.landAt<=0){var f=v["from"];m.from=P(N(f?["x"]),N(f?["elevation"]),N(f?["y"],5000));m.to=P(N(v["x"]),N(v["elevation"]),N(v["y"],5000));m.thrownAt=N(v["thrownAt"]);m.landAt=N(v["landAt"]);m.fuseAt=N(v["fuseAt"]);}}
   StepStorms(time);StepBalls(time);StepMines(time);
   slashes.RetireFinished();hits.RetireFinished();
  }

  // IaiBladeVfx.AttackSlash: the row slash spawn moment of an attack. true = taken over (no Ember slash).
  public bool PlaySlash(int attack,int row,float facing,Vector3 ground,float height){
   if(!Equipped)return false;var s=slashes.Take();if(!s)return false;
   int r=Mathf.Clamp(row,0,2);float H=height>.1f?height:heroHeight;
   s.slashForm=RowForm[r];s.size=.82f*RowSize[r]*H/FigureHeight;
   var forward=heroForward.sqrMagnitude>1e-6f?heroForward:new Vector3(facing,0,0);
   s.PlayAt(ground+forward*(.18f*H),Quaternion.LookRotation(forward,Vector3.up));
   if(!attackSlashes.Contains(s))attackSlashes.Add(s);return true;
  }
  void PlayHit(Vector3 point,float scale){var e=hits.Take();if(!e)return;e.size=.65f*scale;e.PlayAt(point,Quaternion.identity);}

  // ReferenceCombatVfx.StrikeDisplay: one lightning strike (fx born, ground point). true = shown here (no old strike).
  public bool Strike(Vector3 ground,float born){
   if(!storms.Available)return false;
   foreach(var s in stormRuns)if(s.pending&&Mathf.Abs(s.born-born)<.25f&&(new Vector2(s.pos.x-ground.x,s.pos.z-ground.z)).magnitude<2.5f){s.pending=false;s.born=born;s.pos=ground;return true;}
   return StartStorm(ground,born,false);
  }
  bool StartStorm(Vector3 pos,float born,bool pending){
   var fx=storms.Take();if(!fx)return false;for(int i=stormRuns.Count-1;i>=0;i--)if(stormRuns[i].fx==fx)stormRuns.RemoveAt(i);fx.Pause();fx.transform.SetPositionAndRotation(pos,Quaternion.identity);
   stormRuns.Add(new Storm{fx=fx,born=born,pending=pending,pos=pos});return true;
  }
  void StepStorms(float time){
   for(int i=stormRuns.Count-1;i>=0;i--){
    var s=stormRuns[i];float t=StormStrikeAt+time-s.born;
    if(!s.fx||(s.pending&&time>s.born+.35f)||t>=s.fx.Duration){if(s.fx)s.fx.gameObject.SetActive(false);stormRuns.RemoveAt(i);continue;}
    s.fx.transform.position=s.pos;s.fx.Seek(Mathf.Max(0,t));
   }
  }

  Ball FindBall(int id){foreach(var b in ballRuns)if(b.id==id)return b;return null;}
  void LaunchBall(int id,Vector3 start,Vector3 dir,float range,float seconds,float radius,float born){
   if(FindBall(id)!=null||dir.sqrMagnitude<1e-8f)return;var fx=ballPool.Take();if(!fx)return;for(int i=ballRuns.Count-1;i>=0;i--)if(ballRuns[i].fx==fx)ballRuns.RemoveAt(i);
   fx.radius=Mathf.Max(.05f,radius);fx.Launch(start,start+dir.normalized*Mathf.Max(.1f,range),Mathf.Max(.05f,seconds));fx.Pause();
   ballRuns.Add(new Ball{fx=fx,id=id,born=born,flight=Mathf.Max(.05f,seconds)});
  }
  void EndBall(int id,float born,float time){
   var b=FindBall(id);if(b==null||b.released)return;b.released=true;
   b.fx.Seek(Mathf.Clamp(born-b.born,0,b.flight));b.fx.Resume();b.fx.EndFlight();b.end=time;
  }
  void StepBalls(float time){
   for(int i=ballRuns.Count-1;i>=0;i--){
    var b=ballRuns[i];if(!b.fx){ballRuns.RemoveAt(i);continue;}
    if(!b.released){b.fx.Seek(Mathf.Clamp(time-b.born,0,b.flight));if(time-b.born>b.flight+1.5f)EndBall(b.id,time,time);continue;}
    if(b.fx.TimeSeconds>=b.fx.Duration-1e-4f||time-b.end>b.fx.Duration+.5f){b.fx.gameObject.SetActive(false);ballRuns.RemoveAt(i);}
   }
  }

  Mine MineOf(int id,bool create){foreach(var m in mineRuns)if(m.id==id)return m;if(!create)return null;var n=new Mine{id=id};mineRuns.Add(n);return n;}
  void StepMines(float time){
   for(int i=mineRuns.Count-1;i>=0;i--){
    var m=mineRuns[i];
    if(!m.burst&&!float.IsNaN(m.burstAt)&&time>=m.burstAt){
     // Burst tick: the fuse discharge is already at its burst (started BurstTime before fuseAt); proximity / overflow detonate now.
     m.burst=true;KillArmed(m);
     if(!m.arc){m.arc=arcPool.Take();if(m.arc){m.arc.PlayAt(m.burstPos);m.arc.Detonate();}}
     else if(m.arc.TimeSeconds<DischargeScore.BurstTime){m.arc.transform.position=m.burstPos;m.arc.Detonate();}
    }
    if(m.burst){if(!m.arc||!m.arc.gameObject.activeSelf||m.arc.TimeSeconds>=m.arc.Duration-1e-3f){if(m.arc)m.arc.gameObject.SetActive(false);mineRuns.RemoveAt(i);}continue;}
    // Gone from the view without a burst (room change, boss defeat): nothing stays.
    if(time-m.lastSeen>.3f&&float.IsNaN(m.burstAt)){KillArmed(m);if(m.arc)m.arc.gameObject.SetActive(false);mineRuns.RemoveAt(i);continue;}
    if(m.landAt<=0)continue;
    float chargeAt=m.fuseAt-DischargeScore.BurstTime;
    if(time>=chargeAt){
     if(!m.arc){KillArmed(m);m.arc=arcPool.Take();if(m.arc){m.arc.PlayAt(m.to);if(time-chargeAt>.05f)m.arc.Seek(time-chargeAt);}}
     // The charge runs on its own clock (synced sound); it is kept on the kernel clock (re-seek past 0.08 s of drift) and holds just
     // before its burst until the burst tick arrives, so the burst is never early or late against the fuse.
     else{float hold=DischargeScore.BurstTime-.02f,want=Mathf.Min(time-chargeAt,hold);if(m.arc.TimeSeconds>=hold)m.arc.Pause();else if(Mathf.Abs(m.arc.TimeSeconds-want)>.08f)m.arc.Seek(want);}
     continue;
    }
    if(time<m.thrownAt)continue;
    if(!m.armed)m.armed=armedPool.Take();if(!m.armed)continue;
    float u=Mathf.Clamp01((time-m.thrownAt)/Mathf.Max(.01f,m.landAt-m.thrownAt));
    m.armed.transform.position=Vector3.Lerp(m.from,m.to,u)+Vector3.up*(4*ArmedArc*u*(1-u));
   }
  }
  void KillArmed(Mine m){if(m.armed){m.armed.gameObject.SetActive(false);m.armed=null;}}

  void UpdateCharge(Transform heroModel,Transform weapon,Vector3 baseLocal,Vector3 tipLocal){
   if(!Equipped||!weapon){DestroyCharge();BladeOut=false;return;}
   if(heroModel!=sheathHero){sheathHero=heroModel;sheathGrip=FindSheathGrip(heroModel);}
   // No scabbard rig (old hero): the blade is always out.
   BladeOut=!sheathGrip||!Sheathed(sheathGrip,weapon.TransformPoint(baseLocal),weapon.TransformPoint(tipLocal));
   if(weapon!=chargeWeapon){DestroyCharge();var prefab=Prefab("Electric_SwordCharge");if(!prefab)return;
    chargeWeapon=weapon;chargeBase=new GameObject("Electric charge · blade base").transform;chargeBase.SetParent(weapon,false);chargeBase.localPosition=baseLocal;
    chargeTip=new GameObject("Electric charge · blade tip").transform;chargeTip.SetParent(weapon,false);chargeTip.localPosition=tipLocal;
    var go=UnityEngine.Object.Instantiate(prefab,weapon,false);go.name="Electric_SwordCharge";go.SetActive(false);charge=go.GetComponent<LightningEffect>();
    if(!charge){Kill(go);return;}charge.bladeBase=chargeBase;charge.bladeTip=chargeTip;}
   if(!charge)return;
   chargeBase.localPosition=baseLocal;chargeTip.localPosition=tipLocal;
   if(charge.gameObject.activeSelf!=BladeOut)charge.gameObject.SetActive(BladeOut); // draw: SetActive(true) replays the 0.62 s charge-up
  }
  void DestroyCharge(){if(charge)Kill(charge.gameObject);if(chargeBase)Kill(chargeBase.gameObject);if(chargeTip)Kill(chargeTip.gameObject);charge=null;chargeBase=chargeTip=chargeWeapon=null;}
  void UpdateAura(Transform heroRoot){
   if(!Equipped||!heroRoot){if(aura)Kill(aura);aura=null;auraRoot=null;return;}
   if(aura&&auraRoot==heroRoot)return;if(aura)Kill(aura);
   var prefab=Prefab("Electric_GroundAura");if(!prefab)return;aura=UnityEngine.Object.Instantiate(prefab,heroRoot,false);aura.name="Electric_GroundAura";aura.transform.localPosition=Vector3.zero;auraRoot=heroRoot;
  }

  public void Reset(){
   foreach(var m in mineRuns){KillArmed(m);if(m.arc)m.arc.gameObject.SetActive(false);}mineRuns.Clear();
   foreach(var b in ballRuns)if(b.fx)b.fx.gameObject.SetActive(false);ballRuns.Clear();
   foreach(var s in stormRuns)if(s.fx)s.fx.gameObject.SetActive(false);stormRuns.Clear();
   slashes.Clear();hits.Clear();attackSlashes.Clear();lastDamage=lastLaunch=lastThrow=lastBurst=castAttack=0;previous=-1;
  }
  public void Dispose(){Reset();DestroyCharge();if(aura)Kill(aura);aura=null;slashes.Dispose();hits.Dispose();storms.Dispose();armedPool.Dispose();ballPool.Dispose();arcPool.Dispose();}
 }
}
