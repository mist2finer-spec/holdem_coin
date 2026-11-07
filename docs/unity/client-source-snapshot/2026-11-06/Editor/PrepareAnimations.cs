using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using IslandGame;
public static class PrepareAnimations {
 const string Folder="Assets/Island/Art/Battle3D/UnityBoss/";
 static AnimationClip Save(AnimationClip c,string path){var old=AssetDatabase.LoadAssetAtPath<AnimationClip>(path);if(old){EditorUtility.CopySerialized(c,old);UnityEngine.Object.DestroyImmediate(c);return old;}AssetDatabase.CreateAsset(c,path);return c;}
 static AnimationClip Remap(string file){var raw=AssetDatabase.LoadAllAssetsAtPath(Folder+file).OfType<AnimationClip>().Single();var c=new AnimationClip{name=raw.name,frameRate=raw.frameRate,legacy=false};foreach(var binding in AnimationUtility.GetCurveBindings(raw)){var b=binding;if(b.path.StartsWith("rig_v001/"))b.path=b.path.Substring(9);AnimationUtility.SetEditorCurve(c,b,AnimationUtility.GetEditorCurve(raw,binding));}c.EnsureQuaternionContinuity();return Save(c,Folder+raw.name+"_Bound.anim");}
 static AnimationClip Locomotion(GameObject model,AnimationClip guard,bool walk){
  guard.SampleAnimation(model,.12f);var bones=model.GetComponentsInChildren<Transform>().Where(t=>t!=model.transform&&!t.GetComponent<Renderer>()).ToArray();var poses=bones.Select(t=>t.localRotation).ToArray();var positions=bones.Select(t=>t.localPosition).ToArray();var c=new AnimationClip{name=walk?"Boss_AdaptedWalk":"Boss_AdaptedIdle",frameRate=30};float duration=walk?1.25f:2.4f;
  for(int i=0;i<bones.Length;i++){var q=new[]{new AnimationCurve(),new AnimationCurve(),new AnimationCurve(),new AnimationCurve()};var p=new[]{new AnimationCurve(),new AnimationCurve(),new AnimationCurve()};
   for(int frame=0;frame<=72;frame++){float time=duration*frame/72,phase=time/duration*Mathf.PI*2,s=Mathf.Sin(phase);var rotation=poses[i];var position=positions[i];string n=bones[i].name;
    if(n=="Hips")position.y+=(walk?Mathf.Abs(s)*.018f:Mathf.Sin(phase)*.004f);
    if(n=="Chest")rotation*=Quaternion.Euler(walk?0:1.6f*s,walk?3*s:0,0);
    if(walk&&(n=="Thigh.L"||n=="Thigh.R"))rotation*=Quaternion.Euler((n.EndsWith("L")?1:-1)*s*20,0,0);
    if(walk&&(n=="Shin.L"||n=="Shin.R"))rotation*=Quaternion.Euler(Mathf.Max(0,(n.EndsWith("L")?-1:1)*s)*25,0,0);
    q[0].AddKey(time,rotation.x);q[1].AddKey(time,rotation.y);q[2].AddKey(time,rotation.z);q[3].AddKey(time,rotation.w);p[0].AddKey(time,position.x);p[1].AddKey(time,position.y);p[2].AddKey(time,position.z);
   }
   string path=AnimationUtility.CalculateTransformPath(bones[i],model.transform);for(int k=0;k<4;k++)c.SetCurve(path,typeof(Transform),"localRotation."+"xyzw"[k],q[k]);for(int k=0;k<3;k++)c.SetCurve(path,typeof(Transform),"localPosition."+"xyz"[k],p[k]);
  }var settings=AnimationUtility.GetAnimationClipSettings(c);settings.loopTime=true;AnimationUtility.SetAnimationClipSettings(c,settings);c.EnsureQuaternionContinuity();return Save(c,Folder+c.name+".anim");
 }
 public static object Main(){var a=Resources.Load<UnityBossAssets>("UnityBossAssets");a.combo=Remap("boss_melee_hook_combo.glb");a.throwClip=Remap("boss_overhand_throw.glb");a.bossHeight=6.5f;
  var model=UnityEngine.Object.Instantiate(a.boss);try{a.idle=Locomotion(model,a.combo,false);a.walk=Locomotion(model,a.combo,true);foreach(var clip in new[]{a.combo,a.throwClip,a.idle,a.walk})foreach(var b in AnimationUtility.GetCurveBindings(clip))if(b.path.Length>0&&!model.transform.Find(b.path))throw new Exception("Missing binding: "+b.path);}finally{UnityEngine.Object.DestroyImmediate(model);}
  a.bossMaterial.color=new Color(.92f,.89f,.83f);a.bossMaterial.SetFloat("_Glossiness",.08f);EditorUtility.SetDirty(a.bossMaterial);EditorUtility.SetDirty(a);AssetDatabase.SaveAssets();return new{bossHeight=a.bossHeight,comboBindings=AnimationUtility.GetCurveBindings(a.combo).Length,throwBindings=AnimationUtility.GetCurveBindings(a.throwClip).Length};
 }
}
