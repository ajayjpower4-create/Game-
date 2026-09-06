using System;
using System.Windows.Forms;
using GTA;

namespace WinchMod
{
    /// <summary>
    /// Every tunable the mod has. Loaded once from scripts\WinchMod.ini and
    /// reloadable in game so you can tune rope feel without restarting.
    /// </summary>
    internal static class Config
    {
        // ---- keys ----------------------------------------------------------
        public static Keys AttachKey = Keys.NumPad0;
        public static Keys CutKey = Keys.NumPad1;
        public static Keys CutAllKey = Keys.NumPad2;
        public static Keys StrapKey = Keys.NumPad3;
        public static Keys SpoolInKey = Keys.NumPad8;
        public static Keys SpoolOutKey = Keys.NumPad5;
        public static Keys ReloadConfigKey = Keys.NumPad9;

        // ---- aiming --------------------------------------------------------
        public static float AimRange = 60f;
        public static float SnapToHookDistance = 0.75f;
        public static bool SnapToHooks = true;
        public static float CutPickDistance = 0.7f;
        public static bool TreatPropsAsAnchors = true;

        // ---- rope ----------------------------------------------------------
        public static int RopeType = 4;
        public static float MinLength = 0.8f;
        public static float MaxLength = 30f;
        public static float SpoolSpeed = 1.6f;      // metres per second
        public static float NativeSlack = 1.15f;    // engine rope stays looser than ours
        public static int MaxLines = 6;

        // ---- solver --------------------------------------------------------
        public static float Beta = 0.18f;           // positional correction rate
        public static float Damping = 1.0f;         // 1.0 = fully inelastic along the rope
        public static float MaxPullSpeed = 7f;      // cap on correction velocity (m/s)
        public static float MaxDeltaV = 1.6f;       // per-entity velocity change per frame
        public static float TorqueAssist = 0.35f;   // share of the impulse routed through
                                                    // APPLY_FORCE_TO_ENTITY so loads yaw properly
        public static float NoCrushDistance = 1.1f; // stop pulling once ends are this close
        public static bool BreakUnderLoad = true;
        public static float BreakForce = 260000f;   // newtons
        public static bool ReleaseTowedHandbrake = true;
        public static bool RagdollTowedPeds = true;

        // ---- mass estimation ----------------------------------------------
        public static float VehicleDensity = 110f;
        public static float PropDensity = 90f;
        public static float PedMass = 90f;

        // ---- flatbed / tow bed --------------------------------------------
        public static bool BedLockEnabled = true;
        public static bool AutoLockToBed = true;
        public static float BedFloorHeight = 0.75f;   // above model min Z
        public static float BedLengthFraction = 0.62f;
        public static float BedSideTolerance = 0.45f;
        public static float BedLockSpeed = 2.5f;      // max relative speed to latch
        public static float BedSettleTime = 0.6f;     // seconds to glide into place
        public static bool AnyVehicleCanCarry = false;
        public static string[] CarrierModels = { "flatbed", "towtruck", "towtruck2", "slamtruck", "mule", "mule2", "mule3", "mule4", "packer", "phantom" };

        // ---- hud -----------------------------------------------------------
        public static bool ShowHud = true;

