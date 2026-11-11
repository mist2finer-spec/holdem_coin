using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 public sealed class ZoneTenArenaScene:MonoBehaviour {
  public GameObject entranceSeal,exitSeal;
  const float DropDistance=2.6f;
  Vector3 exitRest;bool captured;
  public float ExitDrop {get;private set;}
  void CaptureRest(){if(captured||!exitSeal)return;exitRest=exitSeal.transform.localPosition;captured=true;}
  void OnEnable(){CaptureRest();}
  void OnDisable(){if(captured&&exitSeal)exitSeal.transform.localPosition=exitRest;ExitDrop=0;}
  public void Present(JObject state){
   CaptureRest();
   bool intro=(string)state?["bossIntroStage"]=="approach";
   if(entranceSeal)entranceSeal.SetActive(!intro);
   if(exitSeal){
    // Use the authority's progress so pause, frame rate, retries and scene re-entry agree with collision.
    float progress=Mathf.Clamp01((float?)state?["villageExitProgress"]??0);
    ExitDrop=DropDistance*Mathf.SmoothStep(0,1,progress);
    var parent=exitSeal.transform.parent;var drop=Vector3.down*ExitDrop;
    exitSeal.transform.localPosition=exitRest+(parent?parent.InverseTransformVector(drop):drop);
    exitSeal.SetActive(progress<1);
   }
  }
 }
}
