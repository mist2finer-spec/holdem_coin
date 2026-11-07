using System;
using UnityEngine;
namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Nature Environment Assets")]
 public sealed class NatureEnvironmentAssets : ScriptableObject {
  [Serializable] public sealed class Prop {public GameObject prefab;public string resourcePath;public Bounds bounds;}
  public Prop[] trees,pines,rocks,shrubs,grass,flowers,mushrooms,logs,fences;
  public Material ground,trail,earth;
  public Material[] sourceMaterials,displayMaterials;
  public Color skyColor=new Color(.47f,.62f,.60f);
 }
}
