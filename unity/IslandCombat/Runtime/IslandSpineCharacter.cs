using System;
using Spine;
using Spine.Unity;
using UnityEngine;
using UnityEngine.Events;

namespace IslandCombat {
    // Visual adapter only. The game's controller owns collision, HP and damage.
    [RequireComponent(typeof(SkeletonAnimation))]
    public sealed class IslandSpineCharacter : MonoBehaviour {
        [SerializeField] SkeletonAnimation skeletonAnimation;
        [SerializeField] UnityEvent<int> contact = new UnityEvent<int>();
        public UnityEvent<int> Contact => contact;
        Spine.AnimationState subscribedState;
        bool moving;
        float facing = 1f;

        void Awake() {
            if (!skeletonAnimation) skeletonAnimation = GetComponent<SkeletonAnimation>();
            skeletonAnimation.Initialize(false);
            BindEvents();
        }
        void OnEnable() { if (skeletonAnimation) BindEvents(); }
        void OnDisable() { UnbindEvents(); }
        void OnDestroy() { UnbindEvents(); }
        void UnbindEvents() { if (subscribedState != null) subscribedState.Event -= OnSpineEvent; subscribedState = null; }
        void BindEvents() {
            if (skeletonAnimation.AnimationState == subscribedState) return;
            UnbindEvents(); subscribedState = skeletonAnimation.AnimationState;
            if (subscribedState != null) subscribedState.Event += OnSpineEvent;
        }
        void OnSpineEvent(TrackEntry entry, Spine.Event e) {
            if (e.Data.Name == "contact") contact.Invoke(e.Int);
        }
        public void SetCharacter(SkeletonDataAsset data) {
            if (!data) throw new ArgumentNullException(nameof(data));
            if (!skeletonAnimation) skeletonAnimation = GetComponent<SkeletonAnimation>();
            UnbindEvents(); skeletonAnimation.skeletonDataAsset = data;
            skeletonAnimation.Initialize(true); BindEvents();
            skeletonAnimation.Skeleton.ScaleX = facing;
            SetLocomotion(moving ? facing : 0f);
        }
        bool Has(string clip) => skeletonAnimation && skeletonAnimation.Skeleton != null && skeletonAnimation.Skeleton.Data.FindAnimation(clip) != null;
        void Play(string clip, bool loop) {
            if (!Has(clip)) return;
            var current = skeletonAnimation.AnimationState.GetCurrent(0);
            if (loop && current != null && current.Animation.Name == clip) return;
            skeletonAnimation.AnimationState.SetAnimation(0, clip, loop);
        }
        public void SetLocomotion(float horizontal) {
            moving = Mathf.Abs(horizontal) > .01f;
            if (moving) facing = Mathf.Sign(horizontal);
            if (skeletonAnimation && skeletonAnimation.Skeleton != null) skeletonAnimation.Skeleton.ScaleX = facing;
            var current = skeletonAnimation.AnimationState.GetCurrent(0);
            if (current != null && !current.Loop && !current.IsComplete) return;
            Play(moving ? "run1" : "stay1", true);
        }
        public void PlayAttack(int comboStage) {
            if (comboStage < 1 || comboStage > 5) throw new ArgumentOutOfRangeException(nameof(comboStage));
            PlayAction("attack" + comboStage);
        }
        public void PlayAction(string clip) {
            if (!Has(clip)) throw new ArgumentException("Unknown Spine animation: " + clip, nameof(clip));
            Play(clip, false);
            if (clip != "die1") skeletonAnimation.AnimationState.AddAnimation(0, moving ? "run1" : "stay1", true, 0);
        }
    }
}
