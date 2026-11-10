using System;
using System.Collections.Generic;
using UnityEngine;
namespace IslandGame {
 public enum SkillTreeNodeType {Small,Notable,Keystone,Socket,Start}
 [Serializable] public sealed class SkillTreeNodeData {
  public string ID,Name,Description,Attribute;public SkillTreeNodeType Type;public List<string> ConnectedNodeIDs=new List<string>();
  public bool Acquired,Available,IsStart,Transformed;public int AllocationCost=1;public Vector2 Position;
 }
 [RequireComponent(typeof(SpriteRenderer),typeof(CircleCollider2D))]
 public sealed class SkillTreeNode : MonoBehaviour {
  public SkillTreeNodeData Data {get;private set;}SpriteRenderer visual,fill;CircleCollider2D hit;
  public void Bind(SkillTreeNodeData data,Sprite sprite,Sprite fillSprite=null){
   Data=data;visual=GetComponent<SpriteRenderer>();visual.sprite=sprite;hit=GetComponent<CircleCollider2D>();hit.radius=.5f;
   if(!fill&&fillSprite){var go=new GameObject("Attribute fill",typeof(SpriteRenderer));go.layer=gameObject.layer;go.transform.SetParent(transform,false);fill=go.GetComponent<SpriteRenderer>();fill.sortingOrder=1;}
   if(fill)fill.sprite=fillSprite;
  }
  public static float Radius(SkillTreeNodeType type)=>type==SkillTreeNodeType.Start?.36f:type==SkillTreeNodeType.Keystone?.33f:type==SkillTreeNodeType.Notable||type==SkillTreeNodeType.Socket?.24f:.15f;
  public static Color AttributeColor(string attribute){switch(attribute){case "STR":return new Color(.84f,.40f,.43f);case "DEX":return new Color(.35f,.73f,.51f);case "INT":return new Color(.38f,.59f,.86f);case "STR_DEX":return new Color(.78f,.64f,.32f);case "DEX_INT":return new Color(.32f,.73f,.75f);case "INT_STR":return new Color(.67f,.49f,.79f);default:return new Color(.70f,.74f,.79f);}}
  public void Refresh(bool selected,bool path){
   transform.localScale=Vector3.one*Radius(Data.Type)*2;var color=AttributeColor(Data.Attribute);
   if(fill){fill.color=color*(Data.Acquired?.90f:Data.Available?.75f:.4f);var c=fill.color;c.a=1;fill.color=c;}
   visual.color=selected?new Color(.47f,.94f,.85f):Data.Acquired?new Color(.96f,.79f,.41f):Data.Available?new Color(.94f,.96f,.91f):path?new Color(.91f,.76f,.45f):color*.6f;
   var ring=visual.color;ring.a=1;visual.color=ring;visual.sortingOrder=selected?4:Data.Acquired?3:2;
  }
 }
}
