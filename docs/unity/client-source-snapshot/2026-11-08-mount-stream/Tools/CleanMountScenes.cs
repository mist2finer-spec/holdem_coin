using System;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;using IslandGame;
public static class CleanMountScenes {
 public static string Run(){int removed=0;for(int i=1;i<=10;i++){var scene=EditorSceneManager.OpenScene("Assets/Island/MountRuntime/Scenes/MountZone"+i.ToString("00")+".unity");foreach(var root in scene.GetRootGameObjects())foreach(var t in root.GetComponentsInChildren<Transform>(true)){foreach(var c in t.GetComponents<BattleOccluder>()){UnityEngine.Object.DestroyImmediate(c);removed++;}removed+=GameObjectUtility.RemoveMonoBehavioursWithMissingScript(t.gameObject);}EditorSceneManager.SaveScene(scene);}EditorSceneManager.OpenScene("Assets/Island/Scenes/Island.unity");return "Removed serialized runtime-only occluders/missing scripts: "+removed;}
}
