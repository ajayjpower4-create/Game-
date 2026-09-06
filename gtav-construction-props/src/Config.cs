using System;
using System.IO;
using System.Windows.Forms;
using GTA;

namespace ConstructionProps
{
    /// <summary>
    /// Everything tunable lives in ConstructionProps.ini so people can dial the
    /// performance budget to their own rig without recompiling.
    /// </summary>
    internal class Config
    {
        public Keys MenuKey = Keys.F5;
        public Keys UndoKey = Keys.Z;
        public Keys RedoKey = Keys.Y;
        public Keys DeleteKey = Keys.Delete;
        public Keys GrabKey = Keys.E;
        public Keys SnapKey = Keys.G;
        public Keys ResetRotationKey = Keys.R;
        public Keys GroundKey = Keys.F;

        // --- streaming budget: this is what keeps big scenes from tanking FPS ---
        public float StreamRadius = 160f;
        public float DespawnMargin = 25f;
        public int MaxLiveProps = 600;
        public int SpawnsPerPass = 4;
        public int DespawnsPerPass = 10;
        public int StreamIntervalMs = 120;
        public int LodDistance = 300;
        public float PhysicsRadius = 45f;
        public int ModelUnloadGraceMs = 8000;

        // --- editing feel ---
        public float SnapStep = 0.25f;
        public float RotateStep = 15f;
        public float HeightStep = 0.1f;
        public float PaintSpacing = 1.5f;
        public float MaxPlaceDistance = 150f;
        public bool SnapDefaultOn = false;
        public bool ShowHud = true;
        public bool CollisionByDefault = true;
        public bool PlaceFrozen = true;

        public static Config Load(string path)
        {
            var c = new Config();
            try
            {
                var s = ScriptSettings.Load(path);

                c.MenuKey = ParseKey(s.GetValue("Keys", "Menu", "F5"), c.MenuKey);
                c.UndoKey = ParseKey(s.GetValue("Keys", "Undo", "Z"), c.UndoKey);
                c.RedoKey = ParseKey(s.GetValue("Keys", "Redo", "Y"), c.RedoKey);
                c.DeleteKey = ParseKey(s.GetValue("Keys", "Delete", "Delete"), c.DeleteKey);
                c.GrabKey = ParseKey(s.GetValue("Keys", "Grab", "E"), c.GrabKey);
                c.SnapKey = ParseKey(s.GetValue("Keys", "ToggleSnap", "G"), c.SnapKey);
                c.ResetRotationKey = ParseKey(s.GetValue("Keys", "ResetRotation", "R"), c.ResetRotationKey);
                c.GroundKey = ParseKey(s.GetValue("Keys", "DropToGround", "F"), c.GroundKey);

                c.StreamRadius = s.GetValue("Streaming", "Radius", c.StreamRadius);
                c.DespawnMargin = s.GetValue("Streaming", "DespawnMargin", c.DespawnMargin);
                c.MaxLiveProps = s.GetValue("Streaming", "MaxLiveProps", c.MaxLiveProps);
                c.SpawnsPerPass = s.GetValue("Streaming", "SpawnsPerPass", c.SpawnsPerPass);
                c.DespawnsPerPass = s.GetValue("Streaming", "DespawnsPerPass", c.DespawnsPerPass);
                c.StreamIntervalMs = s.GetValue("Streaming", "IntervalMs", c.StreamIntervalMs);
                c.LodDistance = s.GetValue("Streaming", "LodDistance", c.LodDistance);
                c.PhysicsRadius = s.GetValue("Streaming", "PhysicsRadius", c.PhysicsRadius);
                c.ModelUnloadGraceMs = s.GetValue("Streaming", "ModelUnloadGraceMs", c.ModelUnloadGraceMs);

                c.SnapStep = s.GetValue("Editing", "SnapStep", c.SnapStep);
                c.RotateStep = s.GetValue("Editing", "RotateStep", c.RotateStep);
                c.HeightStep = s.GetValue("Editing", "HeightStep", c.HeightStep);
                c.PaintSpacing = s.GetValue("Editing", "PaintSpacing", c.PaintSpacing);
                c.MaxPlaceDistance = s.GetValue("Editing", "MaxPlaceDistance", c.MaxPlaceDistance);
                c.SnapDefaultOn = s.GetValue("Editing", "SnapOnByDefault", c.SnapDefaultOn);
                c.CollisionByDefault = s.GetValue("Editing", "CollisionByDefault", c.CollisionByDefault);
                c.PlaceFrozen = s.GetValue("Editing", "PlaceFrozen", c.PlaceFrozen);
                c.ShowHud = s.GetValue("Editing", "ShowHud", c.ShowHud);
            }
            catch
            {
                // A broken ini should never stop the mod from loading.
            }

            c.Clamp();
            if (!File.Exists(path))
            {
                try { WriteTemplate(path); } catch { }
            }
            return c;
        }

