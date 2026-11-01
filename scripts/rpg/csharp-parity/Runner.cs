using System;using System.IO;using System.Globalization;using System.Text.Json;using IslandCombat;
class Runner {
 static readonly JsonSerializerOptions options=new JsonSerializerOptions{IncludeFields=true};
 static void Main(string[] args){using(var doc=JsonDocument.Parse(File.ReadAllText(args[0]))){foreach(var v in doc.RootElement.GetProperty("damage").EnumerateArray()){var factors=JsonSerializer.Deserialize<double[]>(v.GetProperty("more").GetRawText());var n=AxeBuildMath.Damage(v.GetProperty("base").GetString(),v.GetProperty("increased").GetDouble(),factors);Console.WriteLine("D|"+n.Mantissa.ToString("R",CultureInfo.InvariantCulture)+"|"+n.Exponent);}
 foreach(var v in doc.RootElement.GetProperty("builds").EnumerateArray()){var nodes=JsonSerializer.Deserialize<AxeNode[]>(v.GetProperty("nodes").GetRawText(),options);var tags=JsonSerializer.Deserialize<string[]>(v.GetProperty("tags").GetRawText());var gems=JsonSerializer.Deserialize<GemSpec[]>(v.GetProperty("gems").GetRawText(),options);var result=AxeBuildMath.Compile(nodes,tags,gems,v.GetProperty("heal").GetBoolean());Console.WriteLine("B|"+JsonSerializer.Serialize(result,options));}
 foreach(var v in doc.RootElement.GetProperty("health").EnumerateArray()){var n=AxeBuildMath.Remaining(v.GetProperty("hp").GetString(),v.GetProperty("max").GetString(),v.GetProperty("damage").GetString());Console.WriteLine("H|"+n.Mantissa.ToString("R",CultureInfo.InvariantCulture)+"|"+n.Exponent);}
 }}
}
