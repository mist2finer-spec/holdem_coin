using System;
using System.Collections.Generic;
using UnityEngine;

namespace IslandGame {
 public enum SkillTreeNodeType {Small,Notable,Keystone,Socket,Start}
 [Serializable]
 public sealed class SkillTreeNodeData {
  public string ID,Name,Description,Attribute;
  public SkillTreeNodeType Type;
  public List<string> ConnectedNodeIDs=new List<string>();
  public bool Acquired,Available,IsStart,Transformed;
  public int AllocationCost=1;
  public Vector2 Position;
 }
 [RequireComponent(typeof(SpriteRenderer),typeof(CircleCollider2D))]
 public sealed class SkillTreeNode : MonoBehaviour {
  public SkillTreeNodeData Data {get;private set;}
  SpriteRenderer visual;
  public void Bind(SkillTreeNodeData data,Sprite sprite){Data=data;visual=GetComponent<SpriteRenderer>();visual.sprite=sprite;GetComponent<CircleCollider2D>().radius=Radius(data.Type);transform.localScale=Vector3.one;}
  public static float Radius(SkillTreeNodeType type)=>type==SkillTreeNodeType.Start?.22f:type==SkillTreeNodeType.Keystone?.20f:type==SkillTreeNodeType.Notable||type==SkillTreeNodeType.Socket?.155f:.105f;
  public void Refresh(bool selected,bool path){
   float radius=Radius(Data.Type);visual.size=Vector2.one*radius*2;visual.transform.localScale=Vector3.one*radius*2;
   var color=Data.Attribute=="STR"?new Color(.80f,.37f,.38f):Data.Attribute=="DEX"?new Color(.36f,.72f,.51f):Data.Attribute=="INT"?new Color(.38f,.57f,.89f):new Color(.70f,.65f,.48f);
   visual.color=selected?new Color(.57f,1,.95f):Data.Acquired?new Color(1,.80f,.38f):path?new Color(.90f,.77f,.43f):Data.Available?new Color(.78f,.83f,.70f):color*.62f;
   var c=visual.color;c.a=1;visual.color=c;visual.sortingOrder=selected?4:Data.Acquired?3:2;
   GetComponent<CircleCollider2D>().radius=.5f;
  }
 }
}
