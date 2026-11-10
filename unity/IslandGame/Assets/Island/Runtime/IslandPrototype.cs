using UnityEngine;

namespace IslandGame {
 public sealed partial class IslandApp {
  // Presentation bootstrap only. Gameplay and persistence remain on the Node service.
  void InitializePrototype(){
   bool displayCamera=false;
   foreach(var camera in Object.FindObjectsByType<Camera>(FindObjectsSortMode.None))
    if(camera.isActiveAndEnabled&&camera.targetTexture==null&&camera.targetDisplay==0){displayCamera=true;break;}
   if(!displayCamera){
    var backdrop=new GameObject("Prototype backdrop camera");backdrop.transform.SetParent(transform,false);
    var camera=backdrop.AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;
    camera.backgroundColor=new Color(.035f,.055f,.075f);camera.cullingMask=0;camera.depth=-100;
   }
   bool listening=false;
   foreach(var listener in Object.FindObjectsByType<AudioListener>(FindObjectsSortMode.None))
    if(listener.isActiveAndEnabled){listening=true;break;}
   if(!listening)gameObject.AddComponent<AudioListener>();
  }
 }
}