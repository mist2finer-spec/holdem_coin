using UnityEngine;

namespace RuneBeamFX
{
    // Attach this to the object with the Animator when the VFX prefab is a child.
    public sealed class RuneBeamTrigger : MonoBehaviour
    {
        [SerializeField] RuneBeam effect;
        public void CastRuneBeam() { if (effect != null) effect.Play(); }
    }
}
