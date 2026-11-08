using UnityEngine;

namespace MountSunday {
    public sealed class MountSundayRoute : MonoBehaviour {
        public StageOrigin origin;
        public string sourceManifest;
        public Transform[] waypoints;
        public Color routeColor = new Color(1f, 0.77f, 0.16f, 1f);
        [Tooltip("Designer route markers only. These do not change the server movement map.")]
        public bool drawRoute = true;
        void OnDrawGizmos() {
            if (!drawRoute || waypoints == null) return;
            Gizmos.color = routeColor;
            for (int i = 0; i < waypoints.Length; i++) {
                if (!waypoints[i]) continue;
                Gizmos.DrawWireSphere(waypoints[i].position, 2f);
                if (i > 0 && waypoints[i - 1]) Gizmos.DrawLine(waypoints[i - 1].position, waypoints[i].position);
            }
        }
    }
}
