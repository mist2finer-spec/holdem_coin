using UnityEngine;

namespace EmberSlashFX
{
    // Attach this to the object with the Animator when the VFX prefab is a child.
    public sealed class EmberSlashTrigger : MonoBehaviour
    {
        [SerializeField] EmberSlash effect;
        public void Slash() { if (effect != null) effect.Play(); }
        public void SlashMirrored() { if (effect != null) effect.PlayMirrored(); }
    }
}