        void Clamp()
        {
            StreamRadius = Clamp(StreamRadius, 40f, 600f);
            DespawnMargin = Clamp(DespawnMargin, 5f, 200f);
            MaxLiveProps = (int)Clamp(MaxLiveProps, 25f, 2500f);
            SpawnsPerPass = (int)Clamp(SpawnsPerPass, 1f, 40f);
            DespawnsPerPass = (int)Clamp(DespawnsPerPass, 1f, 80f);
            StreamIntervalMs = (int)Clamp(StreamIntervalMs, 16f, 2000f);
            LodDistance = (int)Clamp(LodDistance, 50f, 5000f);
            PhysicsRadius = Clamp(PhysicsRadius, 0f, StreamRadius);
            SnapStep = Clamp(SnapStep, 0.05f, 10f);
            RotateStep = Clamp(RotateStep, 1f, 90f);
            HeightStep = Clamp(HeightStep, 0.01f, 5f);
            PaintSpacing = Clamp(PaintSpacing, 0.2f, 50f);
            MaxPlaceDistance = Clamp(MaxPlaceDistance, 5f, 500f);
        }

        static float Clamp(float v, float lo, float hi)
        {
            return v < lo ? lo : (v > hi ? hi : v);
        }

        static Keys ParseKey(string raw, Keys fallback)
        {
            if (string.IsNullOrEmpty(raw)) return fallback;
            try { return (Keys)Enum.Parse(typeof(Keys), raw.Trim(), true); }
            catch { return fallback; }
        }

        static void WriteTemplate(string path)
        {
            File.WriteAllText(path, string.Join(Environment.NewLine, new[]
            {
                "; Construction Props - settings",
                "; Delete this file to regenerate it with defaults.",
                "",
                "[Keys]",
                "Menu = F5",
                "Undo = Z              ; with Ctrl",
                "Redo = Y              ; with Ctrl",
                "Delete = Delete",
                "Grab = E",
                "ToggleSnap = G",
                "ResetRotation = R",
                "DropToGround = F",
                "",
                "[Streaming]",
                "; Props further than Radius from the camera are removed from the world but",
                "; kept in the scene. Lower this first if you are hurting for frames.",
                "Radius = 160",
                "DespawnMargin = 25",
                "MaxLiveProps = 600",
                "SpawnsPerPass = 4",
                "DespawnsPerPass = 10",
                "IntervalMs = 120",
                "LodDistance = 300",
                "; Props beyond PhysicsRadius keep their model but drop collision.",
                "PhysicsRadius = 45",
                "ModelUnloadGraceMs = 8000",
                "",
                "[Editing]",
                "SnapStep = 0.25",
                "RotateStep = 15",
                "HeightStep = 0.1",
                "PaintSpacing = 1.5",
                "MaxPlaceDistance = 150",
                "SnapOnByDefault = false",
                "CollisionByDefault = true",
                "PlaceFrozen = true       ; frozen props cost the physics step nothing",
                "ShowHud = true",
                ""
            }));
        }
    }
}
