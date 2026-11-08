using System;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace MountSunday.Editor {
    // Uses a real FBX exported with the same settings as every stage model.
    // Expected contract: Blender east/north/up -> Unity +X/-Z/+Y, in metres.
    public static class MountSundayAxisCalibration {
        public const string AssetPath = "Assets/MountSunday/Models/AxisCalibration.fbx";

        [Serializable] public sealed class Result {
            public Vector3 observedOrigin, observedEast, observedNorth, observedUp;
            public Vector3 correctionPosition, correctionScale;
            public Quaternion correctionRotation;
            public float maximumCorrectedError;
            public bool handednessCorrection;
            public void Apply(Transform transform) {
                transform.localPosition = correctionPosition;
                transform.localRotation = correctionRotation;
                transform.localScale = correctionScale;
            }
        }

        [MenuItem("Tools/Mount Sunday/Validate Coordinate Import")]
        public static void ValidateCoordinateImport() {
            Result result = Read();
            Debug.Log("Mount Sunday imported FBX axis calibration:\n" + JsonUtility.ToJson(result, true)
                + "\nCorrection is applied to model geometry only. Manifest positions and rotations stay in Unity coordinates.");
        }

        public static Result Read() {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(AssetPath);
            if (!model) throw new InvalidOperationException("Missing coordinate calibration FBX: " + AssetPath + ". Copy the complete package before building.");
            Scene preview = EditorSceneManager.NewPreviewScene();
            GameObject instance = null;
            try {
                instance = UnityEngine.Object.Instantiate(model);
                SceneManager.MoveGameObjectToScene(instance, preview);
                var renderers = instance.GetComponentsInChildren<Renderer>(true);
                Vector3 Marker(string name) {
                    var matches = renderers.Where(r => r.name == name).ToArray();
                    if (matches.Length != 1) throw new InvalidOperationException("Calibration requires exactly one mesh named " + name + "; found " + matches.Length + ".");
                    return matches[0].bounds.center;
                }
                Vector3 origin = Marker("AXIS_ORIGIN");
                Vector3 east = Marker("AXIS_EAST") - origin;
                Vector3 north = Marker("AXIS_NORTH") - origin;
                Vector3 up = Marker("AXIS_UP") - origin;
                float[] lengths = { east.magnitude, north.magnitude, up.magnitude };
                if (lengths.Any(v => float.IsNaN(v) || float.IsInfinity(v) || v < 1e-6f || v > 1e6f))
                    throw new InvalidOperationException("Calibration has invalid/zero axis lengths.");
                if (Mathf.Max(Mathf.Abs(Vector3.Dot(east.normalized, north.normalized)), Mathf.Abs(Vector3.Dot(east.normalized, up.normalized)), Mathf.Abs(Vector3.Dot(north.normalized, up.normalized))) > .0002f)
                    throw new InvalidOperationException("Imported calibration axes contain shear. Automatic TRS correction is unsafe; inspect FBX importer/export settings.");
                var observed = Matrix4x4.identity;
                observed.SetColumn(0, new Vector4(east.x, east.y, east.z, 0));
                observed.SetColumn(1, new Vector4(north.x, north.y, north.z, 0));
                observed.SetColumn(2, new Vector4(up.x, up.y, up.z, 0));
                if (Mathf.Abs(observed.determinant) < 1e-15f) throw new InvalidOperationException("Singular FBX calibration basis.");
                var desired = Matrix4x4.identity;
                desired.SetColumn(0, new Vector4(1, 0, 0, 0));
                desired.SetColumn(1, new Vector4(0, 0, -1, 0));
                desired.SetColumn(2, new Vector4(0, 1, 0, 0));
                Matrix4x4 correction = desired * observed.inverse;
                Vector3 x = correction.GetColumn(0), y = correction.GetColumn(1), z = correction.GetColumn(2);
                Vector3 scale = new Vector3(x.magnitude * (correction.determinant < 0 ? -1 : 1), y.magnitude, z.magnitude);
                Quaternion rotation = Quaternion.LookRotation(z / scale.z, y / scale.y);
                Vector3 position = -correction.MultiplyVector(origin);
                Matrix4x4 applied = Matrix4x4.TRS(position, rotation, scale);
                float error = Mathf.Max(
                    applied.MultiplyPoint3x4(origin).magnitude,
                    (applied.MultiplyPoint3x4(origin + east) - Vector3.right).magnitude,
                    (applied.MultiplyPoint3x4(origin + north) - Vector3.back).magnitude,
                    (applied.MultiplyPoint3x4(origin + up) - Vector3.up).magnitude);
                if (float.IsNaN(error) || float.IsInfinity(error) || error > .0005f)
                    throw new InvalidOperationException("FBX calibration could not be represented as position/rotation/signed scale. Error: " + error + " metres.");
                return new Result {
                    observedOrigin = origin, observedEast = east, observedNorth = north, observedUp = up,
                    correctionPosition = position, correctionRotation = rotation, correctionScale = scale,
                    maximumCorrectedError = error, handednessCorrection = correction.determinant < 0
                };
            } finally {
                if (instance) UnityEngine.Object.DestroyImmediate(instance);
                EditorSceneManager.ClosePreviewScene(preview);
            }
        }
    }
}
