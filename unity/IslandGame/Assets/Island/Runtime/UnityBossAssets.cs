using UnityEngine;
namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Unity Boss Encounter Assets")]
 public sealed class UnityBossAssets:ScriptableObject {
  public GameObject boss,bridge;public AnimationClip combo,throwClip,knockback,idle,walk;
  public Material bossMaterial,bridgeMaterial,telegraphMaterial,explosionMaterial;
  public AnimationCurve knockbackGround=new AnimationCurve();
  public float bossHeight=6.5f,bossReferenceHeight=1.8f,bossYaw=90,bridgeDeckHeight;
  public float bridgeScale=1,bridgeYaw;public Vector3 bridgeOffset;
  public AnimationCurve bridgeGround=new AnimationCurve();
 }
}
