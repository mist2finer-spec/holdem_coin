using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 // Engine.IO 4 / Socket.IO default namespace, HTTP polling, text events and acknowledgements.
 // Uses the production transport; no unsafe websocket fallback or private card endpoint.
 public sealed class PollingSocket : MonoBehaviour {
  public event Action<string,JToken> Message;public event Action Ready;public event Action<string> Failed;
  readonly Queue<string> outgoing=new Queue<string>();readonly Dictionary<int,Action<JToken>> replies=new Dictionary<int,Action<JToken>>();
  UnityWebRequest read,write;string endpoint,sid;int serial,epoch;bool active;
  public void Open(string url){Close();endpoint=url.TrimEnd('/')+"/socket.io/?EIO=4&transport=polling&XTransformPort=3003";active=true;StartCoroutine(ReadLoop(epoch));StartCoroutine(WriteLoop(epoch));}
  public void Emit(string name,JToken body=null,Action<JToken> reply=null){int? id=null;if(reply!=null){id=++serial;replies[id.Value]=reply;}outgoing.Enqueue(SocketFrames.Event(name,body,id));}
  string Url(){return endpoint+(sid==null?"":"&sid="+UnityWebRequest.EscapeURL(sid))+"&t="+Guid.NewGuid().ToString("N");}
  IEnumerator ReadLoop(int generation){
   while(active&&generation==epoch){
    using(var req=UnityWebRequest.Get(Url())){read=req;try{req.timeout=40;yield return req.SendWebRequest();
     if(generation!=epoch)yield break;
     if(req.result!=UnityWebRequest.Result.Success){Fail("연결 끊김: "+req.error);yield break;}
     foreach(var packet in req.downloadHandler.text.Split('\u001e')){
      if(packet.StartsWith("0")){sid=JObject.Parse(packet.Substring(1)).Value<string>("sid");outgoing.Enqueue("40");}
      else if(packet=="2")outgoing.Enqueue("3");
      else if(packet.StartsWith("40")){Ready?.Invoke();}
      else if(packet=="1"||packet.StartsWith("41")){Fail("서버 연결 종료");yield break;}
      else {int kind;int? ack;JArray data;if(!SocketFrames.Decode(packet,out kind,out ack,out data))continue;
       if(kind==3&&ack.HasValue){Action<JToken> cb;if(replies.TryGetValue(ack.Value,out cb)){replies.Remove(ack.Value);cb(data.Count>0?data[0]:null);}}
       else if(kind==2&&data.Count>0)Message?.Invoke(data[0].Value<string>(),data.Count>1?data[1]:null);
      }
     }
    }finally{read=null;}}
   }
  }
  IEnumerator WriteLoop(int generation){while(active&&generation==epoch){
   if(sid==null||outgoing.Count==0){yield return null;continue;}
   var text=outgoing.Dequeue();using(var req=new UnityWebRequest(Url(),"POST")){
    write=req;try{req.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(text));req.downloadHandler=new DownloadHandlerBuffer();req.SetRequestHeader("Content-Type","text/plain;charset=UTF-8");req.timeout=15;
    yield return req.SendWebRequest();if(generation!=epoch)yield break;
    // Never replay a poker action after an ambiguous POST failure.
    if(req.result!=UnityWebRequest.Result.Success){Fail("전송 결과 불명확: 재접속 후 상태를 확인하세요.");yield break;}
   }finally{write=null;}}
  }}
  void Fail(string message){active=false;Failed?.Invoke(message);}
  public void Close(){epoch++;active=false;read?.Abort();write?.Abort();StopAllCoroutines();read=null;write=null;sid=null;outgoing.Clear();replies.Clear();}
  void OnDestroy(){Close();}
 }
}
