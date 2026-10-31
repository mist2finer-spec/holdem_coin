using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed class RpgSession : MonoBehaviour {
  public JObject State,Map;public bool Active,Auto=true;public float Move;public event Action<string> Failed;
  string endpoint,id,cookie;int sequence,epoch;readonly Queue<JObject> commands=new Queue<JObject>();UnityWebRequest request;
  public void Open(string origin,bool campaign){Close();endpoint=origin.TrimEnd('/')+(campaign?"/api/rpg/session":"/api/rpg/rogue");cookie=PlayerPrefs.GetString("island-rpg-cookie","");Auto=true;Active=true;StartCoroutine(Pump(epoch,campaign));}
  public void Command(string action,JObject input=null){if(commands.Count<8)commands.Enqueue(new JObject{{"action",action},{"input",input??new JObject()}});}
  IEnumerator Pump(int generation,bool campaign){
   JObject pending=new JObject{{"action","start"},{"character","hong"}};
   while(Active&&generation==epoch){
    string payload=pending.ToString(Newtonsoft.Json.Formatting.None);bool success=false;
    // Retry exactly the same session sequence after transport failure; server deduplicates it.
    for(int attempt=0;attempt<3&&!success;attempt++){
     using(var req=new UnityWebRequest(endpoint,"POST")){
      request=req;req.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(payload));req.downloadHandler=new DownloadHandlerBuffer();req.SetRequestHeader("Content-Type","application/json");if(cookie!="")req.SetRequestHeader("Cookie",cookie);req.timeout=15;
      yield return req.SendWebRequest();if(generation!=epoch)yield break;
      if(req.result==UnityWebRequest.Result.ConnectionError){if((string)pending["action"]=="start")break;yield return new WaitForSecondsRealtime(.4f);continue;}
      if(req.result!=UnityWebRequest.Result.Success){Active=false;Failed?.Invoke(req.downloadHandler.text);yield break;}
      var header=req.GetResponseHeader("Set-Cookie");if(!string.IsNullOrEmpty(header)){cookie=header.Split(';')[0];PlayerPrefs.SetString("island-rpg-cookie",cookie);PlayerPrefs.Save();}
      State=JObject.Parse(req.downloadHandler.text);id=State.Value<string>("id");sequence=State.Value<int>("sequence");if(State["map"]!=null)Map=(JObject)State["map"].DeepClone();success=true;
     }request=null;
    }
    if(!success){Active=false;Failed?.Invoke("전투 연결 중단. 세션을 다시 시작해 주세요.");yield break;}
    if((string)State["status"]=="won"||(string)State["status"]=="dead"){Active=false;yield break;}
    yield return new WaitForSecondsRealtime(.1f);
    var cmd=commands.Count>0?commands.Dequeue():new JObject{{"action","tick"},{"input",new JObject()}};
    var input=campaign?new JObject{{"move",Move},{"attack",false},{"auto",Auto}}:new JObject{{"x",Move},{"y",0},{"auto",Auto}};
    input.Merge(cmd["input"]);pending=new JObject{{"action",cmd["action"]},{"id",id},{"sequence",sequence+1},{"input",input}};
   }
  }
  public void Close(){epoch++;Active=false;request?.Abort();StopAllCoroutines();request=null;commands.Clear();State=null;Map=null;Move=0;}
  void OnDestroy(){Close();}
 }
}
