using System;using System.IO;using System.Collections;using UnityEngine;using UnityEngine.Rendering;using IslandGame;using Newtonsoft.Json.Linq;
public static class VerifyDioramaReentry {
 public static object Main(){var app=UnityEngine.Object.FindFirstObjectByType<IslandApp>();app.StartCoroutine(Run(app));return new{started=true};}
 static IEnumerator Run(IslandApp app){var errors=new JArray();Application.LogCallback cb=(m,s,t)=>{if(t==LogType.Error||t==LogType.Exception)errors.Add(m);};Application.logMessageReceived+=cb;var rows=new JArray();int instance=0;
  for(int n=0;n<3;n++){app.SendMessage("StartRpg",false);double start=Time.realtimeSinceStartupAsDouble;while(Time.realtimeSinceStartupAsDouble-start<4)yield return null;var view=app.HudBattle.GetComponent<Battle3DView>();var look=view.Diorama;int count=app.GetComponents<BattleDioramaLook>().Length,volumes=app.GetComponentsInChildren<Volume>(true).Length;bool same=instance==0||instance==look.GetInstanceID();if(instance==0)instance=look.GetInstanceID();rows.Add(new JObject{["iteration"]=n,["components"]=count,["volumes"]=volumes,["sameComponent"]=same,["active"]=look.Active,["renderers"]=look.TrackedRenderers});if(count!=1||volumes!=1||!same||!look.Active)errors.Add("Reentry ownership mismatch");}
  Application.logMessageReceived-=cb;File.WriteAllText("C:/Users/SHK/island-contact-diorama-20261107/evidence/diorama-reentry.json",new JObject{["passed"]=errors.Count==0,["iterations"]=rows,["errors"]=errors}.ToString());
 }
}
