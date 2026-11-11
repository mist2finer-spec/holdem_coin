using UnityEngine;
using Newtonsoft.Json.Linq;
namespace IslandGame {
 public sealed class RpgAudio:MonoBehaviour {
  public static RpgAudio Current{get;private set;}int clickFrame=-1;
  AudioSource music,skill,button;IslandApp app;IslandAudio shared;AudioClip stage,water,lightning,click;int attack=-1;float previous=-1;bool active;int zone=-1;
  public int SkillEvents{get;private set;}public string LastSkill{get;private set;}
  public void Initialize(IslandApp owner){Current=this;app=owner;shared=GetComponent<IslandAudio>();stage=Resources.Load<AudioClip>("RpgAudio/Stage_1_bgm");water=Resources.Load<AudioClip>("RpgAudio/waterball_1_bgm");lightning=Resources.Load<AudioClip>("RpgAudio/lightning_1_bgm");click=Resources.Load<AudioClip>("RpgAudio/button_2_bgm");music=Source(.22f);skill=Source(.65f);button=Source(.45f);music.clip=stage;music.loop=true;}
  AudioSource Source(float volume){var s=gameObject.AddComponent<AudioSource>();s.playOnAwake=false;s.spatialBlend=0;s.volume=volume;return s;}
  public void Click(){if(button&&clickFrame!=Time.frameCount&&!(shared&&shared.Muted)){clickFrame=Time.frameCount;button.PlayOneShot(click);}}
  void Update(){if(!app||!music)return;bool next=app.HudSession.Active&&app.HudBattle.enabled;if(next!=active){active=next;if(active)shared.SuspendForTrial();else{music.Stop();skill.Stop();shared.ResumeAfterTrial();attack=-1;}}if(!active)return;var state=app.HudSession.State;bool boss=(bool?)state?["zoneTenArena"]==true||(string)state?["roomKind"]=="boss"||(bool?)state?["bossVisible"]==true;bool paused=app.HudSession.Paused||!Application.isFocused;music.mute=skill.mute=button.mute=shared.Muted;
   if(boss){music.Stop();}else if(paused){music.Pause();}else if(!music.isPlaying){music.UnPause();if(!music.isPlaying)music.Play();}if(paused)skill.Pause();else if(skill.clip)skill.UnPause();
  }
  // The exact presentation clock used by VFX, not the input/button clock.
  public void Present(JObject state,float time){if(!active||!skill)return;int room=(int?)state["room"]??0;if(time<previous||zone!=room){attack=-1;skill.Stop();}previous=time;zone=room;var m=state["hero"]?["motion"] as JObject;string kind=(string)m?["kind"];if(kind!="skill")return;float start=(float?)m["start"]??0,hit=(float?)m["hitAt"]??0,duration=(float?)m["duration"]??1;int id=(int?)m["attackId"]??0;if(time<start+hit||attack==id)return;attack=id;var clip=(string)m["skillId"]=="water-ring"?water:(string)m["skillId"]=="storm-call"?lightning:null;if(!clip)return;skill.clip=clip;skill.pitch=Mathf.Clamp(((string)m["skillId"]=="water-ring"?1.05f:.94f)/Mathf.Max(.01f,duration),.1f,3);skill.time=Mathf.Clamp((time-start-hit)*skill.pitch,0,Mathf.Max(0,clip.length-.01f));skill.Play();LastSkill=clip.name;SkillEvents++;}
 }
}
