using System;
using UnityEngine;

namespace MountSunday {
    [Serializable] public sealed class StageManifest {
        public int schemaVersion;
        public string stageId;
        public StageAsset[] assets;
        public StageInstance[] instances;
        public StageWaypoint[] route;
        public StageOrigin origin;
        public StageBounds bounds;
        public StageMaterial[] materialColors;
    }
    [Serializable] public sealed class StageAsset {
        public string id, modelPath, colliderMode, category;
    }
    [Serializable] public sealed class StageInstance {
        public string assetId, name;
        public float[] position, rotation, scale;
    }
    [Serializable] public sealed class StageWaypoint {
        public string name;
        public float[] position;
    }
    [Serializable] public sealed class StageOrigin {
        public double latitude, longitude, baseElevation;
        public string crs;
    }
    [Serializable] public sealed class StageBounds {
        public float sizeX, sizeZ;
    }
    [Serializable] public sealed class StageMaterial {
        public string name;
        public float[] color;
        public float roughness = 0.8f;
        public string baseColorTexture;
        public string normalTexture;
    }

    public static class StageVectors {
        public static Vector3 Read(float[] value, Vector3 fallback) {
            return value != null && value.Length >= 3
                ? new Vector3(value[0], value[1], value[2]) : fallback;
        }
        public static bool Finite(float[] value, int count = 3) {
            if (value == null || value.Length < count) return false;
            for (int i = 0; i < count; i++)
                if (float.IsNaN(value[i]) || float.IsInfinity(value[i])) return false;
            return true;
        }
    }
}
