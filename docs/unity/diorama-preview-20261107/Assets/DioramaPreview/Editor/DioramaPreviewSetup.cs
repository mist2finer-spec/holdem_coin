using System;using System.IO;using System.Linq;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using UnityEngine.Rendering;using UnityEngine.Rendering.Universal;
namespace IslandGame.Diorama.Editor {
 public static class DioramaPreviewSetup {
  const string Folder="Assets/DioramaPreview/Settings",Key="IslandDioramaPreviousPipeline/";
  static T Asset<T>(string name) where T:ScriptableObject {var path=Folder+"/"+name+".asset";var a=AssetDatabase.LoadAssetAtPath<T>(path);if(!a){a=ScriptableObject.CreateInstance<T>();AssetDatabase.CreateAsset(a,path);}return a;}
  static T Override<T>(VolumeProfile p) where T:VolumeComponent {if(p.TryGet<T>(out var v))return v;v=p.Add<T>(false);AssetDatabase.AddObjectToAsset(v,p);return v;}
  [MenuItem("Island/Diorama/Create or repair comparison scenes")]
  static void MenuSetup(){Setup();}
  public static object Setup(){
   if(Application.isPlaying)throw new Exception("Exit Play before scene setup");
   if(!Application.dataPath.Contains("PreviewProject"))throw new Exception("Run in isolated PreviewProject; production pipeline is protected");
   Directory.CreateDirectory(Folder);AssetDatabase.Refresh();
   var renderer=Asset<UniversalRendererData>("DioramaForwardRenderer");renderer.renderingMode=RenderingMode.Forward;
   var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(Folder+"/DioramaURP.asset");if(!pipeline){pipeline=UniversalRenderPipelineAsset.Create(renderer);AssetDatabase.CreateAsset(pipeline,Folder+"/DioramaURP.asset");}
   Undo.RecordObject(pipeline,"Configure diorama URP");pipeline.supportsHDR=true;var serializedPipeline=new SerializedObject(pipeline);serializedPipeline.FindProperty("m_SoftShadowsSupported").boolValue=true;serializedPipeline.ApplyModifiedProperties();pipeline.supportsCameraDepthTexture=false;pipeline.supportsCameraOpaqueTexture=false;pipeline.msaaSampleCount=2;pipeline.renderScale=1;pipeline.shadowDistance=55;pipeline.shadowCascadeCount=2;pipeline.useSRPBatcher=true;
   string key=Key+Application.dataPath;if(!EditorPrefs.HasKey(key)){EditorPrefs.SetString(key,AssetDatabase.GetAssetPath(GraphicsSettings.defaultRenderPipeline));EditorPrefs.SetString(key+"/quality",string.Join("|",Enumerable.Range(0,QualitySettings.names.Length).Select(i=>AssetDatabase.GetAssetPath(QualitySettings.GetRenderPipelineAssetAt(i)))));}
   GraphicsSettings.defaultRenderPipeline=pipeline;for(int i=0;i<QualitySettings.names.Length;i++)SetQualityPipeline(i,pipeline);
   var profiles=new VolumeProfile[3];var lights=new DioramaLightingPreset[3];
   for(int i=0;i<3;i++){var p=profiles[i]=Asset<VolumeProfile>(((DioramaView)i)+"Volume");var b=Override<Bloom>(p);b.active=false;b.threshold.Override(1.25f);b.intensity.Override(.16f);b.scatter.Override(.45f);b.clamp.Override(3);var d=Override<DepthOfField>(p);d.active=false;d.mode.Override(DepthOfFieldMode.Gaussian);d.gaussianStart.Override(45);d.gaussianEnd.Override(85);d.gaussianMaxRadius.Override(.5f);var v=Override<Vignette>(p);v.active=false;v.intensity.Override(.08f);v.smoothness.Override(.35f);EditorUtility.SetDirty(p);
    lights[i]=Asset<DioramaLightingPreset>(((DioramaView)i)+"Lighting");lights[i].keyIntensity=i==2?.55f:1.12f;lights[i].sky=new Color(.34f,.40f,.51f);lights[i].equator=new Color(.24f,.28f,.34f);lights[i].ground=new Color(.17f,.14f,.13f);lights[i].fogStart=30;lights[i].fogEnd=85;EditorUtility.SetDirty(lights[i]);}
   string[] roles={"Armor","Cloth","Leather","Skin","Core"};var materials=new Material[roles.Length];float[] metallic={.45f,0,0,0,.45f},smoothness={.38f,.18f,.27f,.25f,.5f};
   for(int i=0;i<roles.Length;i++){string path=Folder+"/"+roles[i]+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);if(!m){m=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(m,path);}Undo.RecordObject(m,"Diorama surface presets");m.SetFloat("_Metallic",metallic[i]);m.SetFloat("_Smoothness",smoothness[i]);if(i==4){m.SetColor("_EmissionColor",new Color(.1f,.6f,.85f)*1.35f);m.EnableKeyword("_EMISSION");}materials[i]=m;EditorUtility.SetDirty(m);}
   var scenes=new string[3];for(int i=0;i<3;i++){
    string path="Assets/DioramaPreview/"+(DioramaView)i+".unity";var scene=File.Exists(path)?EditorSceneManager.OpenScene(path):EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
    var stage=UnityEngine.Object.FindFirstObjectByType<DioramaPreviewStage>();if(!stage){var root=new GameObject("Diorama comparison stage");Undo.RegisterCreatedObjectUndo(root,"Create isolated diorama stage");stage=Undo.AddComponent<DioramaPreviewStage>(root);}
    if(!stage.GetComponent<DioramaPreviewControls>())Undo.AddComponent<DioramaPreviewControls>(stage.gameObject);
    Undo.RecordObject(stage,"Configure diorama stage");stage.shot=(DioramaView)i;stage.surface=DioramaSurface.UrpLit;stage.surfacePresets=materials;stage.lightingPresets=lights;
    if(!stage.previewCamera){var rigObject=new GameObject("Existing battle camera controller");Undo.RegisterCreatedObjectUndo(rigObject,"Create preview camera rig");rigObject.transform.SetParent(stage.transform,false);var rig=Undo.AddComponent<BattleCameraController>(rigObject);rig.externallyDriven=true;var go=new GameObject("Diorama preview camera");Undo.RegisterCreatedObjectUndo(go,"Create preview camera");go.transform.SetParent(rigObject.transform,false);var camera=Undo.AddComponent<Camera>(go);camera.tag="MainCamera";camera.cullingMask=1<<30;camera.allowHDR=true;camera.clearFlags=CameraClearFlags.SolidColor;rig.view=camera;stage.previewCamera=camera;Undo.AddComponent<UniversalAdditionalCameraData>(go).renderPostProcessing=false;Undo.AddComponent<AudioListener>(go);}
    if(!stage.volume){var go=new GameObject("Diorama optional effects (off for base review)");Undo.RegisterCreatedObjectUndo(go,"Create preview volume");go.transform.SetParent(stage.transform,false);stage.volume=Undo.AddComponent<Volume>(go);stage.volume.isGlobal=true;}stage.volume.sharedProfile=profiles[i];
    EditorSceneManager.MarkSceneDirty(scene);EditorSceneManager.SaveScene(scene,path);scenes[i]=path;
   }
   EditorBuildSettings.scenes=scenes.Select(p=>new EditorBuildSettingsScene(p,true)).ToArray();AssetDatabase.SaveAssets();EditorSceneManager.OpenScene(scenes[0]);return new{scenes,pipeline=AssetDatabase.GetAssetPath(pipeline),postProcessingDefault=false,originalAssetsChanged=false};
  }
  static void SetQualityPipeline(int index,RenderPipelineAsset asset){int previous=QualitySettings.GetQualityLevel();QualitySettings.SetQualityLevel(index,false);QualitySettings.renderPipeline=asset;QualitySettings.SetQualityLevel(previous,false);}
  [MenuItem("Island/Diorama/Restore previous pipeline")]
  public static void RestorePipeline(){string key=Key+Application.dataPath;if(!EditorPrefs.HasKey(key))return;GraphicsSettings.defaultRenderPipeline=AssetDatabase.LoadAssetAtPath<RenderPipelineAsset>(EditorPrefs.GetString(key));var q=EditorPrefs.GetString(key+"/quality").Split('|');for(int i=0;i<q.Length&&i<QualitySettings.names.Length;i++)SetQualityPipeline(i,AssetDatabase.LoadAssetAtPath<RenderPipelineAsset>(q[i]));AssetDatabase.SaveAssets();}
 }
}
