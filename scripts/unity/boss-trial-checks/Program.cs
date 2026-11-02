using System;
using System.Collections.Generic;
using System.IO;
using IslandGame.BossTrials;

static class Program {
 static int checks;
 static void Check(bool condition,string name) { if(!condition)throw new Exception("FAILED: "+name);checks++; }
 static bool Near(float a,float b,float tolerance=.04f) { return Math.Abs(a-b)<=tolerance; }
 static TrialPattern Pattern(string op="beam",string band="high",float active=.25f) { return new TrialPattern{Id=op,Name=op,Op=op,Kind="Custom",Band=band,Telegraph=.9f,Active=active,Recovery=.5f,Cooldown=2,Damage=20,Width=12,MaxRange=24}; }
 static TrialDefinition Definition(TrialPattern p,string id="TEST") { return new TrialDefinition{Id=id,Name=id,MaxHp=1000,MonsterId=1154,Height=3.2f,Speed=0,PreferredRange=5,Patterns=new List<TrialPattern>{p}}; }
 static BossTrialSimulation Sim(TrialPattern p,string id="TEST") { var s=new BossTrialSimulation(Definition(p,id),"axe",8731,0,24,5,10);s.Actors[0].NextDecision=0;return s; }
 static void Tick(BossTrialSimulation s,float seconds,TrialInput input=default) { for(int i=0;i<(int)Math.Ceiling(seconds*60);i++)s.Advance(BossTrialSimulation.FixedStep,input); }
 static void Quiet(BossTrialSimulation s) { foreach(var a in s.Actors)a.NextDecision=100000; }
 static TrialActor Add(BossTrialSimulation s,int id,float z,float height=1) { var a=new TrialActor{Id=id,Z=z,Height=height,Hp=100,MaxHp=100,NextDecision=100000};s.Actors.Add(a);return a; }
 static void Geometry() {
  var hero=new TrialHero{Z=5};var low=new TrialHazard{Shape=TrialShape.Segment,Z0=0,Z1=12,Y0=0,Y1=.75f};
  Check(TrialGeometry.HeroIntersects(low,hero),"grounded hero hit by low band");hero.Air=1;Check(!TrialGeometry.HeroIntersects(low,hero),"jump clears low band");hero.Air=0;
  var high=new TrialHazard{Shape=TrialShape.Segment,Z0=0,Z1=12,Y0=1.05f,Y1=3.3f};Check(TrialGeometry.HeroIntersects(high,hero),"standing hero hit by upper band");hero.SlideRemaining=1;Check(!TrialGeometry.HeroIntersects(high,hero),"slide clears upper band");Check(TrialGeometry.HeroIntersects(low,hero),"slide has no low-band immunity");
  hero.SlideRemaining=0;var shot=new TrialHazard{Shape=TrialShape.Projectile,Z0=8,Z1=8.4f,PreviousZ=2,Radius=.2f,Y0=.8f,Y1=1.4f};Check(TrialGeometry.HeroIntersects(shot,hero),"swept projectile cannot tunnel");
  var ring=new TrialHazard{Shape=TrialShape.Ring,OriginZ=5,PreviousRadius=2,Radius=3,Y0=0,Y1=.7f};Check(!TrialGeometry.HeroIntersects(ring,hero),"ring centre stays safe");hero.Z=7.5f;Check(TrialGeometry.HeroIntersects(ring,hero),"ring swept outer edge hits");hero.Air=1;Check(!TrialGeometry.HeroIntersects(ring,hero),"ring is jumpable");
  var pool=new TrialHazard{Shape=TrialShape.Column,Z0=6,Z1=9,Y0=0,Y1=4};Check(TrialGeometry.HeroIntersects(pool,hero),"ground column needs sidestep not jump");hero.Z=10;Check(!TrialGeometry.HeroIntersects(pool,hero),"sidestep clears column");
 }
 static void TimelineAndDefense() {
  var s=Sim(Pattern());Tick(s,.8f);Check(s.Hero.Hp==360,"telegraph never deals damage");Check(s.Actors[0].Cast.Stage==TrialStage.Telegraph,"telegraph stage exposed");Tick(s,.3f);Check(s.Hero.Hp==340,"active band deals damage exactly once");Tick(s,.7f);Check(s.Hero.Hp==340,"recovery deals no hidden damage");
  float ready=s.Actors[0].ReadyAt["beam"];Check(ready>3.6f,"independent cooldown includes timeline end");Tick(s,1);Check(s.Actors[0].Cast==null,"cooldown prevents immediate repeated cast");
  var jump=Sim(Pattern("beam","low",.25f));Tick(jump,.6f);jump.Advance(BossTrialSimulation.FixedStep,new TrialInput{Jump=true});Tick(jump,.7f);Check(jump.Hero.Hp==360,"timed jump avoids actual low attack");
  var slide=Sim(Pattern("beam","high",1.3f));Tick(slide,.7f);slide.Advance(BossTrialSimulation.FixedStep,new TrialInput{Slide=true});Tick(slide,1.6f);Check(slide.Hero.Hp==360,"slide covers full longest upper beam");Check(slide.Hero.SlideCooldown>0,"slide cooldown lasts beyond stance");
  var dodge=Sim(Pattern());Quiet(dodge);dodge.Advance(BossTrialSimulation.FixedStep,new TrialInput{Dodge=-1});float cooldown=dodge.Hero.DodgeCooldown;Tick(dodge,.2f,new TrialInput{Dodge=-1});Check(dodge.Hero.DodgeCooldown<cooldown&&dodge.Hero.Stamina<90,"dodge spam cannot reset cooldown or avoid cost");Tick(dodge,.25f);Check(!dodge.Hero.Invulnerable,"dodge invulnerability has finite end");
  var melee=Sim(Pattern());Quiet(melee);melee.Hero.Z=7.5f;melee.Hero.Facing=1;float hp=melee.Actors[0].Hp;melee.Advance(BossTrialSimulation.FixedStep,new TrialInput{Attack=true});Tick(melee,.4f);Check(melee.Actors[0].Hp==hp-62,"basic attack has one hit in real forward reach");
  var skill=Sim(Pattern());Quiet(skill);skill.Advance(BossTrialSimulation.FixedStep,new TrialInput{Skill=true});Tick(skill,.5f);Check(skill.Actors[0].Hp<1000,"trial frost projectile launches at hero native lane coordinate");
 }
 static void Movement() {
  var s=Sim(Pattern());Quiet(s);s.Actors[0].Z=7;Tick(s,2,new TrialInput{Move=1});Check(s.Hero.Z<6.0f,"normal movement cannot cross large actor");float blocked=s.Hero.Z;Tick(s,.3f,new TrialInput{Move=-1});Check(s.Hero.Z<blocked,"normal movement can leave blocked position");
  s.Hero.Z=6.8f;Tick(s,.2f,new TrialInput{Move=-1});Check(s.Hero.Z<6.8f,"overlap can escape away from actor centre");
  var pass=Sim(Pattern());Quiet(pass);pass.Actors[0].Z=20;Add(pass,50,6);Add(pass,51,6.9f);Add(pass,52,7.8f);float landing;
  Check(pass.TryDodgeDestination(5,1,out landing)&&Near(landing,8.8f),"dodge crosses up to three small actors with clear landing");
  Add(pass,53,7.9f);Check(!pass.TryDodgeDestination(5,1,out landing),"four small actors cancel dodge travel");
  pass.Advance(BossTrialSimulation.FixedStep,new TrialInput{Dodge=1});Tick(pass,.4f);Check(Near(pass.Hero.Z,5),"blocked dodge really stays in place");
  pass.Actors.RemoveAt(pass.Actors.Count-1);pass.Actors[1].Z=8.8f;Check(!pass.TryDodgeDestination(5,1,out landing),"occupied dodge landing is rejected");
  var dynamic=Sim(Pattern());Quiet(dynamic);dynamic.Actors[0].Z=20;dynamic.Advance(BossTrialSimulation.FixedStep,new TrialInput{Dodge=1});Tick(dynamic,.2f);Add(dynamic,80,8.8f);Tick(dynamic,.3f);Check(Math.Abs(dynamic.Hero.Z-8.8f)>=.8f-.01f,"moving obstacle cannot leave dodge overlapping at landing");
  var boundary=new BossTrialSimulation(Definition(Pattern()));Quiet(boundary);boundary.Actors[0].Z=-40;Add(boundary,81,-53,1.8f);boundary.Advance(BossTrialSimulation.FixedStep,new TrialInput{Dodge=1});Tick(boundary,.4f);Check(Near(boundary.Hero.Z,-52.2f),"negative native coordinates keep tangential dodge landing without snapback");
  var slide=Sim(Pattern());Quiet(slide);slide.Actors[0].Z=7;slide.Advance(BossTrialSimulation.FixedStep,new TrialInput{Slide=true});Tick(slide,1);Check(slide.Hero.Z<6,"slide cannot pass through boss");
 }
 static void PhaseAndLifecycle(TrialCatalog catalog) {
  var granite=new BossTrialSimulation(catalog.Bosses[2]);granite.Actors[0].Hp=granite.BossMaxHp*.60f;Tick(granite,.05f);Check(granite.Phase==1,"B03 does not transition at contradictory 66 percent");granite.Actors[0].Hp=granite.BossMaxHp*.49f;Tick(granite,.05f);Check(granite.Phase==2,"B03 explicitly transitions at 50 percent");
  var drones=new BossTrialSimulation(catalog.Bosses[7]);Check(drones.Actors.Count==5&&drones.LivingPrimaries==5,"B08 contains five genuine primary actors");foreach(var a in drones.Actors)Check(a.MaxHp==160,"B08 splits total800 into160 per actor");
  drones.Actors[0].Hp=drones.Actors[1].Hp=drones.Actors[2].Hp=0;Tick(drones,.05f);Check(drones.Phase==2&&drones.Result==TrialResult.Playing,"B08 survivor phase at two, no early clear");drones.Actors[3].Hp=0;Tick(drones,.05f);Check(drones.Result==TrialResult.Playing,"B08 last actor must be killed");drones.Actors[4].Hp=0;Tick(drones,.05f);Check(drones.Result==TrialResult.Victory&&drones.Hazards.Count==0,"B08 all five clear and hazards cleaned");
  var titan=new BossTrialSimulation(catalog.Bosses[9]);titan.Actors[0].Hp=3200;Tick(titan,.05f);Check(titan.Phase==2&&titan.Actors[0].InvulnerableUntil-titan.Time>2.9f,"TITAN phase shift protects three seconds");Tick(titan,3.05f);Check(titan.Actors[0].InvulnerableUntil<titan.Time&&titan.Actors[0].VulnerableUntil>titan.Time,"TITAN has two-second vulnerability after shift");
  var defeat=Sim(Pattern());defeat.Hero.Hp=1;Tick(defeat,1.3f);Check(defeat.Result==TrialResult.Defeat&&defeat.Hazards.Count==0,"defeat cleans attack volumes");var retry=Sim(Pattern());Check(retry.Time==0&&retry.Hero.Hp==360&&retry.Hazards.Count==0,"retry reconstructs fresh deterministic session");retry.Abandon();Check(retry.Actors.Count==0&&retry.Hazards.Count==0&&retry.Paused,"menu exit clears actors and attacks");
 }
 static void Specials() {
  var summon=Pattern("summon");summon.Count=4;summon.Damage=0;summon.Cooldown=.1f;summon.Telegraph=.35f;summon.Recovery=.15f;summon.Active=.1f;
  var s=Sim(summon,"B02");s.Hero.Hp=s.Hero.MaxHp=100000;Tick(s,30);Check(s.LivingAdds==6,"summons respect six actor cap under repeated casts");Check(s.Actors.Count==7,"no unbounded live summon accumulation");
  TrialActor add=null;foreach(var a in s.Actors)if(!a.Primary){add=a;break;}Check(add!=null,"summon actors are real");if(add!=null){float next=0;add.ReadyAt.TryGetValue("add-claw",out next);Check(next>s.Time||add.Cast!=null||Math.Abs(add.Z-s.Hero.Z)>2.4f,"summon independent cooldown checked");}
  var eggs=Pattern("eggs");eggs.Count=2;eggs.Damage=0;eggs.Cooldown=99;var brood=Sim(eggs,"B07");Tick(brood,1.3f);TrialActor egg=null;foreach(var a in brood.Actors)if(a.Egg){egg=a;break;}Check(egg!=null&&egg.Hp==60,"eggs spawn as destructible actors");brood.Hero.Z=egg.Z-1.6f;brood.Hero.Facing=1;brood.Advance(BossTrialSimulation.FixedStep,new TrialInput{Attack=true});Tick(brood,4.3f);Check(!brood.Actors.Contains(egg),"destroyed egg never hatches and is cleaned");
  var half=Pattern("half","full",.6f);half.Telegraph=3.2f;half.Damage=65;var apocalypse=Sim(half);apocalypse.Hero.Z=.5f;Tick(apocalypse,.05f);var warning=apocalypse.Hazards[0];Check(Near(warning.MaxZ-warning.MinZ,12),"apocalypse hit volume is exactly half arena");var safe=new TrialHero{Z=20};Check(!TrialGeometry.HeroIntersects(warning,safe),"apocalypse opposite half is actually safe");Tick(apocalypse,3.2f,new TrialInput{Move=1});Check(apocalypse.Hero.Hp==360&&apocalypse.Hero.Z>12+apocalypse.Hero.Radius,"edge start walks into apocalypse safe half before activation");
  var shift=Pattern("charge","low",1);shift.Telegraph=.8f;shift.Cooldown=99;var charge=Sim(shift);charge.Actors[0].Z=22;charge.Hero.Z=23.5f;Tick(charge,1.0f);Check(charge.Actors[0].StunUntil<=charge.Time,"charge is not wall-stunned before travelling");Tick(charge,1);Check(charge.Actors[0].Z>=23.1f&&charge.Actors[0].StunUntil>charge.Time,"charge reaches wall then becomes stunned");
  var p1=Pattern("projectile");p1.Damage=0;p1.Id="a";p1.Cooldown=.1f;var p2=Pattern("beam");p2.Damage=0;p2.Id="b";p2.Cooldown=.1f;var virusDef=Definition(p1,"B09");virusDef.Patterns.Add(p2);var virus=new BossTrialSimulation(virusDef,"axe",8731,0,24,5,10);string previous=null;int serial=0,casts=0;
  for(int i=0;i<1800;i++){virus.Advance(BossTrialSimulation.FixedStep,new TrialInput());var c=virus.Actors[0].Cast;if(c!=null&&c.Serial!=serial){Check(c.Pattern.Id!=previous,"VIRUS never immediately repeats pattern");previous=c.Pattern.Id;serial=c.Serial;casts++;}}Check(casts>=8,"VIRUS scheduler continues when previous pattern excluded");
 }
 static void AllBosses(TrialCatalog catalog) {
  var ids=new HashSet<string>();int patterns=0;
  foreach(var d in catalog.Bosses) {
   Check(ids.Add(d.Id),"unique boss "+d.Id);patterns+=d.Patterns.Count;Check(d.MaxHp>0&&d.Patterns.Count>=4,"boss complete data "+d.Id);
   var s=new BossTrialSimulation(d);s.Hero.Hp=s.Hero.MaxHp=100000;
   for(int i=0;i<2400;i++) {
    if(i==700&&d.Id!="B08")s.Actors[0].Hp=d.MaxHp*.24f;
    s.Advance(BossTrialSimulation.FixedStep,new TrialInput{Move=i%240<120?1:-1,Jump=i%90==0,Slide=i%150==0,Dodge=i%120==0?1:0,Skill=i%300==0});
    Check(s.Hero.Z>=s.MinZ&&s.Hero.Z<=s.MaxZ&&s.Hero.Hp>=0,"bounded hero "+d.Id);
    Check(s.LivingAdds<=BossTrialSimulation.AddCap,"bounded adds "+d.Id);
   }
   if(d.Id!="B08")Check(s.Phase==d.PhaseThresholds.Length+1,"all phase thresholds reachable "+d.Id);
   s.Abandon();Check(s.Hazards.Count==0&&s.Actors.Count==0,"cleanup "+d.Id);
  }
  Check(patterns==49,"all49 PDF patterns represented");
 }
 static int Main() {
  var catalog=TrialCatalog.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"bosses.json")));
  Geometry();TimelineAndDefense();Movement();PhaseAndLifecycle(catalog);Specials();AllBosses(catalog);
  Console.WriteLine("BOSS_TRIAL_CHECKS_PASSED checks="+checks+" bosses="+catalog.Bosses.Count);return 0;
 }
}
