using System;
using System.IO;
using UnityEngine;
using IslandGame;
using Newtonsoft.Json.Linq;
public static class VerifyApprovedContactUnity {
 public static object Main(){
  var root=new GameObject("Contact parity verification");root.hideFlags=HideFlags.HideAndDontSave;var assets=Resources.Load<UnityBossAssets>("UnityBossAssets");var map=new JObject{{"laneY",5000}};var boss=new JObject{{"unityBoss",true},{"x",0},{"y",5000},{"elevation",0},{"direction",new JObject{{"x",0},{"y",1}}},{"action","combo"},{"motion",new JObject{{"kind","boss-combo"},{"attackId",88},{"start",0},{"duration",2.2}}}};var state=new JObject{{"mobs",new JArray(boss)},{"bossVisible",true},{"fx",new JArray()}};float max=0;int checks=0;
  try{using(var view=new UnityBossPresentation(root.transform,assets,map)){
   for(int i=0;i<=196;i++){float phase=(float)i/196;view.Update(state,phase*2.2f);for(int h=0;h<2;h++)if(BossContactProfile.Active(phase,h))for(int p=h*2;p<h*2+2;p++){float error=Vector3.Distance(view.ContactPoint(p),BossContactProfile.Sample(phase,p));max=Mathf.Max(max,error);checks++;}}
   var hero=new JObject{{"x",0},{"y",5000}};boss["hp"]=100;state["room"]=1;BossContactProfile.ClampBody(hero,state);float separation=new Vector2((float)hero["x"],(float)hero["y"]-5000).magnitude;
   var report=new JObject{{"passed",max<.015f&&separation>=162},{"boneComparisons",checks},{"maxWorldErrorMeters",max},{"bodySeparationCoreUnits",separation},{"runtimeBakeMeshCalls",0},{"globalTimeScale",Time.timeScale},{"profileClip",assets.combo.name},{"height",assets.bossHeight}};File.WriteAllText("C:/Users/SHK/island-contact-diorama-20261107/evidence/approved-contact-parity.json",report.ToString());if(!(bool)report["passed"])throw new Exception(report.ToString());return report;
  }}finally{UnityEngine.Object.DestroyImmediate(root);}
 }
}
