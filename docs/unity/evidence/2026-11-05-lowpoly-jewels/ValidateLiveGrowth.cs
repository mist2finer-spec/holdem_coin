using System;
using System.IO;
using System.Linq;
using System.Collections;
using UnityEngine;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class ValidateLiveGrowth {
 const string Output="C:/Users/SHK/island-lowpoly-jewel-review/live-growth.json";
 public static object Main(){var a=UnityEngine.Object.FindFirstObjectByType<IslandApp>();a.StartCoroutine(Run(a));return new{started=true};}
 static IEnumerator Run(IslandApp a){
  var p=a.GetComponent<IslandGrowthPanel>();const string id="attr_0_0";int before=a.HudSession.State["build"].Value<int>("remaining");
  p.Tree.SelectNode(id);yield return null;IslandGame.Editor.BattleHudReview.Click("AllocateNode");p.Send("core-allocate-"+id);bool pending=p.CommandPending;
  float end=Time.realtimeSinceStartup+8;
  while(Time.realtimeSinceStartup<end){yield return null;var build=a.HudSession.State?["build"];if(build!=null&&build["state"]["nodes"].Values<string>().Contains(id)&&!p.CommandPending){
    int after=build.Value<int>("remaining");var report=new{status=after==before-1&&pending?"PASS":"FAIL",transport="real isolated RogueService over HTTP",node=id,before,after,duplicateSendWhilePendingIgnored=pending,serverConfirmed=true};File.WriteAllText(Output,Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));yield break;
   }}File.WriteAllText(Output,"{\"status\":\"FAIL\",\"reason\":\"No authoritative allocate response\"}");
 }
}
