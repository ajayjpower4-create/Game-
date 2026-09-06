using System;
using GTA;
using GTA.Math;
using GTA.Native;

namespace WinchMod
{
    internal enum BedState
    {
        Free,
        Settling,
        Locked
    }

    /// <summary>
    /// Straps a winched vehicle down to the bed of a tow truck or flatbed.
    /// Instead of teleporting the load into place, it attaches with the pose the load
    /// already has and then glides that pose to the resting pose over a few frames, so
    /// the latch reads as the car settling onto the deck rather than snapping to a grid.
    /// </summary>
    internal class BedLock
    {
        public BedState State = BedState.Free;
        public Vehicle Carrier;
        public Vehicle Load;

        private Vector3 _fromOffset, _toOffset;
        private Vector3 _fromRot, _toRot;
        private float _settle;

        public bool Engaged { get { return State != BedState.Free; } }

        public static bool IsCarrier(Vehicle v)
        {
            if (v == null || !v.Exists())
                return false;
            if (Config.AnyVehicleCanCarry)
                return true;

            int model = v.Model.Hash;
            for (int i = 0; i < Config.CarrierModels.Length; i++)
            {
                string name = Config.CarrierModels[i];
                if (string.IsNullOrEmpty(name))
                    continue;
                if (model == Game.GenerateHash(name))
                    return true;
            }
            return false;
        }

        /// <summary>Bed volume in the carrier's local space.</summary>
        private static void BedBounds(Vehicle carrier, out float floorZ, out float yMin, out float yMax, out float halfWidth)
        {
            Vector3 min, max;
            PhysUtil.GetModelDimensions(carrier.Model, out min, out max);
            floorZ = min.Z + Config.BedFloorHeight;
            float length = max.Y - min.Y;
            yMin = min.Y + 0.25f;
            yMax = min.Y + length * Config.BedLengthFraction;
            halfWidth = (max.X - min.X) * 0.5f + Config.BedSideTolerance;
        }

        public static bool LoadIsOverBed(Vehicle carrier, Vehicle load)
        {
            float floorZ, yMin, yMax, halfWidth;
            BedBounds(carrier, out floorZ, out yMin, out yMax, out halfWidth);

            Vector3 local = PhysUtil.WorldToLocal(carrier, load.Position);
            if (local.Y < yMin || local.Y > yMax) return false;
            if (Math.Abs(local.X) > halfWidth) return false;
            if (local.Z < floorZ - 0.7f || local.Z > floorZ + 2.5f) return false;
            return true;
        }

        public bool CanEngage(Vehicle carrier, Vehicle load)
        {
            if (!Config.BedLockEnabled || carrier == null || load == null) return false;
            if (!carrier.Exists() || !load.Exists()) return false;
            if (carrier == load) return false;
            if (!IsCarrier(carrier)) return false;
            if (load.Driver != null && load.Driver == Game.Player.Character) return false;
            return LoadIsOverBed(carrier, load);
        }

        public bool AutoCanEngage(Vehicle carrier, Vehicle load)
        {
            if (!CanEngage(carrier, load)) return false;
            float relSpeed = (load.Velocity - carrier.Velocity).Length();
            return relSpeed <= Config.BedLockSpeed;
        }

        public void Engage(Vehicle carrier, Vehicle load)
        {
            Carrier = carrier;
            Load = load;

            float floorZ, yMin, yMax, halfWidth;
            BedBounds(carrier, out floorZ, out yMin, out yMax, out halfWidth);

            Vector3 min, max;
            PhysUtil.GetModelDimensions(load.Model, out min, out max);

            _fromOffset = PhysUtil.WorldToLocal(carrier, load.Position);
            _fromRot = new Vector3(0f, 0f, Normalize(load.Heading - carrier.Heading));

            float restY = PhysUtil.Clamp(_fromOffset.Y, yMin + (max.Y - min.Y) * 0.5f, yMax - 0.2f);
            _toOffset = new Vector3(0f, restY, floorZ - min.Z + 0.03f);
            _toRot = new Vector3(0f, 0f, Math.Abs(_fromRot.Z) > 90f ? 180f : 0f);

            _settle = 0f;
            State = BedState.Settling;

            load.IsPersistent = true;
            Apply(_fromOffset, _fromRot);
        }

        public void Update(float dt)
        {
            if (State == BedState.Free)
                return;

            if (Carrier == null || !Carrier.Exists() || Load == null || !Load.Exists())
            {
                State = BedState.Free;
                return;
            }

            if (State == BedState.Settling)
            {
                float duration = Math.Max(0.05f, Config.BedSettleTime);
                _settle += dt;
                float t = PhysUtil.Clamp(_settle / duration, 0f, 1f);
                t = t * t * (3f - 2f * t);                     // smoothstep, no visible pop

                Vector3 offset = Lerp(_fromOffset, _toOffset, t);
                Vector3 rot = new Vector3(
                    Lerp(_fromRot.X, _toRot.X, t),
                    Lerp(_fromRot.Y, _toRot.Y, t),
                    _fromRot.Z + Normalize(_toRot.Z - _fromRot.Z) * t);

                Apply(offset, rot);

                if (t >= 1f)
                    State = BedState.Locked;
            }
        }

        public void Release()
        {
            if (Load != null && Load.Exists())
            {
                Function.Call(Hash.DETACH_ENTITY, Load.Handle, true, true);
                if (Carrier != null && Carrier.Exists())
                    Load.Velocity = Carrier.Velocity;
                Load.IsPersistent = false;
            }
            State = BedState.Free;
            Carrier = null;
            Load = null;
        }

        private void Apply(Vector3 offset, Vector3 rot)
        {
            Function.Call(Hash.ATTACH_ENTITY_TO_ENTITY,
                Load.Handle, Carrier.Handle, -1,
                offset.X, offset.Y, offset.Z,
                rot.X, rot.Y, rot.Z,
                false,   // p9
                false,   // soft pinning
                false,   // collision between the two: off, otherwise the deck fights the load
                false,   // is ped
                2,       // vertex index
                true,    // fixed rotation
                0);
        }

        private static float Normalize(float degrees)
        {
            while (degrees > 180f) degrees -= 360f;
            while (degrees < -180f) degrees += 360f;
            return degrees;
        }

        private static float Lerp(float a, float b, float t) { return a + (b - a) * t; }

        private static Vector3 Lerp(Vector3 a, Vector3 b, float t)
        {
            return new Vector3(Lerp(a.X, b.X, t), Lerp(a.Y, b.Y, t), Lerp(a.Z, b.Z, t));
        }
    }
}
