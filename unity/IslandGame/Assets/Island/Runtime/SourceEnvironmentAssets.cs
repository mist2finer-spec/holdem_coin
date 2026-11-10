using UnityEngine;
namespace IslandGame {
 public sealed class SourceEnvironmentAssets:ScriptableObject {
  public Mesh[] grassLods; public Material grassMaterial; public TextAsset[] zones;
  public GameObject[] trees,rocks; public TextAsset bossGrass;
 }
}
