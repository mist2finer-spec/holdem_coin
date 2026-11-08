using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace MountSunday {
    [DisallowMultipleComponent]
    public sealed class MountSundayFreeFlight : MonoBehaviour {
        public float movementSpeed = 28f;
        public float boostMultiplier = 4f;
        public float mouseSensitivity = 0.12f;
        public float walkingSpeed = 5.5f;
        public bool flyMode;
        public Transform viewTransform;
        public MountSundayRoute route;
        float yaw, pitch;
        float verticalVelocity;
        CharacterController controller;
        int waypointIndex;
        bool captured;
        void OnEnable() {
            controller = GetComponent<CharacterController>();
            if (!viewTransform) viewTransform = transform;
            yaw = transform.eulerAngles.y;
            pitch = Mathf.DeltaAngle(0f, viewTransform.localEulerAngles.x);
            if (controller) controller.enabled = !flyMode;
        }
        void OnDisable() { ReleaseCursor(); }
        void OnApplicationFocus(bool focused) { if (!focused) ReleaseCursor(); }
        void ReleaseCursor() {
            if (!captured) return;
            captured = false;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }
        void Update() {
            Vector3 move = Vector3.zero;
            Vector2 look = Vector2.zero;
            bool boost = false, lookHeld = false, escape = false, nextPoint = false, toggleMode = false;
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            var m = Mouse.current;
            if (k != null) {
                move.x = (k.dKey.isPressed ? 1 : 0) - (k.aKey.isPressed ? 1 : 0);
                move.z = (k.wKey.isPressed ? 1 : 0) - (k.sKey.isPressed ? 1 : 0);
                move.y = (k.eKey.isPressed ? 1 : 0) - (k.qKey.isPressed ? 1 : 0);
                boost = k.leftShiftKey.isPressed || k.rightShiftKey.isPressed;
                escape = k.escapeKey.wasPressedThisFrame;
                nextPoint = k.nKey.wasPressedThisFrame;
                toggleMode = k.tabKey.wasPressedThisFrame;
            }
            if (m != null) { lookHeld = m.rightButton.isPressed; look = m.delta.ReadValue(); }
#elif ENABLE_LEGACY_INPUT_MANAGER
            move.x = (Input.GetKey(KeyCode.D) ? 1 : 0) - (Input.GetKey(KeyCode.A) ? 1 : 0);
            move.z = (Input.GetKey(KeyCode.W) ? 1 : 0) - (Input.GetKey(KeyCode.S) ? 1 : 0);
            move.y = (Input.GetKey(KeyCode.E) ? 1 : 0) - (Input.GetKey(KeyCode.Q) ? 1 : 0);
            boost = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            escape = Input.GetKeyDown(KeyCode.Escape);
            nextPoint = Input.GetKeyDown(KeyCode.N);
            toggleMode = Input.GetKeyDown(KeyCode.Tab);
            lookHeld = Input.GetMouseButton(1);
            // Legacy mouse axes use different units from the Input System pixel delta.
            look = new Vector2(Input.GetAxisRaw("Mouse X"), Input.GetAxisRaw("Mouse Y")) * 12f;
#endif
            if (escape) { ReleaseCursor(); lookHeld = false; }
            if (toggleMode) {
                flyMode = !flyMode;
                verticalVelocity = 0f;
                if (controller) controller.enabled = !flyMode;
            }
            if (lookHeld) {
                if (!captured) { captured = true; Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }
                yaw += look.x * mouseSensitivity;
                pitch = Mathf.Clamp(pitch - look.y * mouseSensitivity, -85f, 85f);
                if (viewTransform != transform) {
                    transform.rotation = Quaternion.Euler(0f, yaw, 0f);
                    viewTransform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
                } else transform.rotation = Quaternion.Euler(pitch, yaw, 0f);
            } else ReleaseCursor();
            float dt = Mathf.Min(Time.unscaledDeltaTime, 0.05f);
            if (flyMode || !controller) {
                Vector3 direction = viewTransform.right * move.x + viewTransform.forward * move.z + Vector3.up * move.y;
                transform.position += Vector3.ClampMagnitude(direction, 1f) * movementSpeed * (boost ? boostMultiplier : 1f) * dt;
            } else {
                Vector3 direction = transform.right * move.x + transform.forward * move.z;
                direction.y = 0f;
                if (controller.isGrounded && verticalVelocity < 0f) verticalVelocity = -2f;
                verticalVelocity = Mathf.Max(-45f, verticalVelocity - 20f * dt);
                controller.Move((Vector3.ClampMagnitude(direction, 1f) * walkingSpeed * (boost ? 1.8f : 1f) + Vector3.up * verticalVelocity) * dt);
            }
            if (nextPoint && route && route.waypoints != null && route.waypoints.Length > 0) {
                Transform point = route.waypoints[waypointIndex++ % route.waypoints.Length];
                if (point) {
                    if (controller) controller.enabled = false;
                    transform.position = point.position + Vector3.up * .5f;
                    verticalVelocity = 0f;
                    if (controller) controller.enabled = !flyMode;
                }
            }
        }
    }
}
