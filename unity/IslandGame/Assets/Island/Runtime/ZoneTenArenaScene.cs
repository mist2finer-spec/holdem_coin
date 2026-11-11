using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 public sealed class ZoneTenArenaScene:MonoBehaviour {
  public GameObject entranceSeal,exitSeal;
  public void Present(JObject state){
   bool intro=(string)state?["bossIntroStage"]=="approach";
   bool cleared=(bool?)state?["bossDefeated"]==true;
   if(entranceSeal)entranceSeal.SetActive(!intro);
   if(exitSeal)exitSeal.SetActive(!cleared);
  }
 }
}
