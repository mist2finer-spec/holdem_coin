using System;using System.IO;using UnityEngine;using IslandGame;using Newtonsoft.Json.Linq;
public static class VerifyApprovedFeedback {
 public static object Main(){var root=new GameObject("Feedback verification");var hero=new GameObject("Synthetic target renderer");hero.transform.SetParent(root.transform);var r=hero.AddComponent<SkinnedMeshRenderer>();var shared=Resources.Load<BattleDioramaSettings>("BattleDioramaSettings").hero;r.sharedMaterial=shared;var originalColor=shared.color;
  var other=new GameObject("Unaffected shared material user").AddComponent<SkinnedMeshRenderer>();other.transform.SetParent(root.transform);other.sharedMaterial=shared;
  var rig=root.AddComponent<BattleCameraController>();var cam=new GameObject("Feedback camera").AddComponent<Camera>();cam.transform.SetParent(root.transform);rig.Bind(cam);
  var feedback=new BossContactFeedback(root,hero.transform,rig);var state=new JObject{["fx"]=new JArray(new JObject{["id"]=2,["kind"]="boss-hook",["attackId"]=88,["contactAt"]=.48})};feedback.Update(state,.60f);feedback.Update(state,.61f);
  var block=new MaterialPropertyBlock();r.GetPropertyBlock(block);bool flashed=!block.isEmpty;other.GetPropertyBlock(block);bool isolated=block.isEmpty&&shared.color==originalColor;bool impact=rig.ImpactOffset.sqrMagnitude>0&&rig.ImpactOffset.magnitude<.06f;
  feedback.Update(state,.8f);r.GetPropertyBlock(block);bool restored=block.isEmpty&&rig.ImpactOffset==Vector3.zero;bool deduped=feedback.ConsumedContacts==1&&feedback.LastAttackId==88&&Mathf.Abs(feedback.LastContactAt-.48f)<.001f;
  bool audio=root.GetComponent<AudioSource>()!=null&&UnityEngine.Object.FindObjectsByType<AudioListener>(FindObjectsSortMode.None).Length==1;
  var result=new{passed=flashed&&isolated&&impact&&restored&&deduped&&audio,flashed,isolated,impact,restored,deduped,audio,timeScale=Time.timeScale};File.WriteAllText("C:/Users/SHK/island-contact-diorama-20261107/evidence/approved-feedback.json",Newtonsoft.Json.JsonConvert.SerializeObject(result,Newtonsoft.Json.Formatting.Indented));feedback.Dispose();UnityEngine.Object.Destroy(root);if(!result.passed)throw new Exception("Feedback verification failed");return result;
 }
}
