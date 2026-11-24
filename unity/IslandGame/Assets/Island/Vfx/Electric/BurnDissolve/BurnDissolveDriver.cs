using UnityEngine;

namespace IslandVfx
{
    // Hidden play-mode object created by BurnDissolve.Play; advances every active run once per frame.
    [DisallowMultipleComponent]
    public sealed class BurnDissolveDriver : MonoBehaviour
    {
        void LateUpdate() { BurnDissolve.TickAll(); }
    }
}
