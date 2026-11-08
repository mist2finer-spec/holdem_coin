using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using IslandGame;
public static class RetargetSprint {
 const string Folder="Assets/Island/Art/Battle3D/Sprint/",Output="C:/Users/SHK/mount-sunday-playtest-20261108/evidence/";
 static readonly string[] Human={"Hips","Spine","Chest","UpperChest","Neck","Head","LeftShoulder","LeftUpperArm","LeftLowerArm","LeftHand","RightShoulder","RightUpperArm","RightLowerArm","RightHand","LeftUpperLeg","LeftLowerLeg","LeftFoot","LeftToes","RightUpperLeg","RightLowerLeg","RightFoot","RightToes"};
 static readonly string[] Unreal={"pelvis","spine_01","spine_02","spine_03","neck_01","head","clavicle_l","upperarm_l","lowerarm_l","hand_l","clavicle_r","upperarm_r","lowerarm_r","hand_r","thigh_l","calf_l","foot_l","ball_l","thigh_r","calf_r","foot_r","ball_r"};
 static readonly string[] Mixamo={"Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightShoulder","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"};
 static Avatar AvatarFor(GameObject root,bool source){
  var transforms=root.GetComponentsInChildren<Transform>(true);var names=source?Unreal:Mixamo;var human=new List<HumanBone>();
  for(int i=0;i<Human.Length;i++){var t=transforms.FirstOrDefault(v=>string.Equals(v.name,source?names[i]:"mixamorig:"+names[i],StringComparison.OrdinalIgnoreCase));if(t)human.Add(new HumanBone{boneName=t.name,humanName=Human[i],limit=new HumanLimit{useDefaultValues=true}});}
  var desc=new HumanDescription{human=human.ToArray(),skeleton=transforms.Select(t=>new SkeletonBone{name=t.name,position=t.localPosition,rotation=t.localRotation,scale=t.localScale}).ToArray(),upperArmTwist=.5f,lowerArmTwist=.5f,upperLegTwist=.5f,lowerLegTwist=.5f,armStretch=.05f,legStretch=.05f,feetSpacing=0,hasTranslationDoF=false};
  var avatar=AvatarBuilder.BuildHumanAvatar(root,desc);if(!avatar.isValid||!avatar.isHuman)throw new Exception((source?"Source":"Player")+" avatar is invalid");return avatar;
 }

