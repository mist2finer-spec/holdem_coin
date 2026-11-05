using UnityEngine;
namespace IslandGame {
 public sealed class IslandAudio:MonoBehaviour {
  AudioSource music,effects;
  bool trialMusic,trialEffects;
  public void SuspendForTrial(){trialMusic=music&&music.isPlaying;trialEffects=effects&&effects.isPlaying;if(music)music.Pause();if(effects)effects.Pause();}
  public void ResumeAfterTrial(){if(trialMusic&&music)music.UnPause();if(trialEffects&&effects)effects.UnPause();trialMusic=trialEffects=false;}
  void Ensure(){if(music)return;music=gameObject.AddComponent<AudioSource>();effects=gameObject.AddComponent<AudioSource>();music.loop=true;music.volume=.25f;effects.volume=.65f;}
  public void Music(string name,float volume=.24f){Ensure();music.volume=volume;var clip=Resources.Load<AudioClip>("WebAssets/audio/poker/"+name);if(clip==music.clip)return;music.clip=clip;if(clip)music.Play();}
  public void Effect(string name){Ensure();var clip=Resources.Load<AudioClip>("WebAssets/audio/poker/"+name);if(clip)effects.PlayOneShot(clip);}
 }
}
