var go=new UnityEngine.GameObject("Lightning projection validation");var cam=go.AddComponent<UnityEngine.Camera>();cam.enabled=false;var results=new Newtonsoft.Json.Linq.JArray();var points=new UnityEngine.Vector3[25];var target=UnityEngine.Vector3.zero;
try{
 foreach(bool ortho in new[]{true,false})foreach(float pitch in new[]{10f,24f,40f})foreach(float zoom in new[]{12f,35f})foreach(float aspect in new[]{.5f,1f,1.78f}){
  cam.orthographic=ortho;cam.orthographicSize=zoom/3;cam.fieldOfView=35;cam.aspect=aspect;cam.rect=new UnityEngine.Rect(0,.5f,1,.5f);cam.transform.rotation=UnityEngine.Quaternion.Euler(pitch,35,0);cam.transform.position=target-cam.transform.forward*zoom;
  if(!IslandGame.ScreenTopLightning.Build(cam,target,points,123,.06f))throw new System.Exception("Visible target rejected");var a=cam.WorldToViewportPoint(points[0]);var b=cam.WorldToViewportPoint(points[24]);
  if(UnityEngine.Mathf.Abs(a.y-1.15f)>.0001f||UnityEngine.Mathf.Abs(a.z-b.z)>.002f||points[24]!=target)throw new System.Exception("Projection failed: "+new Newtonsoft.Json.Linq.JObject{{"ortho",ortho},{"pitch",pitch},{"zoom",zoom},{"aspect",aspect},{"y",a.y},{"startDepth",a.z},{"endDepth",b.z},{"endError",UnityEngine.Vector3.Distance(points[24],target)}});
  var frozen=(UnityEngine.Vector3[])points.Clone();IslandGame.ScreenTopLightning.Build(cam,target,points,123,.06f);for(int i=0;i<points.Length;i++)if(points[i]!=frozen[i])throw new System.Exception("Paused noise changed");
  cam.transform.position+=cam.transform.right*.7f;IslandGame.ScreenTopLightning.Build(cam,target,points,123,.06f);if(UnityEngine.Mathf.Abs(cam.WorldToViewportPoint(points[0]).y-1.15f)>.0001f||points[24]!=target)throw new System.Exception("Camera move moved hit point");
  results.Add(new Newtonsoft.Json.Linq.JObject{{"orthographic",ortho},{"pitch",pitch},{"zoom",zoom},{"aspect",aspect},{"topY",a.y}});
 }
 if(IslandGame.ScreenTopLightning.Build(cam,cam.transform.position-cam.transform.forward,points,123,0))throw new System.Exception("Behind-camera target accepted");
 var report=new Newtonsoft.Json.Linq.JObject{{"result","PASS"},{"cameraCases",results.Count},{"cases",results}};System.IO.File.WriteAllText("G:/holdem_coin-workspace/island/maintenance/lightning-screen-top-20261111/evidence/projection-check.json",report.ToString());return new{result="PASS",cameraCases=results.Count};
}finally{UnityEngine.Object.DestroyImmediate(go);}
