using System;using System.Linq;using UnityEditor;using UnityEditor.SceneManagement;using UnityEngine;
public static class SetupMountBuild {
 public static string Run(){var scenes=EditorBuildSettings.scenes.Where(s=>!s.path.Contains("/MountRuntime/Scenes/")).ToList();for(int i=1;i<=10;i++)scenes.Add(new EditorBuildSettingsScene("Assets/Island/MountRuntime/Scenes/MountZone"+i.ToString("00")+".unity",true));EditorBuildSettings.scenes=scenes.ToArray();EditorSceneManager.OpenScene("Assets/Island/Scenes/Island.unity");return "Registered ten additive scenes; main game scene opened";}
}
