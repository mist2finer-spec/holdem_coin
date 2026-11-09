using System;using System.IO;using System.Linq;using UnityEngine;using UnityEditor;using IslandGame;using Newtonsoft.Json.Linq;
public static class ExportComboContact {
 public static object Run(){
  var assets=Resources.Load<Battle3DAssets>("Battle3DAssets");var profile=BattleGroundingProfile.Load().Hero;
  var root=new GameObject("Combo curve export");root.hideFlags=HideFlags.HideAndDontSave;
  var model=UnityEngine.Object.Instantiate(assets.hero,root.transform,false);var bones=model.GetComponentsInChildren<Transform>(true);
  var hand=bones.Single(t=>t.name.EndsWith(":RightHand"));var shoulder=bones.Single(t=>t.name.EndsWith(":RightArm"));var hips=bones.Single(t=>t.name.EndsWith(":Hips"));
  var weapon=new GameObject("Canonical blade").transform;weapon.SetParent(hand,false);weapon.localRotation=Quaternion.Euler(0,0,90);
  float scale=assets.heroHeight/profile.ReferenceHeight;var data=new JObject{{"revision","hero-weapon-v2-three-swings"},{"unitsPerMeter",100},{"bladeRadius",6},{"heroHeight",assets.heroHeight}};
  try{using(var player=new RuntimeAnimationPlayer(model,0))foreach(bool low in new[]{false,true}){
   var all=new JObject();var clips=new[]{assets.attack1,assets.attack2,assets.attack3};
   for(int c=0;c<3;c++){string action="attack"+(c+1);var clip=clips[c];var frames=new JArray();
    for(int i=0;i<=120;i++){float phase=i/120f;float time=NativeCombatPresentation.MotionTime(phase*.55f,.55f,.22f,clip.length,clip.length*.45f);player.Sample(clip,time);model.transform.localPosition=Vector3.zero;model.transform.localRotation=Quaternion.identity;model.transform.localScale=Vector3.one*scale;
     float height;if(!profile.TryHeight(clip,time,out height))height=profile.BaseFoot;var pelvis=root.transform.InverseTransformPoint(hips.position);model.transform.localPosition=new Vector3(-pelvis.x,-height*scale,-pelvis.z);
     if(low)HeroMeleePose.Apply(action,phase,shoulder,weapon,0);var a=weapon.TransformPoint(new Vector3(0,.13f,0));var b=weapon.TransformPoint(new Vector3(0,.73f,0));frames.Add(new JArray(a.x*100,a.y*100,a.z*100,b.x*100,b.y*100,b.z*100));
    }
    all[action]=new JObject{{"clip",clip.name},{"clipLength",clip.length},{"clipAsset",AssetDatabase.GetAssetPath(clip)},{"duration",.55f},{"hitAt",.22f},{"activeFrom",.32f},{"activeTo",HeroMeleePose.ActiveTo(action)},{"cancelFrom",1f},{"segments",120},{"frames",frames}};
   }data[low?"lowAttacks":"attacks"]=all;
  }string path=Path.Combine(Application.dataPath,"../Temp/hero-contact-export.json");File.WriteAllText(path,data.ToString(Newtonsoft.Json.Formatting.None));return new {path,poses=726};}
  finally{UnityEngine.Object.DestroyImmediate(root);}
 }
}
