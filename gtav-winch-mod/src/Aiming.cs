using System;
using System.Collections.Generic;
using GTA;
using GTA.Math;
using GTA.Native;

namespace WinchMod
{
    /// <summary>Turns where the player is looking into an attach point, and picks ropes to cut.</summary>
    internal static class Aiming
    {
        // Bones worth snapping to when you aim near them, so hooking a tow truck or a
        // bumper lands on the hook instead of half a metre of bodywork next to it.
        private static readonly string[] HookBones =
        {
            "hook", "tow_hook", "tow_arm", "attach_female", "attach_male",
            "bumper_f", "bumper_r", "chassis_dummy"
        };

        /// <summary>Result of a shape test, kept independent of the SHVDN raycast wrapper.</summary>
        internal struct Hit
        {
            public bool DidHit;
            public Vector3 Position;
            public Entity Entity;
        }

        /// <summary>
        /// Straight to the shape-test natives rather than the wrapper, so the probe flags
        /// and the ignored entity are exactly what we want.
        /// </summary>
        public static Hit AimRay()
        {
            Vector3 origin = GameplayCamera.Position;
            Vector3 target = origin + GameplayCamera.Direction * Config.AimRange;

            int probe = Function.Call<int>(Hash.START_EXPENSIVE_SYNCHRONOUS_SHAPE_TEST_LOS_PROBE,
                origin.X, origin.Y, origin.Z,
                target.X, target.Y, target.Z,
                -1,                                  // hit everything
                Game.Player.Character.Handle,        // but not the player
                7);

            OutputArgument oHit = new OutputArgument();
            OutputArgument oPos = new OutputArgument();
            OutputArgument oNormal = new OutputArgument();
            OutputArgument oEntity = new OutputArgument();
            Function.Call<int>(Hash.GET_SHAPE_TEST_RESULT, probe, oHit, oPos, oNormal, oEntity);

            Hit hit = new Hit();
            hit.DidHit = oHit.GetResult<bool>();
            hit.Position = oPos.GetResult<Vector3>();

            int handle = oEntity.GetResult<int>();
            if (handle != 0)
                hit.Entity = Entity.FromHandle(handle);

            return hit;
        }

        /// <summary>Builds an attach point from whatever the player is looking at, or null.</summary>
        public static AttachPoint PickAttachPoint(out string label)
        {
            label = string.Empty;
            Hit hit = AimRay();
            if (!hit.DidHit)
                return null;

            Vector3 point = hit.Position;
            Entity entity = hit.Entity;

            if (entity != null && entity.Exists())
            {
                Vehicle vehicle = entity as Vehicle;
                if (vehicle != null && Config.SnapToHooks)
                    point = SnapToHook(vehicle, point);

                bool anchor = entity is Prop && Config.TreatPropsAsAnchors;
                AttachPoint p = AttachPoint.OnEntity(entity, point, anchor);
                label = anchor ? "fixed object" : p.Describe();
                return p;
            }

            AttachPoint world = AttachPoint.OnWorld(point);
            label = "world anchor";
            return world;
        }

        private static Vector3 SnapToHook(Vehicle vehicle, Vector3 point)
        {
            float best = Config.SnapToHookDistance;
            Vector3 result = point;

            for (int i = 0; i < HookBones.Length; i++)
            {
                int bone = Function.Call<int>(Hash.GET_ENTITY_BONE_INDEX_BY_NAME, vehicle.Handle, HookBones[i]);
                if (bone == -1)
                    continue;

                Vector3 bonePos = Function.Call<Vector3>(Hash.GET_WORLD_POSITION_OF_ENTITY_BONE, vehicle.Handle, bone);
                float d = (bonePos - point).Length();
                if (d < best)
                {
                    best = d;
                    result = bonePos;
                }
            }
            return result;
        }

        /// <summary>
        /// The rope the player is looking at. Falls back to the nearest rope within arm's
        /// reach so you can also just walk up to a line and cut it.
        /// </summary>
        public static WinchLine PickLine(List<WinchLine> lines)
        {
            Vector3 origin = GameplayCamera.Position;
            Vector3 dir = GameplayCamera.Direction;

            WinchLine best = null;
            float bestDist = Config.CutPickDistance;

            for (int i = 0; i < lines.Count; i++)
            {
                WinchLine line = lines[i];
                if (!line.EndsAlive) continue;

                float d = PhysUtil.RayToSegmentDistance(origin, dir, line.A.WorldPosition, line.B.WorldPosition);
                if (d < bestDist)
                {
                    bestDist = d;
                    best = line;
                }
            }
            if (best != null)
                return best;

            Vector3 player = Game.Player.Character.Position;
            float nearest = 3.5f;
            for (int i = 0; i < lines.Count; i++)
            {
                WinchLine line = lines[i];
                if (!line.EndsAlive) continue;

                Vector3 mid = (line.A.WorldPosition + line.B.WorldPosition) * 0.5f;
                float d = (mid - player).Length();
                if (d < nearest)
                {
                    nearest = d;
                    best = line;
                }
            }
            return best;
        }
    }
}