        public static void Load()
        {
            ScriptSettings s = ScriptSettings.Load("scripts\\WinchMod.ini");

            AttachKey = Key(s, "Keys", "AttachKey", AttachKey);
            CutKey = Key(s, "Keys", "CutKey", CutKey);
            CutAllKey = Key(s, "Keys", "CutAllKey", CutAllKey);
            StrapKey = Key(s, "Keys", "StrapKey", StrapKey);
            SpoolInKey = Key(s, "Keys", "SpoolInKey", SpoolInKey);
            SpoolOutKey = Key(s, "Keys", "SpoolOutKey", SpoolOutKey);
            ReloadConfigKey = Key(s, "Keys", "ReloadConfigKey", ReloadConfigKey);

            AimRange = s.GetValue("Aiming", "AimRange", AimRange);
            SnapToHookDistance = s.GetValue("Aiming", "SnapToHookDistance", SnapToHookDistance);
            SnapToHooks = s.GetValue("Aiming", "SnapToHooks", SnapToHooks);
            CutPickDistance = s.GetValue("Aiming", "CutPickDistance", CutPickDistance);
            TreatPropsAsAnchors = s.GetValue("Aiming", "TreatPropsAsAnchors", TreatPropsAsAnchors);

            RopeType = s.GetValue("Rope", "RopeType", RopeType);
            MinLength = s.GetValue("Rope", "MinLength", MinLength);
            MaxLength = s.GetValue("Rope", "MaxLength", MaxLength);
            SpoolSpeed = s.GetValue("Rope", "SpoolSpeed", SpoolSpeed);
            NativeSlack = s.GetValue("Rope", "NativeSlack", NativeSlack);
            MaxLines = s.GetValue("Rope", "MaxLines", MaxLines);

            Beta = s.GetValue("Solver", "Beta", Beta);
            Damping = s.GetValue("Solver", "Damping", Damping);
            MaxPullSpeed = s.GetValue("Solver", "MaxPullSpeed", MaxPullSpeed);
            MaxDeltaV = s.GetValue("Solver", "MaxDeltaV", MaxDeltaV);
            TorqueAssist = s.GetValue("Solver", "TorqueAssist", TorqueAssist);
            NoCrushDistance = s.GetValue("Solver", "NoCrushDistance", NoCrushDistance);
            BreakUnderLoad = s.GetValue("Solver", "BreakUnderLoad", BreakUnderLoad);
            BreakForce = s.GetValue("Solver", "BreakForce", BreakForce);
            ReleaseTowedHandbrake = s.GetValue("Solver", "ReleaseTowedHandbrake", ReleaseTowedHandbrake);
            RagdollTowedPeds = s.GetValue("Solver", "RagdollTowedPeds", RagdollTowedPeds);

            VehicleDensity = s.GetValue("Mass", "VehicleDensity", VehicleDensity);
            PropDensity = s.GetValue("Mass", "PropDensity", PropDensity);
            PedMass = s.GetValue("Mass", "PedMass", PedMass);

            BedLockEnabled = s.GetValue("Bed", "BedLockEnabled", BedLockEnabled);
            AutoLockToBed = s.GetValue("Bed", "AutoLockToBed", AutoLockToBed);
            BedFloorHeight = s.GetValue("Bed", "BedFloorHeight", BedFloorHeight);
            BedLengthFraction = s.GetValue("Bed", "BedLengthFraction", BedLengthFraction);
            BedSideTolerance = s.GetValue("Bed", "BedSideTolerance", BedSideTolerance);
            BedLockSpeed = s.GetValue("Bed", "BedLockSpeed", BedLockSpeed);
            BedSettleTime = s.GetValue("Bed", "BedSettleTime", BedSettleTime);
            AnyVehicleCanCarry = s.GetValue("Bed", "AnyVehicleCanCarry", AnyVehicleCanCarry);

            string models = s.GetValue("Bed", "CarrierModels", string.Join(",", CarrierModels));
            if (!string.IsNullOrEmpty(models))
                CarrierModels = models.ToLowerInvariant().Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < CarrierModels.Length; i++)
                CarrierModels[i] = CarrierModels[i].Trim();

            ShowHud = s.GetValue("Hud", "ShowHud", ShowHud);

            Clamp();
        }

        private static void Clamp()
        {
            if (MinLength < 0.3f) MinLength = 0.3f;
            if (MaxLength < MinLength + 1f) MaxLength = MinLength + 1f;
            if (Beta < 0f) Beta = 0f;
            if (Beta > 1f) Beta = 1f;
            if (Damping < 0f) Damping = 0f;
            if (Damping > 1f) Damping = 1f;
            if (TorqueAssist < 0f) TorqueAssist = 0f;
            if (TorqueAssist > 1f) TorqueAssist = 1f;
            if (MaxDeltaV < 0.1f) MaxDeltaV = 0.1f;
            if (MaxLines < 1) MaxLines = 1;
        }

        private static Keys Key(ScriptSettings s, string section, string name, Keys fallback)
        {
            string raw = s.GetValue(section, name, fallback.ToString());
            Keys parsed;
            if (!string.IsNullOrEmpty(raw) && Enum.TryParse(raw.Trim(), true, out parsed))
                return parsed;
            return fallback;
        }
    }
}
