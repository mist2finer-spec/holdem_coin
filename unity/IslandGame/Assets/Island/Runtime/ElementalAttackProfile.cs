using UnityEngine;

namespace IslandGame {
 public enum ElementalAttackKind { Sword, Water, Lightning }

 // Study adaptations in metres/seconds. These are Island tuning values, not
 // recovered Genshin damage, collision or controller coefficients.
 public readonly struct ElementalAttackProfile {
  public readonly ElementalAttackKind Kind;
  public readonly int Tier, Count;
  public readonly float Windup, Active, Recovery, Radius, Damage, Impulse, Tilt;
  public float Duration => Windup + Active + Recovery;
  public ElementalAttackProfile(ElementalAttackKind kind,int tier) {
   Kind=kind;Tier=Mathf.Clamp(tier,1,kind==ElementalAttackKind.Sword?5:3);
   Count=kind==ElementalAttackKind.Water?4+Tier*4:kind==ElementalAttackKind.Lightning?Tier==1?1:Tier==2?3:5:1;
   Windup=kind==ElementalAttackKind.Sword?.18f:kind==ElementalAttackKind.Water?.52f:.68f;
   Active=kind==ElementalAttackKind.Sword?.24f:kind==ElementalAttackKind.Water?1.85f:.36f;
   Recovery=kind==ElementalAttackKind.Sword?.36f:.55f;
   Radius=kind==ElementalAttackKind.Sword?1.55f+Tier*.17f:kind==ElementalAttackKind.Water?.16f+Tier*.02f:Tier==1?.85f:Tier==2?1.1f:1.65f;
   Damage=kind==ElementalAttackKind.Sword?22+Tier*7:kind==ElementalAttackKind.Water?20+Tier*6:40+Tier*15;
   Impulse=kind==ElementalAttackKind.Sword?1.4f+Tier*.22f:kind==ElementalAttackKind.Water?1.7f:2.4f;
   Tilt=kind!=ElementalAttackKind.Sword?0:Tier==1?-28:Tier==2?20:Tier==3?62:Tier==4?-8:-48;
  }
  public Vector3 SwordPoint(float phase,float radius) {
   float angle=Mathf.Lerp(-105,105,Mathf.Clamp01(phase))*Mathf.Deg2Rad;
   if(Tier%2==0)angle=-angle;
   return new Vector3(0,.85f,0)+Quaternion.Euler(Tilt,0,0)*new Vector3(Mathf.Cos(angle)*radius,0,Mathf.Sin(angle)*radius);
  }
  public string Label => Kind==ElementalAttackKind.Sword?"검기 · "+Tier+"단":Kind==ElementalAttackKind.Water?new[]{"","물방울 · 원형 방출","물방울 · 이중 물결","물방울 · 회전 폭우"}[Tier]:new[]{"","번개 · 낙뢰","번개 · 연쇄","번개 · 뇌우"}[Tier];
 }
}