 public static string Import(){Directory.CreateDirectory(Folder);string p=Folder+"sprint_loop_anim_only.glb";if(!File.Exists(p))File.Copy("G:/new_project/attack_motion_ref/sprint_loop_anim_only.glb",p);AssetDatabase.Refresh();return p;}
 public static string Bake(){
  if(EditorApplication.isPlaying)throw new Exception("Stop play before retarget");
  var a=Resources.Load<Battle3DAssets>("Battle3DAssets");string assetPath=AssetDatabase.GetAssetPath(a),groundPath=AssetDatabase.GetAssetPath(Resources.Load<TextAsset>("BattleGroundingProfile"));
  foreach(var p in new[]{assetPath,groundPath}){string dest=".island-backups/mountstream20261108/"+p;Directory.CreateDirectory(Path.GetDirectoryName(dest));if(!File.Exists(dest))File.Copy(p,dest);}
  var source=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(Folder+"sprint_loop_anim_only.glb"));var target=UnityEngine.Object.Instantiate(a.hero);Avatar sa=null,ta=null;
  try{sa=AvatarFor(source,true);ta=AvatarFor(target,false);var sourceClip=AssetDatabase.LoadAllAssetsAtPath(Folder+"sprint_loop_anim_only.glb").OfType<AnimationClip>().Single();
   foreach(var animator in source.GetComponentsInChildren<Animator>(true)){animator.enabled=false;animator.avatar=null;}
   foreach(var animator in target.GetComponentsInChildren<Animator>(true)){animator.enabled=false;animator.avatar=null;}
   using(var sh=new HumanPoseHandler(sa,source.transform))using(var th=new HumanPoseHandler(ta,target.transform)){
    a.idle.SampleAnimation(target,0);var idle=new HumanPose();th.GetHumanPose(ref idle);sourceClip.SampleAnimation(source,0);var start=new HumanPose();sh.GetHumanPose(ref start);
    var bones=target.GetComponentsInChildren<Transform>(true).Where(t=>t.name.StartsWith("mixamorig:")).ToArray();var curves=bones.ToDictionary(b=>AnimationUtility.CalculateTransformPath(b,target.transform),b=>Enumerable.Range(0,7).Select(_=>new AnimationCurve()).ToArray());
    var clip=new AnimationClip{name="PinkGlass_Sprint_Loop",frameRate=60};var mesh=new Mesh();var skin=target.GetComponentInChildren<SkinnedMeshRenderer>();var heights=new List<float>();int frames=Mathf.CeilToInt(sourceClip.length*60);
    for(int f=0;f<=frames;f++){float time=sourceClip.length*f/frames;sourceClip.SampleAnimation(source,f==frames?0:time);var pose=new HumanPose();sh.GetHumanPose(ref pose);pose.bodyPosition=idle.bodyPosition+Vector3.up*(pose.bodyPosition.y-start.bodyPosition.y);th.SetHumanPose(ref pose);
     foreach(var b in bones){var c=curves[AnimationUtility.CalculateTransformPath(b,target.transform)];var p=b.localPosition;var q=b.localRotation;float[] v={p.x,p.y,p.z,q.x,q.y,q.z,q.w};for(int n=0;n<7;n++)c[n].AddKey(time,v[n]);}
     skin.BakeMesh(mesh,true);heights.Add(mesh.vertices.Min(v=>target.transform.InverseTransformPoint(skin.transform.TransformPoint(v)).y));
    }
    string[] props={"m_LocalPosition.x","m_LocalPosition.y","m_LocalPosition.z","m_LocalRotation.x","m_LocalRotation.y","m_LocalRotation.z","m_LocalRotation.w"};foreach(var pair in curves)for(int i=0;i<7;i++)clip.SetCurve(pair.Key,typeof(Transform),props[i],pair.Value[i]);clip.EnsureQuaternionContinuity();var settings=AnimationUtility.GetAnimationClipSettings(clip);settings.loopTime=true;AnimationUtility.SetAnimationClipSettings(clip,settings);
    string path=Folder+clip.name+".anim";var old=AssetDatabase.LoadAssetAtPath<AnimationClip>(path);if(old){EditorUtility.CopySerialized(clip,old);UnityEngine.Object.DestroyImmediate(clip);clip=old;}else AssetDatabase.CreateAsset(clip,path);
    a.run=clip;EditorUtility.SetDirty(a);var profile=Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(groundPath));profile["hero"]["clips"][clip.name]=new Newtonsoft.Json.Linq.JObject{{"length",clip.length},{"heights",new Newtonsoft.Json.Linq.JArray(heights)}};File.WriteAllText(groundPath,profile.ToString());AssetDatabase.ImportAsset(groundPath);AssetDatabase.SaveAssets();UnityEngine.Object.DestroyImmediate(mesh);
    string report=Newtonsoft.Json.JsonConvert.SerializeObject(new{source=sourceClip.name,sourceDuration=sourceClip.length,result=path,bones=bones.Length,groundSamples=heights.Count,loop=true},Newtonsoft.Json.Formatting.Indented);File.WriteAllText(Output+"sprint-retarget.json",report);return report;
   }
  }finally{if(sa)UnityEngine.Object.DestroyImmediate(sa);if(ta)UnityEngine.Object.DestroyImmediate(ta);UnityEngine.Object.DestroyImmediate(source);UnityEngine.Object.DestroyImmediate(target);}
 }
}
