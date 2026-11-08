using System;using UnityEditor;using UnityEditor.SceneManagement;using UnityEngine;
public static class ValidateMountScenes {
 public static object Run(){int missing=0,roots=0;for(int i=1;i<=10;i++){var scene=EditorSceneManager.OpenScene("Assets/Island/MountRuntime/Scenes/MountZone"+i.ToString("00")+".unity");foreach(var root in scene.GetRootGameObjects()){if(root.GetComponent<IslandGame.MountZoneEnvironment>())roots++;foreach(var t in root.GetComponentsInChildren<Transform>(true))missing+=GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(t.gameObject);}}EditorSceneManager.OpenScene("Assets/Island/Scenes/Island.unity");if(missing!=0||roots!=10)throw new Exception("Scene validation: missing="+missing+" markers="+roots);return new{missing,zoneRoots=roots};}
}
