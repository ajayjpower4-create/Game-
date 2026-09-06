using System;
using GTA;
using GTA.Math;
using GTA.Native;

namespace ConstructionProps
{
    /// <summary>
    /// Raw native hashes for calls whose friendly name has moved around between
    /// ScriptHookVDotNet builds. Calling by hash keeps this mod compiling against
    /// SHVDN 3.0 through 3.6 without ifdefs.
    /// </summary>
    internal static class N
    {
        const ulong SHOW_CURSOR_THIS_FRAME        = 0xAAE7CE1D63167423;
        const ulong SET_MOUSE_CURSOR_SPRITE       = 0x8DB8CFFD58B62552;
        const ulong GET_ASPECT_RATIO              = 0xF1307EF624A80D87;
        const ulong SET_ENTITY_LOAD_COLLISION     = 0x0DC7CABAB1E9B67E;

        internal static void ShowCursorThisFrame()
        {
            Function.Call((Hash)SHOW_CURSOR_THIS_FRAME);
        }

        /// <summary>1 = normal arrow, 3 = hand, 5 = crosshair-ish grab.</summary>
        internal static void SetCursorSprite(int sprite)
        {
            Function.Call((Hash)SET_MOUSE_CURSOR_SPRITE, sprite);
        }

        internal static float AspectRatio()
        {
            return Function.Call<float>((Hash)GET_ASPECT_RATIO, false);
        }

        internal static void SetLoadCollisionFlag(Entity e, bool on)
        {
            Function.Call((Hash)SET_ENTITY_LOAD_COLLISION, e.Handle, on);
        }

        internal static float CursorX()
        {
            return Function.Call<float>(Hash.GET_CONTROL_NORMAL, 0, (int)Control.CursorX);
        }

        internal static float CursorY()
        {
            return Function.Call<float>(Hash.GET_CONTROL_NORMAL, 0, (int)Control.CursorY);
        }

        internal static Vector3 CamCoord()
        {
            return Function.Call<Vector3>(Hash.GET_GAMEPLAY_CAM_COORD);
        }

        /// <summary>Returns (pitch, roll, yaw) in degrees, rotation order 2.</summary>
        internal static Vector3 CamRot()
        {
            return Function.Call<Vector3>(Hash.GET_GAMEPLAY_CAM_ROT, 2);
        }

        internal static float CamFov()
        {
            return Function.Call<float>(Hash.GET_GAMEPLAY_CAM_FOV);
        }

        internal static void Freeze(Entity e, bool frozen)
        {
            Function.Call(Hash.FREEZE_ENTITY_POSITION, e.Handle, frozen);
        }

        internal static void SetDynamic(Entity e, bool dynamic)
        {
            Function.Call(Hash.SET_ENTITY_DYNAMIC, e.Handle, dynamic);
        }

        internal static void SetCollision(Entity e, bool on)
        {
            Function.Call(Hash.SET_ENTITY_COLLISION, e.Handle, on, false);
        }

        internal static void SetLodDist(Entity e, int dist)
        {
            Function.Call(Hash.SET_ENTITY_LOD_DIST, e.Handle, dist);
        }

        internal static void SetAlpha(Entity e, int alpha)
        {
            Function.Call(Hash.SET_ENTITY_ALPHA, e.Handle, alpha, false);
        }

        internal static void ResetAlpha(Entity e)
        {
            Function.Call(Hash.RESET_ENTITY_ALPHA, e.Handle);
        }

        internal static void PlaceOnGround(Entity e)
        {
            Function.Call(Hash.PLACE_OBJECT_ON_GROUND_PROPERLY, e.Handle);
        }
    }
}
