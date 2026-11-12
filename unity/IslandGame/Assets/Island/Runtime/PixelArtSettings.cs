using UnityEngine;
namespace IslandGame {
 [CreateAssetMenu(menuName="Island/Pixel Art Settings")]
 public sealed class PixelArtSettings : ScriptableObject {
  public bool enabled = true;
  [Range(320,960)] public int landscapeWidth = 640;
  [Range(240,640)] public int portraitWidth = 360;
  [Range(1,30)] public int poseFps = 12;
  static PixelArtSettings instance;
  public static PixelArtSettings Current => instance ? instance : (instance=Resources.Load<PixelArtSettings>("PixelArtSettings"));
  public static bool Active => Current && Current.enabled;
  public static int Width(float aspect) => Active ? (Screen.width < Screen.height ? Current.portraitWidth : Current.landscapeWidth) : 720;
 }
}
