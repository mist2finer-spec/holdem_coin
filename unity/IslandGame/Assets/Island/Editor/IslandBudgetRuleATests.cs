using System;
using System.Collections.Generic;
using NUnit.Framework;

namespace IslandGame.Tests {
 // Q1: rule A (the default) against the old rule for five load shapes. One Observe = one rendered frame (60 = 1 s at 60 fps).
 // Each case starts at level 3 (24 frames over the target) and then feeds the shape. A line per case goes to the console
 // ([Q1 budget] ...) for the report table.
 public sealed class IslandBudgetRuleATests {
  const double T=IslandBudgetPolicy.TargetMilliseconds;
  sealed class Run {public int Final,Changes,FirstZero=-1;public readonly List<int> At=new List<int>();}
  // shape(frame, level) -> load ms. Frames counted after the climb to 3.
  static Run Play(IslandBudgetRule rule,Func<int,int,double> shape,int frames){
   var p=new IslandBudgetPolicy();p.SetRule(rule);for(int i=0;i<24;i++)p.Observe(T+5,0);Assert.AreEqual(3,p.Level,"climb");
   var r=new Run();int last=p.Level;
   for(int i=0;i<frames;i++){p.Observe(shape(i,p.Level),0);
    if(p.Level!=last){r.Changes++;r.At.Add(i);last=p.Level;}
    if(p.Level==0&&r.FirstZero<0)r.FirstZero=i;}
   r.Final=p.Level;return r;
  }
  static void Log(string name,Run a,Run o){
   UnityEngine.Debug.Log($"[Q1 budget] {name} | A: final={a.Final} firstZero={(a.FirstZero<0?"-":(a.FirstZero/60.0).ToString("F2")+"s")} changes={a.Changes} at(s)={string.Join(",",a.At.ConvertAll(i=>(i/60.0).ToString("F1")))} | old: final={o.Final} firstZero={(o.FirstZero<0?"-":(o.FirstZero/60.0).ToString("F2")+"s")} changes={o.Changes}");
  }
  const int Minute=3600;

  [Test] public void Always_under_8ms_both_come_down(){
   Func<int,int,double> s=(i,l)=>7.5;var a=Play(IslandBudgetRule.A,s,Minute);var o=Play(IslandBudgetRule.Old,s,Minute);Log("always 7.5 ms",a,o);
   Assert.AreEqual(0,a.Final);Assert.AreEqual(0,o.Final);Assert.LessOrEqual(a.FirstZero,8*60,"A reaches 0 within 8 s");
  }

  [Test] public void Between_78_and_100_percent_old_stays_A_comes_down(){
   Func<int,int,double> s=(i,l)=>9.5;var a=Play(IslandBudgetRule.A,s,Minute);var o=Play(IslandBudgetRule.Old,s,Minute);Log("always 9.5 ms (8.45-10.83 band)",a,o);
   Assert.AreEqual(3,o.Final,"old: the band resets both counters, it never steps down");Assert.AreEqual(0,o.Changes);
   Assert.AreEqual(0,a.Final,"A steps down");
  }

  [Test] public void Under_target_with_a_lone_hitch_every_half_second_old_stays_A_comes_down(){
   Func<int,int,double> s=(i,l)=>i%30==29?25:7.5;var a=Play(IslandBudgetRule.A,s,Minute);var o=Play(IslandBudgetRule.Old,s,Minute);Log("7.5 ms, one 25 ms frame every 30",a,o);
   Assert.AreEqual(3,o.Final,"old: each hitch puts the 120-frame run back to 0");Assert.AreEqual(0,o.Changes);
   Assert.AreEqual(0,a.Final,"A: 4 hitches in 120 frames is under the 6 allowed");
  }

  [Test] public void Boundary_device_does_not_flap_every_second_or_two(){
   // The level itself moves the load across the target: level 0 = 12 ms (over), level 1+ = 9 ms (under).
   Func<int,int,double> s=(i,l)=>l==0?12:9;var a=Play(IslandBudgetRule.A,s,2*Minute);var o=Play(IslandBudgetRule.Old,s,2*Minute);Log("boundary: 12 ms at level 0, 9 ms at 1-3 (2 min)",a,o);
   // Each try down to 0 comes back up after 8 frames; the waits between tries grow 2 -> 4 -> 8 -> 16 -> 30 s.
   var tries=new List<int>();for(int k=0;k<a.At.Count;k++)if(k>0&&a.At[k]-a.At[k-1]<=8)tries.Add(a.At[k-1]);
   Assert.GreaterOrEqual(tries.Count,3,"A tries level 0 a few times");
   for(int k=1;k<tries.Count;k++)Assert.Greater(tries[k]-tries[k-1],(k==1?4:8)*60-60,"the wait before the next try grows");
   Assert.LessOrEqual(tries.Count,9,"at most a handful of tries in 2 minutes (30 s cap)");
  }

  [Test] public void Always_15ms_neither_comes_down(){
   // BlueStacks-like: the load is over the target on every frame. Rule A does not solve this (not in Q1's scope).
   Func<int,int,double> s=(i,l)=>15;var a=Play(IslandBudgetRule.A,s,Minute);var o=Play(IslandBudgetRule.Old,s,Minute);Log("always 15 ms (over the target every frame)",a,o);
   Assert.AreEqual(3,a.Final);Assert.AreEqual(0,a.Changes);Assert.AreEqual(3,o.Final);Assert.AreEqual(0,o.Changes);
  }

  [Test] public void A_window_and_hold_values(){
   var p=new IslandBudgetPolicy();Assert.AreEqual(IslandBudgetRule.A,p.Rule);Assert.AreEqual(120,IslandBudgetPolicy.WindowSamples);Assert.AreEqual(6,IslandBudgetPolicy.WindowOverAllowed);
   Assert.AreEqual(120,p.HoldSamples);for(int i=0;i<24;i++)p.Observe(T+5,0);Assert.AreEqual(3,p.Level);
   // 9 over-target frames in every 120 (3 per 40) keep A from stepping down; 6 in every 120 (1 per 20) do not.
   for(int i=0;i<600;i++)p.Observe(i%40<3?T+5:7.5,0);Assert.AreEqual(3,p.Level,"9 over per 120: stays");
   var q=new IslandBudgetPolicy();for(int i=0;i<24;i++)q.Observe(T+5,0);
   for(int i=0;i<600;i++)q.Observe(i%20==0?T+5:7.5,0);Assert.Less(q.Level,3,"6 over per 120: steps down");
  }
 }
}
