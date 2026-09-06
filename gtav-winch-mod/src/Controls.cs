using GTA.Native;

namespace WinchMod
{
    /// <summary>
    /// Mouse and wheel input through the game's own control system, by raw control id
    /// so it does not depend on the shape of the SHVDN Control enum. Disabling a
    /// control and then reading its disabled state is how a script takes a button
    /// without the game also acting on it.
    /// </summary>
    internal static class Controls
    {
        public const int Attack = 24;            // left mouse
        public const int Aim = 25;               // right mouse
        public const int Attack2 = 329;
        public const int VehicleAim = 68;
        public const int VehicleAttack = 69;
        public const int VehicleAttack2 = 70;
        public const int WheelNext = 14;         // mouse wheel down
        public const int WheelPrev = 15;         // mouse wheel up
        public const int SelectNextWeapon = 16;
        public const int SelectPrevWeapon = 17;
        public const int VehicleNextRadio = 81;
        public const int VehiclePrevRadio = 82;
        public const int MeleeAttackLight = 140;

        private static readonly int[] Blocked =
        {
            Attack, Aim, Attack2, VehicleAim, VehicleAttack, VehicleAttack2,
            WheelNext, WheelPrev, SelectNextWeapon, SelectPrevWeapon,
            VehicleNextRadio, VehiclePrevRadio, MeleeAttackLight
        };

        /// <summary>Takes the mouse for the winch. Must run every frame while active.</summary>
        public static void BlockThisFrame()
        {
            for (int i = 0; i < Blocked.Length; i++)
                Function.Call(Hash.DISABLE_CONTROL_ACTION, 0, Blocked[i], true);
        }

        public static bool JustPressed(int control)
        {
            return Function.Call<bool>(Hash.IS_DISABLED_CONTROL_JUST_PRESSED, 0, control);
        }

        public static bool Pressed(int control)
        {
            return Function.Call<bool>(Hash.IS_DISABLED_CONTROL_PRESSED, 0, control);
        }

        /// <summary>+1 for wheel up, -1 for wheel down, 0 for nothing.</summary>
        public static int WheelDelta()
        {
            if (JustPressed(WheelPrev) || JustPressed(SelectPrevWeapon)) return 1;
            if (JustPressed(WheelNext) || JustPressed(SelectNextWeapon)) return -1;
            return 0;
        }
    }
}
