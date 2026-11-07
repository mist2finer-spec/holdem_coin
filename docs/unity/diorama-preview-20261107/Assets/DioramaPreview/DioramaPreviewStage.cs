using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Newtonsoft.Json.Linq;
namespace IslandGame.Diorama {
 public enum DioramaView { ForestSide, BossQuarter, DarkArea }
 public enum DioramaSurface { BuiltInBaseline, UrpLit, SoftNilo }
 // Isolated look-development driver. No network, collider, gameplay or production-scene changes.
 [DisallowMultipleComponent]
 public sealed class DioramaPreviewStage:MonoBehaviour {
  public DioramaView shot;public DioramaSurface surface=DioramaSurface.UrpLit;
  public Camera previewCamera;public Volume volume;public bool animate=true,outline,rim,bloom,depthOfField,vignette,lowQuality;
  public DioramaLightingPreset[] lightingPresets;
  public float sampleTime=.55f;public Material[] surfacePresets;public Material[] shaderTemplates;
  Battle3DView view;BattleCameraController rig;Transform world;JObject map,state,boss;float clock,nextScan;DioramaSurface applied;DioramaView appliedShot;
  readonly Dictionary<Material,Material> converted=new Dictionary<Material,Material>();
  readonly Dictionary<Renderer,Material[]> originals=new Dictionary<Renderer,Material[]>();
  readonly Dictionary<Terrain,TerrainData> terrainDataOriginals=new Dictionary<Terrain,TerrainData>();
  readonly Dictionary<Terrain,Material> terrainOriginals=new Dictionary<Terrain,Material>();
  readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
  public int ConvertedMaterials=>converted.Count;public int OriginalRenderers=>originals.Count;
  void Start(){
   if(!previewCamera)throw new InvalidOperationException("Preview camera must be assigned by setup tool");
   var raw=JObject.Parse(Resources.Load<TextAsset>("DioramaMap").text);
   map=new JObject{["unityBossMode"]=true,["laneY"]=5000,["bridge"]=raw["bridge"].DeepClone(),["terrain"]=new JObject{["width"]=raw["width"],["height"]=raw["height"],["step"]=raw["step"],["originX"]=raw["originX"],["originZ"]=raw["originZ"],["heights"]=raw["heights"].DeepClone()}};
   boss=new JObject{["unityBoss"]=true,["x"]=3500,["y"]=5000,["elevation"]=Ground(3500),["hp"]=1000,["action"]="idle",["direction"]=new JObject{["x"]=-1,["y"]=0}};
   state=new JObject{["bossVisible"]=false,["mobs"]=new JArray(boss),["fx"]=new JArray()};boss=(JObject)state["mobs"][0];
   world=new GameObject("Preview authored world (single owner)").transform;world.SetParent(transform,false);
   rig=previewCamera.GetComponentInParent<BattleCameraController>();rig.externallyDriven=true;rig.side=new BattleCameraController.Preset(18,-8,24,23,new Vector3(0,2,0));rig.groundViewportY=.34f;rig.lookAheadDistanceX=.8f;rig.maxVelocityLookAhead=.5f;rig.Bind(previewCamera);rig.GetComponent<BattleForegroundOcclusion>().protectSideView=true;
   view=gameObject.AddComponent<Battle3DView>();view.assets=Resources.Load<Battle3DAssets>("Battle3DAssets");view.Build(world,map,previewCamera);
   applied=surface;appliedShot=shot;ConfigureShot();
  }
  float Ground(float x)=>NativeCombatPresentation.UnityGroundHeight(map,x,0);
  void ConfigureShot(){
   bool bossShot=shot==DioramaView.BossQuarter;view.Planar=bossShot;view.HeroDepth=0;view.HeroHeading=90;
   state["bossVisible"]=bossShot;view.UpdateEncounter(state,sampleTime);
   rig.GetComponent<BattleForegroundOcclusion>().additionalTarget=bossShot?view.BossTarget:null;rig.SetViewMode(bossShot?ViewMode.QuarterView:ViewMode.Side25D,bossShot?view.BossTarget:null);rig.ResetPose();
   RenderSettings.ambientMode=AmbientMode.Trilight;
   RenderSettings.ambientSkyColor=new Color(.27f,.34f,.43f);RenderSettings.ambientEquatorColor=new Color(.19f,.23f,.30f);RenderSettings.ambientGroundColor=new Color(.13f,.105f,.09f);
   RenderSettings.fog=surface!=DioramaSurface.BuiltInBaseline&&!lowQuality;RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogStartDistance=58;RenderSettings.fogEndDistance=135;RenderSettings.fogColor=new Color(.23f,.36f,.39f);
   previewCamera.backgroundColor=RenderSettings.fogColor;RenderSettings.reflectionIntensity=.75f;DynamicGI.UpdateEnvironment();
   foreach(var light in world.GetComponentsInChildren<Light>()){
    bool key=light.name.Contains("warm key");light.intensity=surface==DioramaSurface.BuiltInBaseline?(key?.85f:.35f):key?(shot==DioramaView.DarkArea?.48f:1.12f):.12f;
    light.color=key?new Color(1,.87f,.69f):new Color(.48f,.65f,.87f);light.shadows=key?LightShadows.Soft:LightShadows.None;
   }
   if(surface==DioramaSurface.BuiltInBaseline){RenderSettings.ambientSkyColor=new Color(.35f,.40f,.42f);RenderSettings.ambientEquatorColor=new Color(.22f,.27f,.26f);RenderSettings.ambientGroundColor=new Color(.12f,.16f,.13f);}
   if(surface!=DioramaSurface.BuiltInBaseline&&lightingPresets!=null&&lightingPresets.Length==3){var preset=lightingPresets[(int)shot];RenderSettings.ambientSkyColor=preset.sky;RenderSettings.ambientEquatorColor=preset.equator;RenderSettings.ambientGroundColor=preset.ground;RenderSettings.fogStartDistance=preset.fogStart;RenderSettings.fogEndDistance=preset.fogEnd;RenderSettings.fogColor=preset.farColor;foreach(var light in world.GetComponentsInChildren<Light>()){bool key=light.name.Contains("warm key");light.intensity=key?preset.keyIntensity:preset.fillIntensity;light.color=key?preset.keyColor:preset.fillColor;}}
   if(volume){volume.gameObject.SetActive(surface!=DioramaSurface.BuiltInBaseline&&!lowQuality);var p=volume.profile;if(p.TryGet<Bloom>(out var b))b.active=bloom;if(p.TryGet<DepthOfField>(out var d))d.active=depthOfField;if(p.TryGet<Vignette>(out var v))v.active=vignette;}
   previewCamera.GetUniversalAdditionalCameraData().renderPostProcessing=(bloom||depthOfField||vignette)&&!lowQuality;
  }
  public void ResetSample(float time=.55f){clock=0;sampleTime=time;rig?.ResetPose();}
  void LateUpdate(){if(view==null)return;if(applied!=surface){RestoreMaterials();applied=surface;nextScan=0;ConfigureShot();}if(appliedShot!=shot){appliedShot=shot;ConfigureShot();}
   if(animate)clock+=Mathf.Min(Time.unscaledDeltaTime,.05f);float t=animate?clock:sampleTime;
   bool bossShot=shot==DioramaView.BossQuarter;float x=bossShot?3200:1400;float move=animate?Mathf.Sin(t*.7f)*90:0;x+=move;float ground=Ground(x);
   view.BeginFrame(x);if(!animate)view.SetPreviewPoseTime("hero",sampleTime);view.Draw("hero",animate?"run1":"stay1",x,ground,1,"preview",-1,0,0,"",animate?Time.unscaledDeltaTime:1f/60,t);
   view.UpdateEncounter(state,t);rig.SetPose(new Vector3(x/100,ground/100,0),1,ground/100,animate?Mathf.Cos(t*.7f)*.63f:0);rig.Tick(1f/60);
   if(Time.unscaledTime>=nextScan){nextScan=Time.unscaledTime+.5f;ConvertMaterials();}
  }
  public void RefreshLook(){RestoreMaterials();ConfigureShot();ConvertMaterials();}
  void ConvertMaterials(){if(surface==DioramaSurface.BuiltInBaseline){foreach(var terrain in world.GetComponentsInChildren<Terrain>(true)){if(terrainOriginals.ContainsKey(terrain))continue;terrainOriginals.Add(terrain,terrain.materialTemplate);var originalTerrainMaterial=new Material(Shader.Find("Nature/Terrain/Standard"));owned.Add(originalTerrainMaterial);terrain.materialTemplate=originalTerrainMaterial;}return;}
   foreach(var renderer in world.GetComponentsInChildren<Renderer>(true)){
    if(originals.ContainsKey(renderer))continue;var source=renderer.sharedMaterials;originals.Add(renderer,source);var target=new Material[source.Length];for(int i=0;i<source.Length;i++)target[i]=Convert(source[i],renderer is SkinnedMeshRenderer);renderer.sharedMaterials=target;
   }
   foreach(var terrain in world.GetComponentsInChildren<Terrain>(true)){if(terrainOriginals.ContainsKey(terrain))continue;terrainOriginals.Add(terrain,terrain.materialTemplate);terrainDataOriginals.Add(terrain,terrain.terrainData);var palette=Resources.Load<TerrainData>("DioramaTerrain");if(palette)terrain.terrainData=palette;var mat=new Material(Shader.Find("Universal Render Pipeline/Terrain/Lit"));owned.Add(mat);terrain.materialTemplate=mat;terrain.drawInstanced=true;}
  }
  Material Convert(Material source,bool character){if(!source)return source;if(converted.TryGetValue(source,out var cached))return cached;
   string sourceShader=source.shader.name;bool transparent=source.renderQueue>=3000||sourceShader.Contains("Particles")||sourceShader.Contains("Sprites");
   var shader=Shader.Find(character&&surface==DioramaSurface.SoftNilo?"Island/Diorama Soft Nilo":transparent?"Universal Render Pipeline/Unlit":"Universal Render Pipeline/Lit");if(!shader)throw new Exception("Missing preview shader");
   var material=new Material(shader){name=source.name+" · preview "+surface,enableInstancing=true};
   var texture=source.HasProperty("_MainTex")?source.GetTexture("_MainTex"):source.HasProperty("_BaseMap")?source.GetTexture("_BaseMap"):null;
   if(!texture&&source.HasProperty("_BaseTexture"))texture=source.GetTexture("_BaseTexture");if(!texture&&source.HasProperty("_BaseMap"))texture=source.GetTexture("_BaseMap");
   var color=source.HasProperty("_Color")?source.GetColor("_Color"):Color.white;
   material.SetTexture("_BaseMap",texture);material.SetColor("_BaseColor",color);
   if(source.HasProperty("_MainTex")){material.SetTextureScale("_BaseMap",source.GetTextureScale("_MainTex"));material.SetTextureOffset("_BaseMap",source.GetTextureOffset("_MainTex"));}
   bool bossMaterial=source.name.ToLowerInvariant().Contains("boss");float metal=character?(bossMaterial?.68f:0):source.HasProperty("_Metallic")?source.GetFloat("_Metallic"):0;
   if(material.HasProperty("_Metallic"))material.SetFloat("_Metallic",metal);if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",character?.34f:.16f);
   if(source.HasProperty("_BumpMap")&&material.HasProperty("_BumpMap")){var normal=source.GetTexture("_BumpMap");if(normal){material.SetTexture("_BumpMap",normal);material.EnableKeyword("_NORMALMAP");}}
   bool cutout=source.IsKeywordEnabled("_ALPHATEST_ON")||sourceShader.Contains("Cutout")||source.GetTag("RenderType",false)=="TransparentCutout";if(cutout){if(material.HasProperty("_AlphaClip"))material.SetFloat("_AlphaClip",1);material.EnableKeyword("_ALPHATEST_ON");material.SetFloat("_Cutoff",source.HasProperty("_Cutoff")?source.GetFloat("_Cutoff"):.5f);material.SetOverrideTag("RenderType","TransparentCutout");material.renderQueue=2450;}
   if(transparent){material.SetFloat("_Surface",1);material.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);material.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);material.SetFloat("_ZWrite",0);material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");material.renderQueue=3000;}
   if(material.HasProperty("_Cull"))material.SetFloat("_Cull",cutout||sourceShader.Contains("Vegetation")?0:2);
   if(source.HasProperty("_DeepColor")&&source.HasProperty("_ShallowColor")){var water=Color.Lerp(source.GetColor("_DeepColor"),source.GetColor("_ShallowColor"),.3f);water.a=.65f;material.SetColor("_BaseColor",water);material.SetFloat("_Cull",0);}
   if(material.HasProperty("_RimStrength")){material.SetFloat("_RimStrength",rim?.13f:0);material.SetFloat("_RimWidth",.3f);material.SetFloat("_OutlineWidth",outline?.35f:0);material.SetShaderPassEnabled("Outline",outline);material.SetFloat("_ReceiveShadowMappingAmount",.85f);material.SetColor("_IndirectLightMinColor",new Color(.04f,.05f,.065f));}
   if(character){string role=bossMaterial?"Boss":"Hero";var mask=Resources.Load<Texture2D>(role+"SurfaceMask");if(mask){material.SetFloat("_Metallic",1);material.SetFloat("_Smoothness",1);if(material.HasProperty("_SurfaceMask")){material.SetTexture("_SurfaceMask",mask);material.SetFloat("_UseSurfaceMask",1);material.SetFloat("_UseEmission",1);material.SetColor("_EmissionColor",Color.white*1.2f);material.SetTexture("_EmissionMap",texture);}else{material.SetTexture("_MetallicGlossMap",Resources.Load<Texture2D>(role+"MetallicGloss"));material.EnableKeyword("_METALLICSPECGLOSSMAP");material.SetTexture("_EmissionMap",Resources.Load<Texture2D>(role+"Emission"));material.SetColor("_EmissionColor",Color.white*1.2f);material.EnableKeyword("_EMISSION");}}}
   converted[source]=material;owned.Add(material);return material;
  }
  public void RestoreMaterials(){foreach(var pair in originals)if(pair.Key)pair.Key.sharedMaterials=pair.Value;foreach(var pair in terrainOriginals)if(pair.Key)pair.Key.materialTemplate=pair.Value;foreach(var pair in terrainDataOriginals)if(pair.Key)pair.Key.terrainData=pair.Value;terrainDataOriginals.Clear();originals.Clear();terrainOriginals.Clear();converted.Clear();foreach(var item in owned)if(item)Destroy(item);owned.Clear();}
  void OnDestroy(){RestoreMaterials();}
 }
}
