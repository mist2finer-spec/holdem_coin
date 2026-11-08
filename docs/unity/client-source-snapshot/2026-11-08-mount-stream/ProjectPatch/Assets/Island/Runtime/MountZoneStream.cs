using System.Collections;using System.Collections.Generic;using UnityEngine;using UnityEngine.SceneManagement;
namespace IslandGame {
 // One serial worker owns all scene operations, including completion after exit/re-entry.
 public sealed class MountZoneStream:MonoBehaviour {
  public static MountZoneStream Current{get;private set;}
  readonly Dictionary<int,MountZoneEnvironment> loaded=new Dictionary<int,MountZoneEnvironment>();
  Camera view;Transform hero;int desired=-1,active=-1;float fade,fadeTarget;bool busy;string failure;
  public int ReadyZone=>desired>=0&&loaded.ContainsKey(desired+1)?desired+1:desired>=0&&loaded.ContainsKey(desired)?desired:-1;
  public int ActiveZone=>active;public int LoadedCount=>loaded.Count;public int PeakLoaded{get;private set;}public int Transitions{get;private set;}public float LastTransitionMs{get;private set;}public bool IsReady=>desired>=0&&active==desired&&fade<.01f;public bool Busy=>busy;
  public static MountZoneStream Ensure(){if(Current)return Current;return new GameObject("Mount Sunday scene owner").AddComponent<MountZoneStream>();}
  void Awake(){Current=this;DontDestroyOnLoad(gameObject);StartCoroutine(Worker());}
  public void Bind(Camera camera,Transform target,int zone){view=camera;hero=target;desired=Mathf.Clamp(zone,0,9);if(active>=0&&loaded.TryGetValue(active,out var env)&&hero&&env.grass&&env.grass.hero!=hero)env.Bind(view,hero);}
  public void Release(){desired=-1;view=null;hero=null;fadeTarget=0;}
  void Update(){fade=Mathf.MoveTowards(fade,fadeTarget,Time.unscaledDeltaTime*7);}
  void OnGUI(){if(fade<=0)return;var old=GUI.color;GUI.depth=-1000;GUI.color=new Color(0,0,0,fade);GUI.DrawTexture(new Rect(0,0,Screen.width,Screen.height),Texture2D.whiteTexture);GUI.color=old;if(!string.IsNullOrEmpty(failure))GUI.Label(new Rect(30,Screen.height*.5f,Screen.width-60,60),"구역을 불러오지 못했습니다. 사냥에 다시 입장해 주세요.");}
  IEnumerator Worker(){for(;;){
    if(desired<0){if(loaded.Count>0){int key=-1;foreach(int k in loaded.Keys){key=k;break;}yield return Unload(key);continue;}active=-1;fadeTarget=0;busy=false;yield return null;continue;}
    int wanted=desired;if(!loaded.ContainsKey(wanted)){fadeTarget=1;busy=true;int discard=-1;if(loaded.Count>=2)foreach(int k in loaded.Keys)if(k!=wanted&&k!=wanted+1){discard=k;break;}if(discard>=0){yield return Unload(discard);continue;}yield return Load(wanted);if(!loaded.ContainsKey(wanted)){failure="load";yield return new WaitForSecondsRealtime(1);continue;}continue;}
    if(active!=wanted){busy=true;float start=Time.realtimeSinceStartup;fadeTarget=1;while(fade<.99f&&desired==wanted)yield return null;if(desired!=wanted)continue;foreach(var e in loaded.Values)e.gameObject.SetActive(false);var env=loaded[wanted];env.Bind(view,hero);env.gameObject.SetActive(true);active=wanted;Physics.SyncTransforms();if(view){view.farClipPlane=650;var rig=view.GetComponentInParent<BattleCameraController>();if(rig)rig.ResetPose();}yield return null;Transitions++;LastTransitionMs=(Time.realtimeSinceStartup-start)*1000;}
    int old=-1;foreach(int k in loaded.Keys)if(k!=desired&&k!=desired+1){old=k;break;}if(old>=0){yield return Unload(old);yield return Resources.UnloadUnusedAssets();continue;}
    fadeTarget=0;busy=false;if(wanted<9&&!loaded.ContainsKey(wanted+1)){yield return Load(wanted+1);continue;}yield return null;
   }}
  IEnumerator Load(int index){if(loaded.ContainsKey(index)||loaded.Count>=2)yield break;var op=SceneManager.LoadSceneAsync("MountZone"+(index+1).ToString("00"),LoadSceneMode.Additive);if(op==null){Debug.LogError("Mount scene load did not start: "+index);yield break;}while(!op.isDone)yield return null;var scene=SceneManager.GetSceneByName("MountZone"+(index+1).ToString("00"));MountZoneEnvironment env=null;foreach(var root in scene.GetRootGameObjects()){root.SetActive(false);if(!env)env=root.GetComponent<MountZoneEnvironment>();}if(!env){Debug.LogError("Missing MountZoneEnvironment: "+index);yield return SceneManager.UnloadSceneAsync(scene);yield break;}loaded[index]=env;PeakLoaded=Mathf.Max(PeakLoaded,loaded.Count);if(env.grass)env.grass.Rebuild();}
  IEnumerator Unload(int index){if(!loaded.TryGetValue(index,out var env))yield break;var scene=env.gameObject.scene;env.gameObject.SetActive(false);if(active==index){active=-1;if(view){var sky=view.GetComponent<Skybox>();if(sky){sky.material=null;sky.enabled=false;}}}loaded.Remove(index);var op=SceneManager.UnloadSceneAsync(scene);if(op!=null)while(!op.isDone)yield return null;}
  void OnDestroy(){if(Current==this)Current=null;}
 }
}
