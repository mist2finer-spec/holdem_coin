using System;
using System.Collections.Generic;
using System.Globalization;
using BreakInfinity;
namespace IslandCombat {
 [Serializable] public class AmountDto { public double mantissa; public long exponent; public static AmountDto From(BigDouble n) { return new AmountDto { mantissa=n.Mantissa,exponent=n.Exponent }; } public BigDouble Value() { return new BigDouble(mantissa,exponent); } }
 [Serializable] public class AxeNode { public string id; public double damage,reduction,cooldown,area; public double moreDamage=1,moreArea=1; }
 [Serializable] public class AxeEdge { public string from,to; }
 [Serializable] public class GemSpec { public string id; public string[] tags; public double more=1,area=1,cooldown=1; public int repeat; }
 [Serializable] public class ActiveSpec { public string id,name; public string[] tags; }
 [Serializable] public class AxeCatalog { public int version,linkCount,supportSockets; public string weapon; public AxeNode[] nodes; public AxeEdge[] edges; public ActiveSpec[] skills; public GemSpec[] gems; }
 public class SkillResult { public double effect,area,range,cooldown; public int repeats; }
 public static class AxeBuildMath {
  static BigDouble Amount(string text){if(text==null||!System.Text.RegularExpressions.Regex.IsMatch(text,@"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$"))throw new ArgumentException("Invalid amount");var n=BigDouble.Parse(text);if(double.IsNaN(n.Mantissa)||double.IsInfinity(n.Mantissa)||n.Exponent>1000000000||n.Exponent< -1000000000)throw new ArgumentException("Amount out of range");return n;}

  public static BigDouble Damage(string amount,double increased,params double[] more) {
   var n=Amount(amount);if(n<0||double.IsNaN(increased)||double.IsInfinity(increased)||increased< -1)throw new ArgumentException("Invalid damage");n*=1+increased;
   foreach(var factor in more){if(double.IsNaN(factor)||double.IsInfinity(factor)||factor<0)throw new ArgumentException("Invalid modifier");n*=factor;}return n;
  }
  public static double Radius(double increased,double more=1){if(double.IsNaN(increased)||double.IsInfinity(increased)||increased< -1||double.IsNaN(more)||double.IsInfinity(more)||more<0)throw new ArgumentException("Invalid area");return Math.Sqrt((1+increased)*more);}
  public static BigDouble Remaining(string hp,string max,string damage){var h=Amount(hp);var m=Amount(max);var d=Amount(damage);if(h<0||m<=0||h>m||d<0)throw new ArgumentException("Invalid health");return BigDouble.Max(0,h-BigDouble.Min(h,d));}
  public static bool Connected(string[] allocated,AxeEdge[] edges){var set=new HashSet<string>(allocated);if(!set.Contains("root")||set.Count!=allocated.Length)return false;var seen=new HashSet<string>{"root"};bool changed=true;while(changed){changed=false;foreach(var edge in edges){if(!set.Contains(edge.from)||!set.Contains(edge.to))continue;if(seen.Contains(edge.from)&&seen.Add(edge.to))changed=true;if(seen.Contains(edge.to)&&seen.Add(edge.from))changed=true;}}return seen.Count==set.Count;}
  // The Unity caller supplies the same exported node/gem JSON and selected IDs as the web compiler.
  public static SkillResult Compile(AxeNode[] nodes,string[] activeTags,GemSpec[] supports,bool heal=false){
   if(supports.Length!=5)throw new ArgumentException("A six-link has five support sockets");double damage=0,area=0,cooldown=0,moreDamage=1,moreArea=1;foreach(var n in nodes){damage+=n.damage;area+=n.area;cooldown+=n.cooldown;moreDamage*=n.moreDamage;moreArea*=n.moreArea;}
   var result=new SkillResult{effect=heal?1:(1+damage)*moreDamage,area=heal?1:(1+area)*moreArea,cooldown=1-cooldown};var used=new HashSet<string>();
   foreach(var gem in supports){if(gem==null)continue;if(!used.Add(gem.id))throw new ArgumentException("Duplicate support");bool match=false;foreach(var tag in gem.tags)if(Array.IndexOf(activeTags,tag)>=0)match=true;if(!match)throw new ArgumentException("Incompatible support");result.effect*=gem.more;result.area*=gem.area;result.cooldown*=gem.cooldown;result.repeats+=gem.repeat;}
   result.range=Radius(0,result.area);result.cooldown=Math.Max(.35,result.cooldown);return result;
  }
 }
}
