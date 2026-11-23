using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace IslandGame.Tests {
 // skill-sheathe-20261123: the kit skill clip (Mist Finer, every skill uses it) sheathes like the attack recovers do. Sampled at every
 // 60 fps tick on the kit prefab (prefab metres, model scale 1). The recovers are the reference and must pass the same rules:
 //  - when the blade goes through the scabbard mouth (guard outside, tip inside, the blade crossing the mouth plane within 10 cm of
 //    the mouth centre) its edge faces the scabbard's way: twist about the blade axis <= 20 deg (recovers 9.4, the skill was 176);
 //    within 6 cm it also lies on the scabbard axis: axis <= 7 deg, grip-to-grip rotation <= 7 deg (recovers 4.7 / 5.9, skill 9 / 161);
 //  - after the hit no one-tick jump: scabbard turn <= 30 deg and mouth step <= 10 cm per tick, left hand step <= 10 cm per tick
 //    (recovers 27.9 / 8.9 / 6.6; the skill was 117 / 39.6 / 26.4), and the blade never leaves the scabbard by more than 1 m
 //    (the skill was 3.67 m for one tick);
 //  - the clip ends sheathed (blade grip on the sheath grip).
 public sealed class KitSkillSheatheTests {
  static readonly string[] Clips={"skill","iaiRecover","iaiRecoverFrom1","iaiRecoverFrom2"};
  const int HitTick=28;   // kernel kit skill hitAt F(28): the skill's draw (before it) is not checked; the recovers start after their hit
  // twist of b about its own -Y axis relative to s (the swing between the two -Y axes removed)
  static float Twist(Quaternion b,Quaternion s){var aligned=Quaternion.FromToRotation(s*Vector3.down,b*Vector3.down)*s;return Quaternion.Angle(aligned,b);}
  static Transform Find(Transform root,string name,string parent2){foreach(var t in root.GetComponentsInChildren<Transform>(true))if(t.name==name&&!t.GetComponent<Renderer>()&&t.parent&&t.parent.parent&&t.parent.parent.name==parent2)return t;return null;}
  static Transform Bone(Transform root,string suffix){foreach(var t in root.GetComponentsInChildren<Transform>(true))if(t.name.EndsWith(suffix)&&!t.GetComponent<Renderer>())return t;return null;}

  [TestCaseSource(nameof(Clips))] public void Kit_clip_sheathes_along_the_scabbard_without_jumps(string field){
   var kit=Battle3DAssets.LoadKit();if(!kit)Assert.Ignore("no kit asset");
   var clip=(AnimationClip)typeof(Battle3DAssets).GetField(field).GetValue(kit);Assert.IsNotNull(clip,field);
   var root=PrefabUtility.LoadPrefabContents(AssetDatabase.GetAssetPath(kit.hero));
   try{
    var grip=Find(root.transform,"G_katana_saya_grip","Scabbard");var blade=Find(root.transform,"G_katana_ha_grip","Katana");var lh=Bone(root.transform,":LeftHand");
    Assert.IsNotNull(grip,"sheath grip");Assert.IsNotNull(blade,"blade grip");Assert.IsNotNull(lh,"left hand");
    // kit scabbard mouth / tip and the kit sword tip in grip local (kit-scabbard-v1 integrate, port_manifest tipLocal)
    var mouthL=new Vector3(0,-.1939f,0);var sTipL=new Vector3(.0001f,-1.3302f,.0675f);var bTipL=new Vector3(0,-1.31471825f,.0622850023f);
    int n=Mathf.RoundToInt(clip.length*60)+1;Vector3 pm=default,pl=default;Quaternion ps=default;int near=0;
    for(int k=0;k<n;k++){
     clip.SampleAnimation(root,k/60f);
     float gg=(blade.position-grip.position).magnitude;var mouth=grip.TransformPoint(mouthL);string at=clip.name+" tick "+k;
     Assert.Less(gg,1f,at+": blade grip "+gg.ToString("F2")+" m from the sheath grip");
     bool check=k>=(field=="skill"?HitTick:0);
     var G=blade.position;var T=blade.TransformPoint(bTipL);var nrm=(grip.TransformPoint(sTipL)-mouth).normalized;float dG=Vector3.Dot(G-mouth,nrm),dT=Vector3.Dot(T-mouth,nrm);
     if(check&&dG<0&&dT>0){float r=(G+(T-G)*(-dG/(dT-dG))-mouth).magnitude;
      if(r<.10f){near++;Assert.LessOrEqual(Twist(blade.rotation,grip.rotation),20f,at+": blade edge vs scabbard (twist about the blade) at the mouth, r "+(r*100).ToString("F1")+" cm");}
      if(r<.06f){Assert.LessOrEqual(Vector3.Angle(T-G,nrm),7f,at+": blade axis vs scabbard axis at the mouth");
       Assert.LessOrEqual(Quaternion.Angle(blade.rotation,grip.rotation),7f,at+": blade grip vs sheath grip rotation at the mouth");}}
     if(k>0&&check){
      Assert.LessOrEqual(Quaternion.Angle(ps,grip.rotation),30f,at+": scabbard turn per tick");
      Assert.LessOrEqual((mouth-pm).magnitude,.10f,at+": scabbard mouth step per tick");
      Assert.LessOrEqual((lh.position-pl).magnitude,.10f,at+": left hand step per tick");}
     ps=grip.rotation;pm=mouth;pl=lh.position;
    }
    Assert.Greater(near,5,clip.name+": ticks with the blade through the mouth");
    Assert.Less((blade.position-grip.position).magnitude,.001f,clip.name+": ends sheathed (position)");
    Assert.Less(Quaternion.Angle(blade.rotation,grip.rotation),.5f,clip.name+": ends sheathed (rotation)");
   }finally{PrefabUtility.UnloadPrefabContents(root);}
  }
 }
}
