using System;
using GTA;
using GTA.Math;
using GTA.Native;

namespace WinchMod
{
    /// <summary>Small physics helpers shared by the winch code.</summary>
    internal static class PhysUtil
    {
        public static void GetModelDimensions(Model model, out Vector3 min, out Vector3 max)
        {
            OutputArgument oMin = new OutputArgument();
            OutputArgument oMax = new OutputArgument();
            Function.Call(Hash.GET_MODEL_DIMENSIONS, model.Hash, oMin, oMax);
            min = oMin.GetResult<Vector3>();
            max = oMax.GetResult<Vector3>();
        }

        /// <summary>
        /// The game does not hand scripts a real mass, so we approximate one from the
        /// model's bounding volume. Only the ratio between the two ends matters to the
        /// solver, and a volume estimate gets that ratio close enough that a Kuruma
        /// tows like a Kuruma and a Phantom tows like a Phantom.
        /// </summary>
        public static float EstimateMass(Entity entity)
        {
            if (entity == null || !entity.Exists())
                return 1f;

            if (entity is Ped)
                return Math.Max(1f, Config.PedMass);

            Vector3 min, max;
            GetModelDimensions(entity.Model, out min, out max);
            Vector3 size = max - min;
            float volume = Math.Abs(size.X * size.Y * size.Z);

            if (entity is Vehicle)
                return Clamp(volume * Config.VehicleDensity, 150f, 40000f);

            return Clamp(volume * Config.PropDensity, 5f, 5000f);
        }

        public static float Clamp(float v, float lo, float hi)
        {
            if (v < lo) return lo;
            if (v > hi) return hi;
            return v;
        }

        public static Vector3 ClampLength(Vector3 v, float maxLength)
        {
            float len = v.Length();
            if (len <= maxLength || len < 0.0001f)
                return v;
            return v * (maxLength / len);
        }

        public static Vector3 WorldToLocal(Entity entity, Vector3 world)
        {
            return Function.Call<Vector3>(Hash.GET_OFFSET_FROM_ENTITY_GIVEN_WORLD_COORDS,
                entity.Handle, world.X, world.Y, world.Z);
        }

        public static Vector3 LocalToWorld(Entity entity, Vector3 local)
        {
            return Function.Call<Vector3>(Hash.GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS,
                entity.Handle, local.X, local.Y, local.Z);
        }

        public static void ActivatePhysics(Entity entity)
        {
            Function.Call(Hash.ACTIVATE_PHYSICS, entity.Handle);
        }

        /// <summary>
        /// Applies part of a rope impulse as a real force at an offset, which is what
        /// makes a towed car swing in behind the truck instead of sliding sideways.
        /// The vector is in delta-velocity units; the caller has already scaled by 1/mass.
        /// </summary>
        public static void ApplyOffsetImpulse(Entity entity, Vector3 deltaV, Vector3 localOffset)
        {
            Function.Call(Hash.APPLY_FORCE_TO_ENTITY,
                entity.Handle,
                1,                                          // MAX_FORCE_ROT: impulse, rotation included
                deltaV.X, deltaV.Y, deltaV.Z,
                localOffset.X, localOffset.Y, localOffset.Z,
                0,                                          // bone index
                false,                                      // direction is world space
                true,                                       // ignore up vector
                true,                                       // offset is entity space
                true, true);
        }

        /// <summary>Shortest distance between a ray and a line segment.</summary>
        public static float RayToSegmentDistance(Vector3 rayOrigin, Vector3 rayDir, Vector3 a, Vector3 b)
        {
            Vector3 u = rayDir;
            Vector3 v = b - a;
            Vector3 w = rayOrigin - a;

            float aa = Vector3.Dot(u, u);
            float bb = Vector3.Dot(u, v);
            float cc = Vector3.Dot(v, v);
            float dd = Vector3.Dot(u, w);
            float ee = Vector3.Dot(v, w);
            float denom = aa * cc - bb * bb;

            float sc, tc;
            if (Math.Abs(denom) < 0.0001f)
            {
                sc = 0f;
                tc = cc > 0.0001f ? ee / cc : 0f;
            }
            else
            {
                sc = (bb * ee - cc * dd) / denom;
                tc = (aa * ee - bb * dd) / denom;
            }

            if (sc < 0f) sc = 0f;                 // never pick behind the camera
            if (tc < 0f) tc = 0f;                 // clamp to the segment
            if (tc > 1f) tc = 1f;

            Vector3 p1 = rayOrigin + u * sc;
            Vector3 p2 = a + v * tc;
            return (p1 - p2).Length();
        }
    }
}
