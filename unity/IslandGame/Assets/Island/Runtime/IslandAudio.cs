using UnityEngine;
namespace IslandGame {
 public sealed class IslandAudio:MonoBehaviour {
  AudioSource music,effects;
  void Ensure(){if(music)return;music=gameObject.AddComponent<AudioSource>();effects=gameObject.AddComponent<AudioSource>();music.loop=true;music.volume=.25f;effects.volume=.65f;}
  public void Music(string name){Ensure();var clip=Resources.Load<AudioClip>("WebAssets/audio/poker/"+name);if(clip==music.clip)return;music.clip=clip;if(clip)music.Play();}
  public void Effect(string name){Ensure();var clip=Resources.Load<AudioClip>("WebAssets/audio/poker/"+name);if(clip)effects.PlayOneShot(clip);}
 }
}
