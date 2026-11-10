using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace IslandGame.BossTrials {
 // Deliberately has no Unity, networking, account, persistence or reward dependencies.
 // The trial is a reproducible local combat laboratory, not an authoritative RPG session.
 [Serializable] public sealed class TrialCatalog {
  public int Schema;
  public string Authority, Adaptation;
  public List<TrialDefinition> Bosses = new List<TrialDefinition>();
  public static TrialCatalog Parse(string json) {
   var result=JsonConvert.DeserializeObject<TrialCatalog>(json);
   if(result==null||result.Bosses==null||result.Bosses.Count!=10)throw new FormatException("Boss trial catalog must contain exactly ten bosses.");
   var ids=new HashSet<string>();
   foreach(var d in result.Bosses) {
    if(!ids.Add(d.Id)||d.MaxHp<=0||d.ActorCount<1||d.ActorCount>5||d.Patterns.Count==0)throw new FormatException("Invalid boss definition: "+d.Id);
    var attacks=new HashSet<string>();
    foreach(var p in d.Patterns)if(!attacks.Add(p.Id)||p.Cooldown<=0||p.Telegraph<.35f||p.Active<=0||p.Recovery<.15f||p.Damage<0)throw new FormatException("Invalid attack: "+d.Id+"/"+p.Id);
   }
   return result;
  }
 }
 [Serializable] public sealed class TrialDefinition {
  public string Id, Name, EnglishName, Theme, Element, Substitute, Description;
  public int MonsterId, MaxHp, ActorCount=1, Difficulty;
  public float Speed=2, PreferredRange=7, Height=3;
  public float[] PhaseThresholds=new float[0];
  public List<TrialPattern> Patterns=new List<TrialPattern>();
 }
 [Serializable] public sealed class TrialPattern {
  public string Id, Name, Kind, Op, Hint, Band="body";
  public int MinPhase=1, MaxPhase=4, Count=1;
  public float Cooldown=3, Telegraph=.8f, Active=.3f, Recovery=.7f, MinRange, MaxRange=24, Width=2, Damage=20, Speed=10;
  public float SourceMinRange, SourceMaxRange;
 }
 public enum TrialResult { Playing, Victory, Defeat }
 public enum TrialStage { Telegraph, Active, Recovery }
 public enum TrialShape { Segment, Column, Ring, Projectile }
 public enum TrialAction { Idle, Move, Attack, Jump, Slide, Dodge, Skill, Hurt }
 public struct TrialInput {
  public float Move;
  public bool Attack, Jump, Slide, Skill;
  public int Dodge;
 }
 public sealed class TrialHero {
  public float Z, Air, VelocityY, Facing=1, Hp=360, MaxHp=360, Stamina=100;
  public float DodgeRemaining, DodgeCooldown, SlideRemaining, SlideCooldown, AttackRemaining, AttackCooldown, SkillCooldown, SkillRemaining, HurtRemaining, DisarmedRemaining;
  public float DodgeStartZ, DodgeEndZ;
  public int AttackSerial, Combo;
  public TrialAction Action, RecentAction;
  public float Height { get { return SlideRemaining>0? .72f:2.6f; } }
  public float Radius { get { return .38f; } }
  public bool Invulnerable { get { return DodgeRemaining>.10f; } }
 }
 public sealed class TrialActor {
  public int Id, MonsterId;
  public float Z, Hp, MaxHp, Height, Facing=-1, NextDecision, StunUntil, InvulnerableUntil, VulnerableUntil, HatchAt, Shield;
  public bool Primary, Clone, Egg;
  public string Name, LastPattern="", Motion="idle";
  public TrialCast Cast;
  public readonly Dictionary<string,float> ReadyAt=new Dictionary<string,float>();
  public readonly HashSet<int> HitSwings=new HashSet<int>();
  public bool Alive { get { return Hp>0; } }
  public float BodyRadius { get { return Egg? .36f:Math.Max(.42f,Height*.22f); } }
 }
 public sealed class TrialCast {
  public TrialPattern Pattern;
  public float Started, OriginZ, TargetZ, Direction, EndZ;
  public TrialStage Stage;
  public int Serial;
  public bool Executed;
 }
 // These volumes are both collision data and the sole source of rendered attack geometry.
 // Lane coordinates are recovered Unity world Z, vertical coordinates are above native Y=10.
 public sealed class TrialHazard {
  public int Id, OwnerId;
  public string Label, Hint, Band, Effect;
  public TrialShape Shape;
  public float Z0, Z1, Y0, Y1, OriginZ, Radius, PreviousRadius, Speed, PreviousZ;
  public float TelegraphAt, ActiveAt, EndsAt, Damage, NextHitAt;
  public bool Friendly, Consumed, Repeating;
  public readonly HashSet<int> HitActors=new HashSet<int>();
  public bool Telegraph(float now) { return now<ActiveAt; }
  public bool Active(float now) { return !Consumed&&now>=ActiveAt&&now<EndsAt; }
  public float MinZ { get { return Math.Min(Z0,Z1); } }
  public float MaxZ { get { return Math.Max(Z0,Z1); } }
 }
 public sealed class TrialText {
  public float Z, Y, Until;
  public string Text;
  public bool Damage;
 }
 public static class TrialGeometry {
  public static float Clamp(float n,float a,float b) { return Math.Max(a,Math.Min(b,n)); }
  public static bool Interval(float a0,float a1,float b0,float b1) { return Math.Max(Math.Min(a0,a1),Math.Min(b0,b1))<=Math.Min(Math.Max(a0,a1),Math.Max(b0,b1)); }
  public static bool HeroIntersects(TrialHazard h,TrialHero hero) {
   if(!Interval(hero.Air,hero.Air+hero.Height,h.Y0,h.Y1))return false;
   if(h.Shape==TrialShape.Ring) {
    float inner=Math.Max(0,Math.Min(h.PreviousRadius,h.Radius)-.32f),outer=Math.Max(h.PreviousRadius,h.Radius)+.32f;
    return Interval(hero.Z-hero.Radius,hero.Z+hero.Radius,h.OriginZ-outer,h.OriginZ-inner)||Interval(hero.Z-hero.Radius,hero.Z+hero.Radius,h.OriginZ+inner,h.OriginZ+outer);
   }
   float min=h.MinZ,max=h.MaxZ;
   if(h.Shape==TrialShape.Projectile){min=Math.Min(min,h.PreviousZ-h.Radius);max=Math.Max(max,h.PreviousZ+h.Radius);}
   return Interval(hero.Z-hero.Radius,hero.Z+hero.Radius,min,max);
  }
 }
 public sealed class BossTrialSimulation {
  public const int AddCap=6;
  public const float FixedStep=1f/60f;
  public readonly TrialDefinition Definition;
  public readonly TrialHero Hero=new TrialHero();
  public readonly List<TrialActor> Actors=new List<TrialActor>();
  public readonly List<TrialHazard> Hazards=new List<TrialHazard>();
  public readonly List<TrialText> Texts=new List<TrialText>();
  public readonly float MinZ,MaxZ;
  public readonly string Weapon;
  public TrialResult Result { get; private set; }
  public int Phase { get; private set; }
  public float Time { get; private set; }
  public float OverloadAt { get; private set; }
  public float DarknessUntil { get; private set; }
  public int PerfectDodges { get; private set; }
  public int Kills { get; private set; }
  public bool TailDisabled { get; private set; }
  public bool WingGrounded { get; private set; }
  public string LastNotice { get; private set; }
  public bool Paused;
  uint random;
  int nextActor=1,nextHazard=1,nextCast=1,deadAdds,jointHits,tailHits,wingHits;
  float worldDecisionAt,attackWindup,moveInput,accumulator;
  bool jumpQueued,slideQueued,attackQueued,skillQueued;
  int dodgeQueued;
  bool overloadFired;
  public BossTrialSimulation(TrialDefinition definition,string weapon="axe",uint seed=8731,float minZ=-61,float maxZ=-37,float playerZ=-56,float bossZ=-42) {
   if(definition==null)throw new ArgumentNullException("definition");
   if(maxZ-minZ<16)throw new ArgumentException("A trial needs at least sixteen native metres.");
   Definition=definition;MinZ=minZ;MaxZ=maxZ;Weapon=weapon;random=seed==0?1:seed;Phase=1;Result=TrialResult.Playing;
   Hero.Z=TrialGeometry.Clamp(playerZ,MinZ+.5f,MaxZ-.5f);
   for(int i=0;i<definition.ActorCount;i++) {
    float z=definition.ActorCount==1?bossZ:MinZ+8+i*(maxZ-minZ-9)/Math.Max(1,definition.ActorCount-1);
    var actor=Spawn(definition.MonsterId,z,definition.MaxHp/(float)definition.ActorCount,true,false,false);
    actor.Height=definition.ActorCount>1?1.8f:definition.Height;actor.NextDecision=.9f+i*.4f;
   }
   LastNotice="로컬 시험 · 보상과 계정 변경 없음";
  }
  public int LivingPrimaries { get { int n=0;foreach(var a in Actors)if(a.Primary&&a.Alive)n++;return n; } }
  public int LivingAdds { get { int n=0;foreach(var a in Actors)if(!a.Primary&&a.Alive)n++;return n; } }
  public float BossHp { get { float n=0;foreach(var a in Actors)if(a.Primary)n+=Math.Max(0,a.Hp);return n; } }
  public float BossMaxHp { get { return Definition.MaxHp; } }
  public void Advance(float delta,TrialInput input) {
   if(Paused||Result!=TrialResult.Playing)return;
   moveInput=TrialGeometry.Clamp(input.Move,-1,1);jumpQueued|=input.Jump;slideQueued|=input.Slide;attackQueued|=input.Attack;skillQueued|=input.Skill;
   if(input.Dodge!=0)dodgeQueued=input.Dodge<0?-1:1;
   // Limit catch-up to avoid giant collision jumps after an application stall.
   accumulator+=TrialGeometry.Clamp(delta,0,.25f);
   while(accumulator>=FixedStep&&Result==TrialResult.Playing){Step(FixedStep);accumulator-=FixedStep;}
  }
  public void Abandon() { Hazards.Clear();Texts.Clear();Actors.Clear();Paused=true; }
  void Step(float dt) {
   Time+=dt;UpdateHero(dt);UpdatePhase();
   // Snapshot count: a summoned actor starts making decisions next tick.
   int count=Actors.Count;
   for(int i=0;i<count;i++)if(Actors[i].Alive)UpdateActor(Actors[i],dt);
   UpdateHazards(dt);UpdateAttack();
   Texts.RemoveAll(t=>t.Until<Time);
   Actors.RemoveAll(a=>!a.Primary&&!a.Alive&&a.HatchAt+1<Time);
   if(Hero.Hp<=0)Finish(TrialResult.Defeat,"쓰러졌습니다 · 다시 도전 가능");
   else if(LivingPrimaries==0)Finish(TrialResult.Victory,Definition.Id=="B08"?"드론 5기 전부 격파":"보스 시험 완료");
   if(Result!=TrialResult.Playing)return;
   if(OverloadAt>0&&Time>=OverloadAt&&!overloadFired) {
    overloadFired=true;OverloadAt=0;
    // Adapt the PDF's lethal full-screen timeout into a warned half-arena blast.
    AddHalfBlast(Primary(),3.2f,55,"과부하 · 안전 구역으로");
    LastNotice="과부하: 표식 반대편이 안전합니다";
   }
  }
  void Finish(TrialResult result,string notice) { Result=result;LastNotice=notice;Hazards.Clear();foreach(var a in Actors){a.Cast=null;if(!a.Primary)a.Hp=0;} }
  void UpdateHero(float dt) {
   var h=Hero;
   h.DodgeCooldown=Down(h.DodgeCooldown,dt);h.SlideCooldown=Down(h.SlideCooldown,dt);h.AttackCooldown=Down(h.AttackCooldown,dt);h.SkillCooldown=Down(h.SkillCooldown,dt);
   h.SkillRemaining=Down(h.SkillRemaining,dt);
   h.HurtRemaining=Down(h.HurtRemaining,dt);h.DisarmedRemaining=Down(h.DisarmedRemaining,dt);h.Stamina=Math.Min(100,h.Stamina+22*dt);
   if(dodgeQueued!=0&&h.DodgeCooldown<=0&&h.DodgeRemaining<=0&&h.Stamina>=30) {
    h.Facing=dodgeQueued;h.DodgeRemaining=.38f;h.DodgeCooldown=1.05f;h.Stamina-=30;h.SlideRemaining=0;h.AttackRemaining=0;
    h.DodgeStartZ=h.Z;float landing;
    h.DodgeEndZ=TryDodgeDestination(h.Z,dodgeQueued,out landing)?landing:h.Z;
    if(h.DodgeEndZ==h.Z)Say(h.Z,3,"제자리 회피 · 진로 막힘",false);
    h.RecentAction=TrialAction.Dodge;
    foreach(var hazard in Hazards)if(!hazard.Friendly&&hazard.ActiveAt>Time&&hazard.ActiveAt-Time<=.20f&&TrialGeometry.HeroIntersects(hazard,h)) {
     PerfectDodges++;h.Stamina=Math.Min(100,h.Stamina+12);Say(h.Z,3,"완벽 회피",false);break;
    }
   }
   dodgeQueued=0;
   if(jumpQueued&&h.Air<=.001f&&h.SlideRemaining<=0&&h.DodgeRemaining<=0){h.VelocityY=8.6f;h.RecentAction=TrialAction.Jump;}
   jumpQueued=false;
   // A complete low stance outlasts the longest 1.3s upper beam plus a reaction margin.
   if(slideQueued&&h.Air<=.001f&&h.SlideCooldown<=0&&h.DodgeRemaining<=0&&h.Stamina>=15){h.SlideRemaining=1.65f;h.SlideCooldown=2.1f;h.Stamina-=15;h.RecentAction=TrialAction.Slide;h.AttackRemaining=0;}
   slideQueued=false;
   if(attackQueued&&h.AttackCooldown<=0&&h.DodgeRemaining<=0&&h.SlideRemaining<=0&&h.DisarmedRemaining<=0) {
    h.AttackRemaining=.43f;h.AttackCooldown=.48f;h.AttackSerial++;h.Combo=(h.Combo+1)%3;attackWindup=.15f;h.RecentAction=TrialAction.Attack;
   }
   attackQueued=false;
   if(skillQueued&&h.SkillCooldown<=0&&h.DisarmedRemaining<=0&&h.DodgeRemaining<=0&&h.SlideRemaining<=0) {
    h.SkillCooldown=4.5f;h.SkillRemaining=.45f;h.RecentAction=TrialAction.Skill;
    var shot=AddHazard(null,"서리 파동","냉기 시험 기술",TrialShape.Projectile,h.Z,h.Z,.1f,2.4f,0,1.8f,95);
    shot.Friendly=true;shot.OriginZ=h.Z;shot.Speed=h.Facing*13;shot.Radius=.45f;shot.Effect="frost";
   }
   skillQueued=false;
   float speed=4.8f,move=moveInput;
   if(h.DodgeRemaining>0){speed=10;move=h.Facing;h.DodgeRemaining=Down(h.DodgeRemaining,dt);h.Action=TrialAction.Dodge;}
   else if(h.SlideRemaining>0){speed=3.2f;move=h.Facing;h.SlideRemaining=Down(h.SlideRemaining,dt);h.Action=TrialAction.Slide;}
   else {
    if(Math.Abs(move)>.05f){h.Facing=Math.Sign(move);h.RecentAction=TrialAction.Move;}
    if(h.AttackRemaining>0)speed*=.45f;
    h.Action=h.AttackRemaining>0?TrialAction.Attack:h.SkillRemaining>0?TrialAction.Skill:Math.Abs(move)>.05f?TrialAction.Move:TrialAction.Idle;
   }
   float intended=TrialGeometry.Clamp(h.Z+move*speed*dt,MinZ+.45f,MaxZ-.45f);
   if(h.Action==TrialAction.Dodge) {
    h.Z=Approach(h.Z,h.DodgeEndZ,10*dt);
    if(h.DodgeRemaining<=0)h.Z=SafeLanding(h.DodgeStartZ,h.Z);
   } else h.Z=WalkWithoutPassing(h.Z,intended,h.Air);
   if(h.VelocityY>0||h.Air>0){h.VelocityY-=18*dt;h.Air=Math.Max(0,h.Air+h.VelocityY*dt);if(h.Air==0)h.VelocityY=0;if(h.DodgeRemaining<=0)h.Action=TrialAction.Jump;}
   if(h.HurtRemaining>0&&h.DodgeRemaining<=0)h.Action=TrialAction.Hurt;
   h.AttackRemaining=Down(h.AttackRemaining,dt);
  }
  // Movement is swept against body intervals. Already-overlapping bodies allow escape
  // away from their centre; a frame step can never tunnel through a grounded opponent.
  float WalkWithoutPassing(float from,float to,float air) {
   foreach(var a in Actors) {
    if(!a.Alive||air>a.Height+.1f)continue;
    float left=a.Z-a.BodyRadius-Hero.Radius,right=a.Z+a.BodyRadius+Hero.Radius;
    if(to>from) {
     if(from<=left&&to>left)to=left;
     else if(from>left&&from<a.Z)to=from;
    } else if(to<from) {
     if(from>=right&&to<right)to=right;
     else if(from<right&&from>a.Z)to=from;
    }
   }
   return TrialGeometry.Clamp(to,MinZ+.45f,MaxZ-.45f);
  }
  public bool TryDodgeDestination(float from,int direction,out float landing) {
   landing=TrialGeometry.Clamp(from+(direction<0?-1:1)*3.8f,MinZ+.45f,MaxZ-.45f);
   int crossed=0;
   foreach(var a in Actors) {
    if(!a.Alive)continue;
    float left=a.Z-a.BodyRadius-Hero.Radius,right=a.Z+a.BodyRadius+Hero.Radius;
    if(landing>left+.002f&&landing<right-.002f)return false;
    if(TrialGeometry.Interval(from,landing,left,right)) {
     // Three small actors maximum; large bosses require an in-place evade.
     if(a.Height>=3||++crossed>3)return false;
    }
   }
   return true;
  }
  float SafeLanding(float from,float desired) {
   for(int step=0;step<=40;step++) {
    float candidate=desired+(from-desired)*(step/40f);bool clear=true;
    foreach(var a in Actors)if(a.Alive&&Math.Abs(candidate-a.Z)<a.BodyRadius+Hero.Radius-.002f){clear=false;break;}
    if(clear)return candidate;
   }
   return from;
  }
  void UpdateAttack() {
   if(Hero.AttackRemaining<=0)return;
   float age=.43f-Hero.AttackRemaining;
   if(age>=attackWindup&&age<=attackWindup+.14f) {
    float range=Weapon=="spear"?3.1f:Weapon=="dual"?2.05f:Weapon=="sword"?2.5f:2.3f;
    float end=Hero.Z+Hero.Facing*range;
    foreach(var a in Actors) {
     if(!a.Alive||a.HitSwings.Contains(Hero.AttackSerial)||!TrialGeometry.Interval(Hero.Z-.2f, end,a.Z-.65f,a.Z+.65f)||Hero.Air>a.Height+.2f)continue;
     a.HitSwings.Add(Hero.AttackSerial);DamageActor(a,Hero.Combo==0?84:62,"physical");
    }
   }
  }
  void UpdatePhase() {
   int next=1;
   if(Definition.Id=="B08")next=LivingPrimaries<=2?2:1;
   else {float ratio=BossHp/BossMaxHp;foreach(float threshold in Definition.PhaseThresholds)if(ratio<=threshold)next++;}
   if(next<=Phase)return;
   Phase=next;LastNotice="페이즈 "+Phase;Say(Primary()?.Z??Hero.Z,4,LastNotice,false);
   if(Definition.Id=="B10") {
    // Clear old attacks before each exactly-three-second invulnerable form transition.
    Hazards.RemoveAll(h=>!h.Friendly);
    foreach(var a in Actors)if(a.Primary&&a.Alive){a.Cast=null;a.InvulnerableUntil=Time+3;a.VulnerableUntil=Time+5;a.NextDecision=Time+3.2f;a.Motion="shift";}
   }
   if(Definition.Id=="B06"&&Phase==2)foreach(var a in Actors)if(a.Primary&&a.Alive)a.Shield=180;
   if((Definition.Id=="B06"&&Phase>=3)||(Definition.Id=="B10"&&Phase>=4)){OverloadAt=Time+60;overloadFired=false;}
  }
  void UpdateActor(TrialActor a,float dt) {
   if(a.Cast==null)a.Facing=Hero.Z>=a.Z?1:-1;
   if(a.Egg) {
    a.Motion="idle";
    if(Time>=a.HatchAt){a.Egg=false;a.MonsterId=1201;a.Hp=a.MaxHp=100;a.Height=1.5f;a.NextDecision=Time+.8f;Say(a.Z,2,"부화",false);}return;
   }
   if(Time<a.StunUntil||Time<a.InvulnerableUntil){a.Motion=Time<a.InvulnerableUntil?"shift":"hurt";return;}
   if(a.Cast!=null) {
    var c=a.Cast;float age=Time-c.Started;
    if(age<c.Pattern.Telegraph){c.Stage=TrialStage.Telegraph;a.Motion="windup";return;}
    if(!c.Executed){c.Executed=true;Execute(a,c);}
    if(age<c.Pattern.Telegraph+c.Pattern.Active) {
     c.Stage=TrialStage.Active;a.Motion="attack";
     if(c.Pattern.Op=="dash"||c.Pattern.Op=="charge")a.Z=c.OriginZ+(c.EndZ-c.OriginZ)*TrialGeometry.Clamp((age-c.Pattern.Telegraph)/c.Pattern.Active,0,1);
     return;
    }
    if(c.Pattern.Op=="dash"||c.Pattern.Op=="charge") {
     a.Z=c.EndZ;
     if(c.Pattern.Op=="charge"&&(c.EndZ<=MinZ+1||c.EndZ>=MaxZ-1)){a.StunUntil=Time+2;a.Cast=null;CancelHazards(a.Id);Say(c.EndZ,3,"벽 충돌 · 무력화",false);return;}
    }
    c.Stage=TrialStage.Recovery;a.Motion="recover";
    if(age>=c.Pattern.Telegraph+c.Pattern.Active+c.Pattern.Recovery){a.Cast=null;a.NextDecision=Time+.2f;}
    return;
   }
   if(!a.Primary){UpdateAdd(a,dt);return;}
   float distance=Math.Abs(a.Z-Hero.Z),desired=Definition.PreferredRange;
   if(Definition.Id=="B01"&&Phase>=2)desired=3.5f;
   if(Definition.Id=="B10"&&Phase==3)desired=6;
   if(Definition.Id=="B08")desired=5+((a.Id%3)*1.8f);
   float direction=distance>desired+1?a.Facing:distance<desired-1?-a.Facing:0;
   a.Motion=direction==0?"idle":"move";
   float movement=Definition.Speed*(Definition.Id=="B04"?1+(Phase-1)*.12f:1);
   a.Z=TrialGeometry.Clamp(a.Z+direction*movement*dt,MinZ+1,MaxZ-1);
   if(Time<a.NextDecision||Time<worldDecisionAt)return;
   TrialPattern chosen=Choose(a);
   if(chosen==null){a.NextDecision=Time+.15f;return;}
   BeginCast(a,chosen);
  }
  void UpdateAdd(TrialActor a,float dt) {
   float distance=Math.Abs(a.Z-Hero.Z);
   a.Motion=distance>1.7f?"move":"idle";
   if(distance>1.7f)a.Z=TrialGeometry.Clamp(a.Z+a.Facing*2.4f*dt,MinZ+.6f,MaxZ-.6f);
   if(Time<a.NextDecision||Time<worldDecisionAt)return;
   var p=new TrialPattern{Id=a.Clone?"clone-bolt":"add-claw",Name=a.Clone?"분신 탄":"소환수 발톱",Kind=a.Clone?"Projectile":"Melee",Op=a.Clone?"projectile":"melee",Band=a.Clone?"high":"low",Cooldown=3.5f,Telegraph=.85f,Active=.25f,Recovery=.7f,Damage=a.Clone?12:10,Width=2.2f,Speed=8,MaxRange=a.Clone?24:2.4f};
   float ready;a.ReadyAt.TryGetValue(p.Id,out ready);if(Time<ready)return;
   if(distance>p.MaxRange){a.NextDecision=Time+.2f;return;}
   BeginCast(a,p);
  }
  TrialPattern Choose(TrialActor a) {
   var ready=new List<TrialPattern>();float distance=Math.Abs(a.Z-Hero.Z);
   foreach(var p in Definition.Patterns) {
    float next;a.ReadyAt.TryGetValue(p.Id,out next);
    if(Phase<p.MinPhase||Phase>p.MaxPhase||Time<next||distance<p.MinRange||distance>p.MaxRange)continue;
    if(p.Op=="form")continue; // Phase transition owns form shift; it cannot repeat as an ordinary attack.
    if(Definition.Id=="B01"&&p.Id=="tail-sweep"&&TailDisabled)continue;
    if(p.Op=="overload"&&OverloadAt>0)continue;
    if((p.Op=="summon"||p.Op=="eggs"||p.Op=="clone"||p.Op=="corrupt")&&LivingAdds>=AddCap)continue;
    ready.Add(p);
   }
   if(ready.Count==0)return null;
   // All ready moves have independent clocks. VIRUS never repeats its last move.
   if(Definition.Id=="B09"&&ready.Count>1)ready.RemoveAll(p=>p.Id==a.LastPattern);
   if(Definition.Id=="B09"&&ready.Count==1&&ready[0].Id==a.LastPattern)return null;
   return ready[(int)(Random01()*ready.Count)%ready.Count];
  }
  void BeginCast(TrialActor a,TrialPattern p) {
   var c=new TrialCast{Pattern=p,Started=Time,OriginZ=a.Z,TargetZ=Hero.Z,Direction=a.Facing,Stage=TrialStage.Telegraph,Serial=nextCast++};
   c.EndZ=TrialGeometry.Clamp(a.Z+c.Direction*Math.Min(10,Math.Abs(Hero.Z-a.Z)+2),MinZ+.8f,MaxZ-.8f);
   a.Cast=c;a.LastPattern=p.Id;a.ReadyAt[p.Id]=Time+p.Telegraph+p.Active+p.Recovery+p.Cooldown;
   // Shared spacing prevents five B08 actors/summons from overlaying unreadable warning sequences.
   worldDecisionAt=Time+Math.Max(.65f,Math.Min(1.4f,p.Telegraph+.25f));
   LastNotice=p.Name+" · "+p.Hint;
   Telegraph(a,c);
  }
  void Telegraph(TrialActor a,TrialCast c) {
   var p=c.Pattern;float y0,y1;Band(p.Band,out y0,out y1);
   if(p.Op=="sync"||p.Op=="converge") {
    foreach(var drone in Actors)if(drone.Primary&&drone.Alive) {
     float direction=Hero.Z>=drone.Z?1:-1;
     var h=AddHazard(drone,p.Name,p.Hint,p.Op=="sync"?TrialShape.Projectile:TrialShape.Segment,drone.Z,direction>0?MaxZ:MinZ,y0,y1,p.Telegraph,p.Op=="sync"?3:p.Active,p.Damage);
     h.Band=p.Band;h.OriginZ=drone.Z;h.Speed=direction*p.Speed;h.Radius=.25f;h.Effect=p.Op;
    }
   } else if(p.Op=="projectile"||p.Op=="salvo") {
    // Each projectile has its own visible path warning and cannot retarget after firing.
    int count=Math.Max(1,p.Count);
    for(int i=0;i<count;i++) {
     float delay=p.Telegraph+i*.28f;
     float end=c.Direction>0?MaxZ:MinZ;
     var h=AddHazard(a,p.Name,p.Hint,TrialShape.Projectile,c.OriginZ,end,y0,y1,delay,(MaxZ-MinZ)/Math.Max(4,p.Speed)+.3f,p.Damage);
     h.Band=p.Band;h.OriginZ=c.OriginZ;h.Speed=c.Direction*p.Speed;h.Radius=.25f;h.Effect=p.Op=="sync"?"sync":"bolt";
    }
   } else if(p.Op=="melee"||p.Op=="backstab"||p.Op=="beam"||p.Op=="breath"||p.Op=="emp"||p.Op=="drain") {
    float reach=p.Op=="melee"||p.Op=="backstab"||p.Op=="emp"?p.Width:Math.Min(p.MaxRange,12);
    float start=p.Op=="emp"?a.Z-reach:c.OriginZ,end=p.Op=="emp"?a.Z+reach:c.OriginZ+c.Direction*reach;
    var h=AddHazard(a,p.Name,p.Hint,TrialShape.Segment,start,end,y0,y1,p.Telegraph,p.Active,p.Damage);
    h.Band=p.Band;h.Effect=p.Op;h.Repeating=p.Op=="breath"||p.Op=="drain";
   } else if(p.Op=="dash"||p.Op=="charge") {
    var h=AddHazard(a,p.Name,p.Hint,TrialShape.Segment,c.OriginZ,c.EndZ,0,.85f,p.Telegraph,p.Active,p.Damage);h.Band="low";h.Effect=p.Op;h.OriginZ=c.OriginZ;h.PreviousZ=c.OriginZ;
   } else if(p.Op=="blink"||p.Op=="teleport") {
    c.EndZ=p.Op=="teleport"?MinZ+2+Random01()*(MaxZ-MinZ-4):TrialGeometry.Clamp(c.TargetZ-c.Direction*2.2f,MinZ+1,MaxZ-1);
    var h=AddHazard(a,p.Name,p.Hint,TrialShape.Column,c.EndZ-1.3f,c.EndZ+1.3f,0,3.7f,p.Telegraph,p.Active,p.Damage);h.Effect="blink";
   } else if(p.Op=="ring") {
    var h=AddHazard(a,p.Name,p.Hint,TrialShape.Ring,a.Z,a.Z,0,.7f,p.Telegraph,p.Active,p.Damage);h.OriginZ=a.Z;h.Speed=7;h.Radius=0;h.Band="low";
   } else if(p.Op=="pool"||p.Op=="cloud"||p.Op=="meteor"||p.Op=="missiles") {
    int count=Math.Max(1,p.Count);float width=p.Width;
    // Markers lock their target at telegraph. Tracking clouds stop following before damage.
    for(int i=0;i<count;i++) {
     float z=i==0?c.TargetZ:TrialGeometry.Clamp(c.TargetZ+(i%2==0?-1:1)*(1+(i/2))*3.0f,MinZ+width,MaxZ-width);
     var h=AddHazard(a,p.Name,p.Hint,TrialShape.Column,z-width,z+width,0,4,p.Telegraph+i*.3f,p.Active,p.Damage);
     h.Effect=p.Op;h.Repeating=p.Op=="pool"||p.Op=="cloud";
    }
   } else if(p.Op=="half")AddHalfBlast(a,p.Telegraph,p.Damage,p.Name);
   else if(p.Op=="mimic") {
    bool low=Hero.RecentAction==TrialAction.Jump||Hero.RecentAction==TrialAction.Move;
    var h=AddHazard(a,p.Name,low?"점프로 낮은 파동 넘기":"슬라이드로 상단 피하기",TrialShape.Segment,MinZ+1,MaxZ-1,low?0:1.05f,low? .75f:3.3f,p.Telegraph,p.Active,p.Damage);h.Band=low?"low":"high";
   } else {
    // Non-damaging summon/veil warnings show the source location, never hidden hit areas.
    var h=AddHazard(a,p.Name,p.Hint,TrialShape.Column,a.Z-.8f,a.Z+.8f,0,.12f,p.Telegraph,.15f,0);h.Effect="utility";
   }
  }
  void Execute(TrialActor a,TrialCast c) {
   var p=c.Pattern;
   if(Definition.Id=="B06"&&p.Op=="projectile")a.VulnerableUntil=Time+1.1f;
   if(p.Op=="blink"||p.Op=="teleport")a.Z=c.EndZ;
   if(p.Op=="summon"||p.Op=="corrupt") {
    int count=Math.Min(p.Count,AddCap-LivingAdds);
    for(int i=0;i<count;i++)Spawn(p.Op=="corrupt"?(i%2==0?1253:1104):1152,SpawnPosition(a,i),p.Op=="corrupt"?130:110,false,false,false);
   }
   if(p.Op=="eggs") {
    int count=Math.Min(p.Count,AddCap-LivingAdds);
    for(int i=0;i<count;i++){var egg=Spawn(1003,SpawnPosition(a,i),60,false,false,true);egg.HatchAt=Time+4;egg.Height=.9f;}
   }
   if(p.Op=="clone") {
    int existing=0;foreach(var actor in Actors)if(actor.Alive&&actor.Clone)existing++;
    int count=Math.Min(p.Count-existing,AddCap-LivingAdds);
    for(int i=0;i<count;i++){var clone=Spawn(a.MonsterId,SpawnPosition(a,i),Definition.Id=="B04"?1:a.MaxHp*.5f,false,true,false);clone.Height=a.Height;}
   }
   if(p.Op=="revive") {
    int count=Math.Min(Math.Min(deadAdds,3),AddCap-LivingAdds);
    if(count==0){a.StunUntil=Time+2;Say(a.Z,3,"부활 대상 없음 · 취약",false);}
    for(int i=0;i<count;i++)Spawn(1152,SpawnPosition(a,i),65,false,false,false);
    deadAdds=Math.Max(0,deadAdds-count);
   }
   if(p.Op=="veil"){DarknessUntil=Time+4;LastNotice="암전 · 공격 표식은 계속 보입니다";}
   if(p.Op=="overload"&&OverloadAt<=0&&!overloadFired)OverloadAt=Time+60;
   if(p.Op=="reposition")a.Z=TrialGeometry.Clamp(MinZ+2+Random01()*(MaxZ-MinZ-4),MinZ+1,MaxZ-1);
  }
  float SpawnPosition(TrialActor actor,int index) {
   // Summons appear away from Hong with a first-action delay; no spawn contact damage.
   float candidate=actor.Z+(index%2==0?-1:1)*(2+(index/2)*2);
   if(Math.Abs(candidate-Hero.Z)<2)candidate=Hero.Z+(candidate>=Hero.Z?3:-3);
   return TrialGeometry.Clamp(candidate,MinZ+1,MaxZ-1);
  }
  TrialActor Spawn(int monster,float z,float hp,bool primary,bool clone,bool egg) {
   var a=new TrialActor{Id=nextActor++,MonsterId=monster,Z=z,Hp=hp,MaxHp=hp,Primary=primary,Clone=clone,Egg=egg,Height=primary?Definition.Height:1.8f,NextDecision=Time+1.4f,Name=primary?Definition.Name:egg?"부화 전 알":clone?"분신":"소환수"};
   Actors.Add(a);return a;
  }
  TrialHazard AddHazard(TrialActor owner,string label,string hint,TrialShape shape,float z0,float z1,float y0,float y1,float warning,float duration,float damage) {
   var h=new TrialHazard{Id=nextHazard++,OwnerId=owner==null?0:owner.Id,Label=label,Hint=hint,Shape=shape,Z0=TrialGeometry.Clamp(z0,MinZ,MaxZ),Z1=TrialGeometry.Clamp(z1,MinZ,MaxZ),Y0=y0,Y1=y1,TelegraphAt=Time,ActiveAt=Time+warning,EndsAt=Time+warning+duration,Damage=damage,NextHitAt=Time+warning,PreviousZ=z0};
   Hazards.Add(h);return h;
  }
  void AddHalfBlast(TrialActor a,float warning,float damage,string label) {
   float middle=(MinZ+MaxZ)*.5f;
   bool left=Hero.Z<middle;
   // Keep a walkable route to the safe half: the large boss cannot body-block
   // the midpoint. It visibly relocates to the far safe edge before charging.
   // This ultimate owns its warning window; old beams/summons cannot seal the exit.
   Hazards.RemoveAll(h=>!h.Friendly);
   if(a!=null){a.Z=left?MaxZ-1.5f:MinZ+1.5f;if(a.Cast?.Pattern.Op!="half")a.Cast=null;a.NextDecision=Time+warning+1;}
   worldDecisionAt=Time+warning+1;
   // Exactly half the arena is dangerous. No hazard is generated on the safe side.
   var h=AddHazard(a,label,left?"오른쪽 안전 구역":"왼쪽 안전 구역",TrialShape.Segment,left?MinZ:middle,left?middle:MaxZ,0,8,warning,.6f,damage);h.Effect="half";h.Band="full";
  }
  void UpdateHazards(float dt) {
   for(int i=0;i<Hazards.Count;i++) {
    var h=Hazards[i];if(h.Consumed||Time<h.ActiveAt||Time>=h.EndsAt)continue;
    if(h.OwnerId!=0) {var owner=FindActor(h.OwnerId);if(owner==null||!owner.Alive){h.Consumed=true;continue;}}
    if(h.Effect=="dash"||h.Effect=="charge") {
     var moving=FindActor(h.OwnerId);if(moving!=null){h.Z0=Math.Min(h.PreviousZ,moving.Z)-.7f;h.Z1=Math.Max(h.PreviousZ,moving.Z)+.7f;h.PreviousZ=moving.Z;}
    }
    if(h.Shape==TrialShape.Projectile) {
     // Replace the line warning by a moving small volume at activation, then sweep each step.
     if(h.Effect!="launched"){h.Z0=h.OriginZ-h.Radius;h.Z1=h.OriginZ+h.Radius;h.PreviousZ=h.OriginZ;h.Effect="launched";}
     else h.PreviousZ=(h.Z0+h.Z1)*.5f;
     h.Z0+=h.Speed*dt;h.Z1+=h.Speed*dt;
     if(h.MaxZ<MinZ-1||h.MinZ>MaxZ+1)h.Consumed=true;
    }
    if(h.Shape==TrialShape.Ring){h.PreviousRadius=h.Radius;h.Radius+=h.Speed*dt;}
    if(h.Friendly) {
     foreach(var a in Actors)if(a.Alive&&!h.HitActors.Contains(a.Id)&&TrialGeometry.Interval(a.Z-.6f,a.Z+.6f,Math.Min(h.PreviousZ-h.Radius,h.MinZ),Math.Max(h.PreviousZ+h.Radius,h.MaxZ))) {
      h.HitActors.Add(a.Id);DamageActor(a,h.Damage,"ice");a.StunUntil=Math.Max(a.StunUntil,Time+.45f);
     }
    } else if(h.Damage>0&&Time>=h.NextHitAt&&TrialGeometry.HeroIntersects(h,Hero)) {
     if(!Hero.Invulnerable&&Hero.HurtRemaining<=0) {
      Hero.Hp=Math.Max(0,Hero.Hp-h.Damage);Hero.HurtRemaining=.32f;Say(Hero.Z,Hero.Air+2.8f,"−"+(int)h.Damage,true);
      if(h.Effect=="emp")Hero.DisarmedRemaining=2;
      if(h.Effect=="drain"){var owner=FindActor(h.OwnerId);if(owner!=null)owner.Hp=Math.Min(owner.MaxHp,owner.Hp+h.Damage*.7f);}
     }
     h.NextHitAt=Time+(h.Repeating? .7f:999);
     if(h.Shape==TrialShape.Projectile)h.Consumed=true;
    }
   }
   Hazards.RemoveAll(h=>h.Consumed||Time>=h.EndsAt);
  }
  void DamageActor(TrialActor a,float damage,string element) {
   if(!a.Alive||Time<a.InvulnerableUntil){Say(a.Z,a.Height,"형태 전환",false);return;}
   if(a.Primary&&a.Shield>0) {
    a.Shield=Math.Max(0,a.Shield-damage);Say(a.Z,a.Height,"방어막 −"+(int)damage,false);
    if(a.Shield<=0){a.StunUntil=Time+8;a.Cast=null;CancelHazards(a.Id);Say(a.Z,a.Height+.5f,"방어막 파괴 · 8초",false);}return;
   }
   if(a.Primary&&Time>=a.StunUntil&&element!="ice"&&((Definition.Id=="B04"&&Random01()<(Phase>=2? .7f:.5f))||(Definition.Id=="B08"&&LivingPrimaries==1&&Random01()<.35f))){Say(a.Z,a.Height,"회피 · 냉기로 억제",false);return;}
   if(Time<a.VulnerableUntil)damage*=1.5f;
   if(element=="ice"&&(Definition.Id=="B01"||Definition.Id=="B03"||Definition.Id=="B04"))damage*=1.4f;
   if(element=="physical"&&a.Primary&&Definition.Id=="B04")damage*=.7f;
   a.Hp=Math.Max(0,a.Hp-damage);Say(a.Z,a.Height,"−"+(int)damage,true);
   if(a.Primary&&Definition.Id=="B01") {
    if(element=="physical"&&++tailHits>=8&&!TailDisabled){TailDisabled=true;Say(a.Z,a.Height+1,"꼬리 파괴 · 쓸기 봉쇄",false);}
    if(element=="ice"&&++wingHits>=3&&!WingGrounded){WingGrounded=true;Say(a.Z,a.Height+1,"날개 약화 · 착지",false);}
   }
   if(a.Primary&&Definition.Id=="B03"&&element=="physical"&&++jointHits%3==0){a.StunUntil=Time+2;a.Cast=null;CancelHazards(a.Id);Say(a.Z,a.Height+1,"관절 약점 · 무력화",false);}
   if(!a.Alive){Kills++;a.Cast=null;a.HatchAt=Time;if(!a.Primary&&!a.Egg)deadAdds++;CancelHazards(a.Id);}
  }
  void CancelHazards(int owner) { foreach(var h in Hazards)if(h.OwnerId==owner)h.Consumed=true; }
  TrialActor Primary() { foreach(var a in Actors)if(a.Primary&&a.Alive)return a;return null; }
  TrialActor FindActor(int id) { foreach(var a in Actors)if(a.Id==id)return a;return null; }
  void Say(float z,float y,string text,bool damage) { Texts.Add(new TrialText{Z=z,Y=y,Until=Time+.85f,Text=text,Damage=damage}); }
  float Random01() { random^=random<<13;random^=random>>17;random^=random<<5;return (random&0x00ffffff)/16777216f; }
  static float Down(float n,float dt) { return Math.Max(0,n-dt); }
  static float Approach(float from,float to,float step) { return from<to?Math.Min(to,from+step):Math.Max(to,from-step); }
  static void Band(string band,out float y0,out float y1) {
   y0=band=="high"?1.05f:band=="body"? .8f:0;
   y1=band=="low"? .75f:band=="high"?3.3f:band=="full"?8:1.35f;
  }
 }
}
