using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using IslandGame;
public static class RetargetKnockback {
 const string Folder="Assets/Island/Art/Battle3D/UnityBoss/",Output="C:/Users/SHK/island-boss-camera-review/";
 static readonly string[] Human={"Hips","Spine","Chest","UpperChest","Neck","Head","LeftShoulder","LeftUpperArm","LeftLowerArm","LeftHand","RightShoulder","RightUpperArm","RightLowerArm","RightHand","LeftUpperLeg","LeftLowerLeg","LeftFoot","LeftToes","RightUpperLeg","RightLowerLeg","RightFoot","RightToes"};
 static readonly string[] Unreal={"pelvis","spine_01","spine_02","spine_03","neck_01","head","clavicle_l","upperarm_l","lowerarm_l","hand_l","clavicle_r","upperarm_r","lowerarm_r","hand_r","thigh_l","calf_l","foot_l","ball_l","thigh_r","calf_r","foot_r","ball_r"};
 static readonly string[] Mixamo={"Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightShoulder","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"};
 static Avatar AvatarFor(GameObject root,bool source){
  var transforms=root.GetComponentsInChildren<Transform>(true);var names=source?Unreal:Mixamo;var human=new List<HumanBone>();
  for(int i=0;i<Human.Length;i++){var t=transforms.FirstOrDefault(v=>string.Equals(v.name,source?names[i]:"mixamorig:"+names[i],StringComparison.OrdinalIgnoreCase));if(t)human.Add(new HumanBone{boneName=t.name,humanName=Human[i],limit=new HumanLimit{useDefaultValues=true}});}
  var desc=new HumanDescription{human=human.ToArray(),skeleton=transforms.Select(t=>new SkeletonBone{name=t.name,position=t.localPosition,rotation=t.localRotation,scale=t.localScale}).ToArray(),upperArmTwist=.5f,lowerArmTwist=.5f,upperLegTwist=.5f,lowerLegTwist=.5f,armStretch=.05f,legStretch=.05f,feetSpacing=0,hasTranslationDoF=false};
  var avatar=AvatarBuilder.BuildHumanAvatar(root,desc);if(!avatar.isValid||!avatar.isHuman)throw new Exception((source?"Source":"Player")+" avatar is invalid");return avatar;
 }
 public static object Probe(){
  var a=Resources.Load<Battle3DAssets>("Battle3DAssets");var source=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(Folder+"hit_knockback_anim_only.glb"));var target=UnityEngine.Object.Instantiate(a.hero);
  try{var sa=AvatarFor(source,true);var ta=AvatarFor(target,false);var report=new{sourceValid=sa.isValid,sourceHuman=sa.isHuman,targetValid=ta.isValid,targetHuman=ta.isHuman};UnityEngine.Object.DestroyImmediate(sa);UnityEngine.Object.DestroyImmediate(ta);return report;}finally{UnityEngine.Object.DestroyImmediate(source);UnityEngine.Object.DestroyImmediate(target);}
 }
 public static object Bake(){
  if(EditorApplication.isPlaying)throw new Exception("Bake outside Play");
  var a=Resources.Load<Battle3DAssets>("Battle3DAssets");var source=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(Folder+"hit_knockback_anim_only.glb"));var target=UnityEngine.Object.Instantiate(a.hero);Avatar sa=null,ta=null;
  try{
   sa=AvatarFor(source,true);ta=AvatarFor(target,false);var sourceClip=AssetDatabase.LoadAllAssetsAtPath(Folder+"hit_knockback_anim_only.glb").OfType<AnimationClip>().Single();
   // Generic transform clips must sample without a humanoid Animator reinterpreting their bindings.
   foreach(var animator in source.GetComponentsInChildren<Animator>(true)){animator.enabled=false;animator.avatar=null;}
   foreach(var animator in target.GetComponentsInChildren<Animator>(true)){animator.enabled=false;animator.avatar=null;}
   using(var sourcePose=new HumanPoseHandler(sa,source.transform))using(var targetPose=new HumanPoseHandler(ta,target.transform)){
    a.idle.SampleAnimation(target,0);var idle=new HumanPose();targetPose.GetHumanPose(ref idle);var start=new HumanPose();sourceClip.SampleAnimation(source,0);sourcePose.GetHumanPose(ref start);var final=new HumanPose();
    sourceClip.SampleAnimation(source,sourceClip.length);sourcePose.GetHumanPose(ref final);
    var bones=target.GetComponentsInChildren<Transform>(true).Where(t=>t.name.StartsWith("mixamorig:")).ToArray();var curves=new Dictionary<string,AnimationCurve[]>();foreach(var bone in bones)curves.Add(AnimationUtility.CalculateTransformPath(bone,target.transform),Enumerable.Range(0,7).Select(_=>new AnimationCurve()).ToArray());
    var clip=new AnimationClip{name="PinkGlass_Knockback_Fall_GetUp",frameRate=60};var ground=new AnimationCurve();var skin=target.GetComponentInChildren<SkinnedMeshRenderer>();var mesh=new Mesh();
    for(int frame=0;frame<=108;frame++){
     float time=frame/60f;var pose=new HumanPose();
     if(time<=sourceClip.length){sourceClip.SampleAnimation(source,time);sourcePose.GetHumanPose(ref pose);}
     else {pose.bodyPosition=final.bodyPosition;pose.bodyRotation=final.bodyRotation;pose.muscles=(float[])final.muscles.Clone();}
     float recover=Mathf.SmoothStep(0,1,Mathf.Clamp01((time-1.15f)/.65f));
     Vector3 bodyOffset=pose.bodyPosition-start.bodyPosition;pose.bodyPosition=idle.bodyPosition+new Vector3(0,bodyOffset.y,0);
     pose.bodyPosition=Vector3.Lerp(pose.bodyPosition,idle.bodyPosition,recover);pose.bodyRotation=Quaternion.Slerp(pose.bodyRotation,idle.bodyRotation,recover);
     for(int i=0;i<pose.muscles.Length;i++)pose.muscles[i]=Mathf.Lerp(pose.muscles[i],idle.muscles[i],recover);
     targetPose.SetHumanPose(ref pose);
     foreach(var bone in bones){var c=curves[AnimationUtility.CalculateTransformPath(bone,target.transform)];Vector3 p=bone.localPosition;Quaternion q=bone.localRotation;float[] values={p.x,p.y,p.z,q.x,q.y,q.z,q.w};for(int j=0;j<7;j++)c[j].AddKey(time,values[j]);}
     skin.BakeMesh(mesh);float low=float.PositiveInfinity;foreach(var v in mesh.vertices)low=Mathf.Min(low,target.transform.InverseTransformPoint(skin.transform.TransformPoint(v)).y);ground.AddKey(time,low);
    }
    string[] properties={"m_LocalPosition.x","m_LocalPosition.y","m_LocalPosition.z","m_LocalRotation.x","m_LocalRotation.y","m_LocalRotation.z","m_LocalRotation.w"};foreach(var pair in curves)for(int i=0;i<7;i++)clip.SetCurve(pair.Key,typeof(Transform),properties[i],pair.Value[i]);clip.EnsureQuaternionContinuity();
    string path=Folder+"PinkGlass_Knockback_Fall_GetUp.anim";var existing=AssetDatabase.LoadAssetAtPath<AnimationClip>(path);if(existing){EditorUtility.CopySerialized(clip,existing);UnityEngine.Object.DestroyImmediate(clip);clip=existing;}else AssetDatabase.CreateAsset(clip,path);
    var config=Resources.Load<UnityBossAssets>("UnityBossAssets");if(config){config.knockback=clip;config.knockbackGround=ground;EditorUtility.SetDirty(config);}AssetDatabase.SaveAssets();UnityEngine.Object.DestroyImmediate(mesh);
    var report=new{clip=path,duration=clip.length,bones=bones.Length,curves=curves.Count*7,groundSamples=ground.length,sourceClip=sourceClip.name};File.WriteAllText(Output+"retarget.json",Newtonsoft.Json.JsonConvert.SerializeObject(report,Newtonsoft.Json.Formatting.Indented));return report;
   }
  }finally{if(sa)UnityEngine.Object.DestroyImmediate(sa);if(ta)UnityEngine.Object.DestroyImmediate(ta);UnityEngine.Object.DestroyImmediate(source);UnityEngine.Object.DestroyImmediate(target);}
 }
}
