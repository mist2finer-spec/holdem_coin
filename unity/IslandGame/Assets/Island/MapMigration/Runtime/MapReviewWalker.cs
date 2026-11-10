using UnityEngine;
namespace IslandGame.MapReview {
 public sealed class MapReviewWalker:MonoBehaviour {
  public Transform model;public AnimationClip idle,walk;public BattleCameraController rig;public Vector3[] path;public float speed=3.6f;public bool autoWalk;
  RuntimeAnimationPlayer animator;CharacterController body;BattleGroundingProfile.Model grounding;float modelScale;int target;float clock;public int frames;public float travelled;public float MaxGroundGap{get;private set;}
  void Start(){animator=new RuntimeAnimationPlayer(model.gameObject);body=GetComponent<CharacterController>();grounding=BattleGroundingProfile.Load()?.Hero;modelScale=model.localScale.y;rig.view.farClipPlane=9000;float best=float.MaxValue;for(int i=0;i<path.Length;i++){float d=Vector3.Distance(transform.position,path[i]);if(d<best){target=i;best=d;}}}
  void Update(){frames++;float dt=Mathf.Min(Time.deltaTime,.05f);float input=autoWalk?1:Input.GetAxisRaw("Horizontal");if(Input.GetKeyDown(KeyCode.V)){rig.SetViewMode(rig.Mode==ViewMode.Side25D?ViewMode.QuarterView:ViewMode.Side25D);}
   Vector3 before=transform.position;if(Mathf.Abs(input)>.05f&&path.Length>1){int dir=input>0?1:-1;if(Vector2.Distance(new Vector2(transform.position.x,transform.position.z),new Vector2(path[target].x,path[target].z))<.3f)target=Mathf.Clamp(target+dir,0,path.Length-1);var delta=path[target]-transform.position;delta.y=0;var move=Vector3.ClampMagnitude(delta,speed*dt);body.Move(move+Vector3.down*2*dt);if(move.sqrMagnitude>.00001f)transform.rotation=Quaternion.LookRotation(move);clock+=dt;}else body.Move(Vector3.down*2*dt);
   travelled+=Vector3.Distance(before,transform.position);var clip=Mathf.Abs(input)>.05f?walk:idle;if(clip){float sample=clock%clip.length;animator.Sample(clip,sample,dt);if(grounding!=null&&grounding.TryHeight(clip,sample,out float sole))model.localPosition=-Vector3.up*sole*modelScale;}
   if(Physics.Raycast(transform.position+Vector3.up*.8f,Vector3.down,out var hit,3,1<<28)){float gap=transform.position.y-hit.point.y;MaxGroundGap=Mathf.Max(MaxGroundGap,Mathf.Abs(gap));}
   rig.SetPose(transform.position,1,transform.position.y,Mathf.Abs(input)*speed);rig.Tick(dt);
  }
  void OnDestroy(){animator?.Dispose();}
 }
}
