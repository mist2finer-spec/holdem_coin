using UnityEditor;
using System;
using System.IO;
using UnityEngine;

namespace MountSunday.Editor {
    sealed class MountSundayModelImport : AssetPostprocessor {
        void OnPreprocessModel() {
            if (!assetPath.StartsWith("Assets/MountSunday/Models/", System.StringComparison.Ordinal)) return;
            var importer = (ModelImporter)assetImporter;
            importer.globalScale = 1f;
            importer.useFileScale = true;
            importer.importAnimation = false;
            importer.importCameras = false;
            importer.importLights = false;
            importer.addCollider = false;
            // Keep a CPU copy only for meshes that the manifest uses for collision.
            // Signed-scale/parent-transform corrections can require mesh recooking.
            importer.isReadable = RequiresReadableMesh(assetPath);
            importer.importNormals = ModelImporterNormals.Import;
            importer.importTangents = ModelImporterTangents.CalculateMikk;
            importer.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
            importer.optimizeMeshPolygons = true;
            importer.optimizeMeshVertices = true;
        }

        internal static bool RequiresReadableMesh(string path) {
            const string manifestPath = "Assets/MountSunday/Data/stage.json";
            if (path == MountSundayAxisCalibration.AssetPath) return false;
            if (!File.Exists(manifestPath)) return true;
            try {
                var manifest = JsonUtility.FromJson<StageManifest>(File.ReadAllText(manifestPath));
                foreach (var asset in manifest.assets ?? Array.Empty<StageAsset>())
                    if (asset != null && string.Equals(asset.modelPath, path, StringComparison.Ordinal)) return asset.colliderMode == "mesh";
            } catch (Exception) {
                // Build preflight reports a malformed manifest. Until then, retain
                // the data rather than silently creating unusable collision meshes.
                return true;
            }
            return true;
        }
    }
}
