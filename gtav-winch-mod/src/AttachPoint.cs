using System;
using GTA;
using GTA.Math;
using GTA.Native;

namespace WinchMod
{
    /// <summary>
    /// One end of a winch line. Every end is backed by a real entity so the rope
    /// natives and the solver only ever deal with one case; a point on the map gets
    /// an invisible frozen prop as its anchor.
    /// </summary>
    internal class AttachPoint
    {
        public Entity Entity;
        public Vector3 LocalOffset;
        public bool IsAnchor;          // immovable end: infinite mass
        public bool OwnsAnchorProp;    // we spawned the entity and must clean it up
        public bool MadePersistent;    // we pinned it so the game would not despawn it
        public float Mass = 1f;
        public string BoneName = string.Empty;

        public bool IsValid
        {
            get { return Entity != null && Entity.Exists(); }
        }

        public float InverseMass
        {
            get { return IsAnchor || Mass <= 0f ? 0f : 1f / Mass; }
        }

        public Vector3 WorldPosition
        {
            get { return IsValid ? PhysUtil.LocalToWorld(Entity, LocalOffset) : Vector3.Zero; }
        }

        public Vector3 Velocity
        {
            get { return IsAnchor || !IsValid ? Vector3.Zero : Entity.Velocity; }
        }

        public string Describe()
        {
            if (!IsValid) return "gone";
            if (IsAnchor) return "anchor";
            Vehicle v = Entity as Vehicle;
            if (v != null) return v.DisplayName;
            if (Entity is Ped) return "ped";
            return "object";
        }

        public static AttachPoint OnEntity(Entity entity, Vector3 worldPoint, bool anchor)
        {
            AttachPoint p = new AttachPoint();
            p.Entity = entity;
            p.LocalOffset = PhysUtil.WorldToLocal(entity, worldPoint);
            p.IsAnchor = anchor;
            p.Mass = anchor ? 0f : PhysUtil.EstimateMass(entity);
            return p;
        }

        /// <summary>Pins a point on the map by parking an invisible frozen prop there.</summary>
        public static AttachPoint OnWorld(Vector3 worldPoint)
        {
            Model model = new Model("prop_paper_bag_01");
            model.Request(1500);
            if (!model.IsLoaded)
                return null;

            Prop prop = World.CreateProp(model, worldPoint, false, false);
            model.MarkAsNoLongerNeeded();
            if (prop == null || !prop.Exists())
                return null;

            prop.IsVisible = false;
            prop.IsCollisionEnabled = false;
            prop.IsPositionFrozen = true;
            Function.Call(Hash.SET_ENTITY_INVINCIBLE, prop.Handle, true);

            AttachPoint p = new AttachPoint();
            p.Entity = prop;
            p.LocalOffset = Vector3.Zero;
            p.IsAnchor = true;
            p.OwnsAnchorProp = true;
            p.Mass = 0f;
            return p;
        }

        /// <summary>
        /// Applies a rope impulse. The linear part goes straight into velocity so the
        /// constraint is guaranteed to hold, and a configurable share is routed through
        /// APPLY_FORCE_TO_ENTITY at the attach offset so the load rotates naturally.
        /// </summary>
        public void ApplyImpulse(Vector3 impulse)
        {
            if (IsAnchor || !IsValid)
                return;

            Vector3 deltaV = PhysUtil.ClampLength(impulse * InverseMass, Config.MaxDeltaV);
            if (deltaV.LengthSquared() < 0.000001f)
                return;

            PhysUtil.ActivatePhysics(Entity);

            float share = Config.TorqueAssist;
            if (share < 1f)
                Entity.Velocity = Entity.Velocity + deltaV * (1f - share);
            if (share > 0f)
                PhysUtil.ApplyOffsetImpulse(Entity, deltaV * share, LocalOffset);
        }

        /// <summary>
        /// Stops the game from streaming a roped vehicle or ped out from under you the
        /// moment you drive away from where you hooked it.
        /// </summary>
        public void EnsurePersistent()
        {
            if (IsAnchor || !IsValid || OwnsAnchorProp || Entity.IsPersistent)
                return;
            if (Entity is Ped && Entity.Handle == Game.Player.Character.Handle)
                return;

            Entity.IsPersistent = true;
            MadePersistent = true;
        }

        /// <summary>A towed car with its handbrake on drags on locked wheels.</summary>
        public void PrepareForTow()
        {
            if (IsAnchor || !IsValid)
                return;

            Vehicle vehicle = Entity as Vehicle;
            if (vehicle != null && Config.ReleaseTowedHandbrake && vehicle.Driver == null)
                Function.Call(Hash.SET_VEHICLE_HANDBRAKE, vehicle.Handle, false);

            Ped ped = Entity as Ped;
            if (ped != null && Config.RagdollTowedPeds
                && ped.Handle != Game.Player.Character.Handle
                && !ped.IsInVehicle() && !ped.IsRagdoll)
            {
                Function.Call(Hash.SET_PED_TO_RAGDOLL, ped.Handle, 1500, 1500, 0, true, true, false);
            }
        }

        public void Cleanup()
        {
            if (OwnsAnchorProp && Entity != null && Entity.Exists())
            {
                Entity.Delete();
                return;
            }

            if (MadePersistent && Entity != null && Entity.Exists())
            {
                Entity.MarkAsNoLongerNeeded();
                MadePersistent = false;
            }
        }
    }
}
