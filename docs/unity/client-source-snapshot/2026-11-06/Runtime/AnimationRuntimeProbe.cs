#if UNITY_EDITOR || DEVELOPMENT_BUILD
using System;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Opt-in development diagnostic; inactive in normal Android gameplay.
 public sealed class AnimationRuntimeProbe:MonoBehaviour {
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
  static void StartWhenRequested(){if(Application.isEditor||!Environment.GetCommandLineArgs().Contains("--island-animation-probe"))return;new GameObject("Animation runtime verification").AddComponent<AnimationRuntimeProbe>();}
  IEnumerator Start(){
   var app=FindFirstObjectByType<IslandApp>();if(app)app.enabled=false;
   var errors=new JArray();Application.LogCallback handler=(message,trace,type)=>{if(type==LogType.Error||type==LogType.Exception||type==LogType.Assert)errors.Add(message);};Application.logMessageReceived+=handler;
   yield return null;
   var rows=new JArray();var boss=Resources.Load<UnityBossAssets>("UnityBossAssets");var hero=Resources.Load<Battle3DAssets>("Battle3DAssets");
   foreach(var pair in new[]{(boss.boss,boss.combo),(boss.boss,boss.throwClip),(boss.boss,boss.idle),(boss.boss,boss.walk),(hero.hero,hero.idle),(hero.hero,hero.run),(hero.hero,hero.attack1),(hero.hero,boss.knockback),(hero.slime,hero.slimeIdle)}){
    var model=Instantiate(pair.Item1);var clip=pair.Item2;var bones=model.GetComponentsInChildren<Transform>();var player=new RuntimeAnimationPlayer(model,0);
    player.Sample(clip,clip.length*.07f);var rotations=bones.Select(t=>t.localRotation).ToArray();var positions=bones.Select(t=>t.localPosition).ToArray();
    yield return null;player.Sample(clip,clip.length*.57f);float angle=0,position=0;int changed=0;
    for(int i=0;i<bones.Length;i++){float d=Quaternion.Angle(rotations[i],bones[i].localRotation);angle=Mathf.Max(angle,d);position=Mathf.Max(position,Vector3.Distance(positions[i],bones[i].localPosition));if(d>.1f)changed++;}
    rows.Add(new JObject{{"clip",clip.name},{"changedBones",changed},{"maxAngle",angle},{"maxPosition",position},{"pass",angle>.1f||position>.001f}});player.Dispose();Destroy(model);
   }
   Application.logMessageReceived-=handler;bool passed=errors.Count==0&&rows.All(r=>(bool)r["pass"]);
   var report=new JObject{{"passed",passed},{"isEditor",Application.isEditor},{"platform",Application.platform.ToString()},{"unity",Application.unityVersion},{"frames",Time.frameCount},{"poses",rows},{"errors",errors}};
   var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"--island-probe-output");string path=index>=0&&index+1<args.Length?args[index+1]:Path.Combine(Application.persistentDataPath,"animation-runtime-probe.json");File.WriteAllText(path,report.ToString());Application.Quit(passed?0:1);
  }
 }
}
#endif
