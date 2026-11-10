using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace MountSunday.Review {
 public static class ReviewSetup {
  public const string Root="Assets/MountSunday/Review";
  public static void Setup() {
   Directory.CreateDirectory(Root); AssetDatabase.Refresh();
   var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();
   AssetDatabase.CreateAsset(renderer,Root+"/ReviewRenderer.asset");
   var pipeline=ScriptableObject.CreateInstance<UniversalRenderPipelineAsset>();
   AssetDatabase.CreateAsset(pipeline,Root+"/ReviewURP.asset");
   var so=new SerializedObject(pipeline);var list=so.FindProperty("m_RendererDataList");list.arraySize=1;list.GetArrayElementAtIndex(0).objectReferenceValue=renderer;so.ApplyModifiedPropertiesWithoutUndo();
   pipeline.supportsHDR=true;pipeline.msaaSampleCount=2;pipeline.renderScale=1;pipeline.shadowDistance=100;pipeline.shadowCascadeCount=2;pipeline.supportsCameraDepthTexture=false;pipeline.supportsCameraOpaqueTexture=false;
   GraphicsSettings.defaultRenderPipeline=pipeline;
   for(int i=0;i<QualitySettings.names.Length;i++){QualitySettings.SetQualityLevel(i,false);QualitySettings.renderPipeline=pipeline;QualitySettings.vSyncCount=0;QualitySettings.lodBias=1;QualitySettings.maximumLODLevel=0;}
   PlayerSettings.colorSpace=ColorSpace.Linear;PlayerSettings.companyName="mist2finer";PlayerSettings.productName="Mount Sunday Review";PlayerSettings.bundleVersion="0.1.0-review.20261107";
   PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android,"com.mist2finer.mountsunday.review");PlayerSettings.Android.bundleVersionCode=2026110701;
   PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android,ScriptingImplementation.IL2CPP);PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
   PlayerSettings.defaultInterfaceOrientation=UIOrientation.LandscapeLeft;PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android,false);PlayerSettings.SetGraphicsAPIs(BuildTarget.Android,new[]{GraphicsDeviceType.OpenGLES3});PlayerSettings.enableFrameTimingStats=true;
   AssetDatabase.SaveAssets();Debug.Log("Review URP configured independently of IslandGame.");
  }
  public static void OpenBaseline(){EditorSceneManager.OpenScene("Assets/MountSunday/Generated/Scenes/MountSunday_Exploration.unity");EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),Root+"/MountSunday_Baseline.unity");}
  public static object Inspect(){
   var all=UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None);
   return new {renderers=all.Length,lodGroups=UnityEngine.Object.FindObjectsByType<LODGroup>(FindObjectsSortMode.None).Length, colliders=UnityEngine.Object.FindObjectsByType<Collider>(FindObjectsSortMode.None).Length, shaderErrors=ShaderUtil.GetShaderMessages(Shader.Find("MountSunday/Environment")).Select(x=>new{x.message,severity=x.severity.ToString()}).ToArray(), pipeline=GraphicsSettings.currentRenderPipeline.name};
  }
  public static void GameSize(){
   var asm=typeof(UnityEditor.Editor).Assembly;var t=asm.GetType("UnityEditor.GameView");var gv=EditorWindow.GetWindow(t);var sizes=asm.GetType("UnityEditor.GameViewSizes");var singleton=typeof(ScriptableSingleton<>).MakeGenericType(sizes);var inst=singleton.GetProperty("instance").GetValue(null);var group=sizes.GetMethod("GetGroup").Invoke(inst,new object[]{Enum.Parse(asm.GetType("UnityEditor.GameViewSizeGroupType"),"Android")});
   var sizeType=asm.GetType("UnityEditor.GameViewSize");var enumType=asm.GetType("UnityEditor.GameViewSizeType");var size=Activator.CreateInstance(sizeType,System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Public,null,new object[]{Enum.ToObject(enumType,1),1280,720,"MountSunday 1280x720"},null);group.GetType().GetMethod("AddCustomSize").Invoke(group,new[]{size});var count=(int)group.GetType().GetMethod("GetTotalCount").Invoke(group,null);t.GetProperty("selectedSizeIndex",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.Public|System.Reflection.BindingFlags.NonPublic).SetValue(gv,count-1);gv.Focus();
  }
 }
}
