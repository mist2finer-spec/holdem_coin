using UnityEngine;
using UnityEngine.Rendering;
namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Battle diorama settings")]
 public sealed class BattleDioramaSettings:ScriptableObject {
  public Material hero,boss,lit,cutout,normal,transparent,terrain;
  public TerrainData groundPalette;public VolumeProfile volume;
  public Color keyColor=new Color(1,.87f,.69f),fillColor=new Color(.48f,.65f,.87f);
  public Color sky=new Color(.34f,.40f,.51f),equator=new Color(.24f,.28f,.34f),ground=new Color(.17f,.14f,.13f),farColor=new Color(.23f,.36f,.39f);
  public float keyIntensity=1.12f,fillIntensity=.12f,fogStart=30,fogEnd=85;
 }
}
