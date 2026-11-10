using UnityEngine;
namespace IslandGame.Diorama {
 [CreateAssetMenu(menuName="Island/Diorama lighting preset")]
 public sealed class DioramaLightingPreset:ScriptableObject {
  public Color keyColor=new Color(1,.87f,.69f),fillColor=new Color(.48f,.65f,.87f),sky=new Color(.34f,.40f,.51f),equator=new Color(.24f,.28f,.34f),ground=new Color(.17f,.14f,.13f),farColor=new Color(.23f,.36f,.39f);
  public float keyIntensity=1.12f,fillIntensity=.12f,fogStart=30,fogEnd=85;
 }
}
