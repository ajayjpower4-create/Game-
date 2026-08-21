// Everything tunable lives in LosSantosTowing.ini next to the .dll.
using GTA;
using System;
using System.Windows.Forms;

namespace LosSantosTowing
{
    public sealed class Config
    {
        readonly ScriptSettings _s;

        public Keys ToggleDutyKey;
        public Keys AcceptKey;
        public Keys DeclineKey;
        public Keys ElsKey;
        public Keys CaptureGarageKey;
        public Keys RequestTruckKey;
        public Keys MenuKey;
        public bool MenuNeedsShift;

        public int FirstCallSeconds;
        public int CallGapSeconds;
        public float MinCallDistance;
        public float MaxCallDistance;
        public float SceneRadius;        // how close counts as "on scene"
        public float DropRadius;         // how close counts as "at the garage"
        public int ChainsRequired;       // how many securing points a load needs
        public float PayMultiplier;
        public bool ShowGarageBlips;
        public bool UnsecuredLoadsFall;
        public bool StartOnDuty;
        public string ConeModel;
        public bool AllowTruckRequest;
        public bool LogToFile;
        public bool RichHud;
        public string YardGarage;
        public string YardTruck;
        public float YardHeading;
        public bool TeleportToYard;
        public string MenuHint;

        public Config(ScriptSettings s)
        {
            _s = s;
            ToggleDutyKey = Key("ToggleDutyKey", Keys.F5);
            AcceptKey = Key("AcceptKey", Keys.Y);
            DeclineKey = Key("DeclineKey", Keys.N);
            ElsKey = Key("ElsKey", Keys.L);
            CaptureGarageKey = Key("CaptureGarageKey", Keys.F11);
            RequestTruckKey = Key("RequestTruckKey", Keys.F6);
            MenuKey = Key("MenuKey", Keys.M);
            MenuNeedsShift = _s.GetValue("keys", "MenuNeedsShift", true);

            FirstCallSeconds = _s.GetValue("dispatch", "FirstCallSeconds", 60);
            CallGapSeconds = _s.GetValue("dispatch", "CallGapSeconds", 45);
            MinCallDistance = _s.GetValue("dispatch", "MinCallDistance", 250f);
            MaxCallDistance = _s.GetValue("dispatch", "MaxCallDistance", 1400f);
            SceneRadius = _s.GetValue("dispatch", "SceneRadius", 22f);
            DropRadius = _s.GetValue("dispatch", "DropRadius", 18f);

            ChainsRequired = _s.GetValue("job", "ChainsRequired", 4);
            PayMultiplier = _s.GetValue("job", "PayMultiplier", 1.0f);
            UnsecuredLoadsFall = _s.GetValue("job", "UnsecuredLoadsFall", true);
            ConeModel = _s.GetValue("job", "ConeModel", "prop_roadcone02a");
            AllowTruckRequest = _s.GetValue("job", "AllowTruckRequest", true);
            LogToFile = _s.GetValue("debug", "LogToFile", true);
            RichHud = _s.GetValue("debug", "RichHud", true);

            YardGarage = _s.GetValue("yard", "YardGarage", "yard");
            YardTruck = _s.GetValue("yard", "YardTruck", "towtruck2");
            YardHeading = _s.GetValue("yard", "YardHeading", 90f);
            TeleportToYard = _s.GetValue("yard", "TeleportToYard", true);
            MenuHint = "Menu: " + (MenuNeedsShift ? "Shift + " : "") + MenuKey;

            ShowGarageBlips = _s.GetValue("hud", "ShowGarageBlips", true);
            StartOnDuty = _s.GetValue("hud", "StartOnDuty", false);
        }

        Keys Key(string name, Keys fallback)
        {
            string raw = _s.GetValue("keys", name, fallback.ToString());
            try { return (Keys)Enum.Parse(typeof(Keys), raw, true); }
            catch { return fallback; }
        }

        /// Writes any missing entries so the file is self-documenting after one run.
        public void EnsureWritten()
        {
            _s.SetValue("keys", "ToggleDutyKey", ToggleDutyKey.ToString());
            _s.SetValue("keys", "AcceptKey", AcceptKey.ToString());
            _s.SetValue("keys", "DeclineKey", DeclineKey.ToString());
            _s.SetValue("keys", "ElsKey", ElsKey.ToString());
            _s.SetValue("keys", "CaptureGarageKey", CaptureGarageKey.ToString());
            _s.SetValue("keys", "RequestTruckKey", RequestTruckKey.ToString());
            _s.SetValue("keys", "MenuKey", MenuKey.ToString());
            _s.SetValue("keys", "MenuNeedsShift", MenuNeedsShift);
            _s.SetValue("dispatch", "FirstCallSeconds", FirstCallSeconds);
            _s.SetValue("dispatch", "CallGapSeconds", CallGapSeconds);
            _s.SetValue("dispatch", "MinCallDistance", MinCallDistance);
            _s.SetValue("dispatch", "MaxCallDistance", MaxCallDistance);
            _s.SetValue("dispatch", "SceneRadius", SceneRadius);
            _s.SetValue("dispatch", "DropRadius", DropRadius);
            _s.SetValue("job", "ChainsRequired", ChainsRequired);
            _s.SetValue("job", "PayMultiplier", PayMultiplier);
            _s.SetValue("job", "UnsecuredLoadsFall", UnsecuredLoadsFall);
            _s.SetValue("job", "ConeModel", ConeModel);
            _s.SetValue("job", "AllowTruckRequest", AllowTruckRequest);
            _s.SetValue("debug", "LogToFile", LogToFile);
            _s.SetValue("debug", "RichHud", RichHud);
            _s.SetValue("yard", "YardGarage", YardGarage);
            _s.SetValue("yard", "YardTruck", YardTruck);
            _s.SetValue("yard", "YardHeading", YardHeading);
            _s.SetValue("yard", "TeleportToYard", TeleportToYard);
            _s.SetValue("hud", "ShowGarageBlips", ShowGarageBlips);
            _s.SetValue("hud", "StartOnDuty", StartOnDuty);
            _s.Save();
        }
    }
}
