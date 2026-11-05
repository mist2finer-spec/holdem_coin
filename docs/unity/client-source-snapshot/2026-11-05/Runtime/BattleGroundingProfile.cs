using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace IslandGame {
 // Offline samples of mesh minima. Runtime sampling never reads or deforms mesh vertices.
 public sealed class BattleGroundingProfile {
  sealed class Track {public float Length;public float[] Heights;}
  public sealed class Model {
   public int Vertices;public float ReferenceHeight,BaseFoot;public Bounds Bounds;
   readonly Dictionary<string,Track> clips=new Dictionary<string,Track>();
   public bool TryHeight(AnimationClip clip,float time,out float height){
    Track track;height=BaseFoot;if(!clip||!clips.TryGetValue(clip.name,out track)||Mathf.Abs(clip.length-track.Length)>.001f)return false;
    float t=Mathf.Clamp01(time/Mathf.Max(.001f,track.Length))*(track.Heights.Length-1);int i=Mathf.Min(Mathf.FloorToInt(t),track.Heights.Length-2);
    height=Mathf.Lerp(track.Heights[i],track.Heights[i+1],t-i);return true;
   }
   internal Model(JObject value){
    Vertices=value.Value<int>("vertices");ReferenceHeight=value.Value<float>("referenceHeight");BaseFoot=value.Value<float>("baseFoot");
    Bounds=new Bounds(Vector(value["boundsCenter"]),Vector(value["boundsSize"]));
    foreach(var p in ((JObject)value["clips"]).Properties())clips[p.Name]=new Track{Length=p.Value.Value<float>("length"),Heights=p.Value["heights"].ToObject<float[]>()};
   }
  }
  public Model Hero,Slime;
  static Vector3 Vector(JToken v)=>new Vector3(v[0].Value<float>(),v[1].Value<float>(),v[2].Value<float>());
  public static BattleGroundingProfile Load(){var data=Resources.Load<TextAsset>("BattleGroundingProfile");if(!data)return null;var json=JObject.Parse(data.text);return new BattleGroundingProfile{Hero=new Model((JObject)json["hero"]),Slime=new Model((JObject)json["slime"])};}
 }
}
