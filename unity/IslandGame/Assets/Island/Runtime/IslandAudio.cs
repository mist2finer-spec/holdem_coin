using UnityEngine;
namespace IslandGame {
 public sealed class IslandAudio:MonoBehaviour {
  AudioSource music,effects,shuffle;bool hidden,suspended,tableScene;string dealKey="";
  public bool Muted {get;private set;}
  public string TrackName=>music&&music.clip?music.clip.name:"";
  public float MusicVolume=>music?music.volume:0;
  public bool MusicPlaying=>music&&music.isPlaying;
  public bool ShufflePlaying=>shuffle&&shuffle.isPlaying;
  public string LastEffect {get;private set;}
  public int EffectEvents {get;private set;}
  void Awake(){Muted=PlayerPrefs.GetInt("island-audio-muted",0)!=0;}
  void Ensure(){if(music)return;music=gameObject.AddComponent<AudioSource>();effects=gameObject.AddComponent<AudioSource>();shuffle=gameObject.AddComponent<AudioSource>();foreach(var source in new[]{music,effects,shuffle}){source.playOnAwake=false;source.spatialBlend=0;}music.loop=shuffle.loop=true;effects.volume=shuffle.volume=.65f;}
  bool Audible=>!Muted&&!hidden&&!suspended;
  void Playback(){Ensure();music.mute=effects.mute=shuffle.mute=Muted;if(!Audible){music.Pause();effects.Stop();shuffle.Stop();}else if(music.clip&&!music.isPlaying){music.UnPause();if(!music.isPlaying)music.Play();}}
  public void SetMuted(bool value){Muted=value;PlayerPrefs.SetInt("island-audio-muted",value?1:0);PlayerPrefs.Save();Playback();}
  public void ToggleMuted(){SetMuted(!Muted);if(!Muted)Effect("button_press");}
  public void SuspendForTrial(){suspended=true;Playback();}
  public void ResumeAfterTrial(){suspended=false;Playback();}
  void OnApplicationPause(bool value){hidden=value;Playback();}
  void OnApplicationFocus(bool value){hidden=!value;Playback();}
  public void Music(string name,float volume=.24f){Ensure();music.volume=volume;var clip=Resources.Load<AudioClip>("WebAssets/audio/poker/"+name);if(clip!=music.clip){music.Stop();music.clip=clip;}Playback();}
  public void BeginTable(){Ensure();tableScene=true;dealKey="";effects.Stop();shuffle.Stop();Music("lobby_jazz",.06f);}
  public void EndTable(){Ensure();tableScene=false;dealKey="";effects.Stop();shuffle.Stop();Music("lobby_jazz",.24f);}
  public void DealStage(string stage,string hand){
   string key=hand+":"+stage;if(!tableScene||dealKey==key)return;dealKey=key;Ensure();shuffle.Stop();
   if(!Audible)return;
   if(stage=="shuffle"){shuffle.clip=Resources.Load<AudioClip>("WebAssets/audio/poker/shuffle_card");if(shuffle.clip){shuffle.Play();LastEffect="shuffle_card";EffectEvents++;}}
   else if(stage=="cards")Effect("taking_card");
  }
  public void PlayerAction(string action){
   string name=(action??"").ToLowerInvariant().Replace("-","").Replace("_","").Replace(" ","");
   if(name.StartsWith("allin")||name.StartsWith("올인"))Effect("all_in_chip");
   else if(name.StartsWith("raise")||name.StartsWith("call")||name.StartsWith("bet")||name.StartsWith("콜")||name.StartsWith("레이즈"))Effect("chip_raise");
  }
  public void Effect(string name){Ensure();if(!Audible)return;if(name=="taking_card")shuffle.Stop();var clip=Resources.Load<AudioClip>("WebAssets/audio/poker/"+name);if(clip){effects.PlayOneShot(clip,name=="button_press"?.45f/.65f:1);LastEffect=name;EffectEvents++;}}
 }
}
