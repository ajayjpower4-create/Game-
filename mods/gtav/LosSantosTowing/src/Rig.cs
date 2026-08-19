// The hands-on half: what counts as a tow truck, hooking and unhooking,
// securing the load, the amber lights, and the roadside fixes.
using GTA;
using GTA.Math;
using GTA.Native;
using System;
using System.Linq;

namespace LosSantosTowing
{
    public enum ElsMode { Off = 0, Steady = 1, Flash = 2 }

    public static class Rig
    {
        static readonly VehicleHash[] BoomTrucks = { VehicleHash.TowTruck, VehicleHash.TowTruck2 };

        public static bool IsTowTruck(Vehicle v)
        {
            if (v == null || !v.Exists()) return false;
            int hash = v.Model.Hash;
            return BoomTrucks.Any(m => (int)m == hash) || hash == (int)VehicleHash.Flatbed;
        }

        public static bool HasBoom(Vehicle v)
        {
            if (v == null || !v.Exists()) return false;
            int hash = v.Model.Hash;
            return BoomTrucks.Any(m => (int)m == hash);
        }

        /// The nearest tow truck to a point, ignoring the casualty itself.
        public static Vehicle NearestTruck(Vector3 position, float radius, Vehicle ignore = null)
        {
            Vehicle best = null;
            float bestDist = float.MaxValue;
            foreach (var v in World.GetNearbyVehicles(position, radius))
            {
                if (v == null || !v.Exists()) continue;
                if (ignore != null && v == ignore) continue;
                if (!IsTowTruck(v)) continue;
                float d = v.Position.DistanceTo(position);
                if (d < bestDist) { bestDist = d; best = v; }
            }
            return best;
        }

        /// The truck the player is driving, if it can tow at all.
        public static Vehicle PlayerTruck()
        {
            var ped = Game.Player.Character;
            if (ped == null || !ped.IsInVehicle()) return null;
            var v = ped.CurrentVehicle;
            return IsTowTruck(v) ? v : null;
        }

        public static Vehicle TowedBy(Vehicle truck)
        {
            if (truck == null || !truck.Exists()) return null;
            if (HasBoom(truck)) return truck.TowedVehicle;
            // Flatbeds have no boom, so the load rides attached to the deck.
            return FlatbedLoad != null && FlatbedLoad.Exists() && FlatbedLoad.IsAttachedTo(truck) ? FlatbedLoad : null;
        }

        static Vehicle FlatbedLoad;

        public static bool Hook(Vehicle truck, Vehicle target)
        {
            if (truck == null || target == null || !truck.Exists() || !target.Exists()) return false;
            if (HasBoom(truck))
            {
                truck.TowVehicle(target, true);
                return truck.TowedVehicle == target;
            }
            // Flatbed: sit it on the deck, nose forward, like a loaded rollback.
            target.AttachTo(truck, new Vector3(0f, -1.6f, 1.1f), Vector3.Zero);
            FlatbedLoad = target;
            return true;
        }

        public static void Unhook(Vehicle truck)
        {
            if (truck == null || !truck.Exists()) return;
            if (HasBoom(truck))
            {
                truck.DetachTowedVehicle();
            }
            else if (FlatbedLoad != null && FlatbedLoad.Exists())
            {
                FlatbedLoad.Detach();
                Function.Call(Hash.SET_VEHICLE_ON_GROUND_PROPERLY, FlatbedLoad);
                FlatbedLoad = null;
            }
        }

        public static void ForgetFlatbedLoad() { FlatbedLoad = null; }

        /* ------------------------------------------------------------ lights */

        // GTA V's tow trucks have no amber bar, so the ELS runs on the hazards:
        // off, both on steady, or the slow alternating wig-wag.
        public static void ApplyEls(Vehicle truck, ElsMode mode, int gameTime)
        {
            if (truck == null || !truck.Exists()) return;
            switch (mode)
            {
                case ElsMode.Off:
                    truck.IsLeftIndicatorLightOn = false;
                    truck.IsRightIndicatorLightOn = false;
                    break;
                case ElsMode.Steady:
                    truck.IsLeftIndicatorLightOn = true;
                    truck.IsRightIndicatorLightOn = true;
                    break;
                case ElsMode.Flash:
                    bool left = (gameTime / 500) % 2 == 0;
                    truck.IsLeftIndicatorLightOn = left;
                    truck.IsRightIndicatorLightOn = !left;
                    break;
            }
        }

        public static string ElsLabel(ElsMode mode)
        {
            switch (mode)
            {
                case ElsMode.Steady: return "amber steady";
                case ElsMode.Flash: return "slow amber flash";
                default: return "off";
            }
        }

        /* -------------------------------------------------------- casualties */

        /// Dresses a freshly spawned car to match the call: damage, flats, dirt,
        /// dead engine, locked doors.
        public static void Prepare(Vehicle v, Call call, Random rng)
        {
            if (v == null || !v.Exists()) return;

            v.IsPersistent = true;
            Function.Call(Hash.SET_ENTITY_AS_MISSION_ENTITY, v, true, true);
            Function.Call(Hash.SET_VEHICLE_DIRT_LEVEL, v, (float)rng.Next(2, 12));
            v.IsEngineRunning = false;

            switch (call.Kind)
            {
                case JobKind.Lockout:
                    Function.Call(Hash.SET_VEHICLE_DOORS_LOCKED, v, 2);
                    break;
                case JobKind.Fuel:
                    v.FuelLevel = 0f;
                    break;
                default:
                    // Dead where it sits: it will crank but not catch.
                    Function.Call(Hash.SET_VEHICLE_UNDRIVEABLE, v, true);
                    break;
            }

            switch (call.Damage)
            {
                case Damage.Front:
                    v.EngineHealth = 120f;
                    v.BodyHealth = 480f;
                    v.Doors[VehicleDoorIndex.Hood].Open(true, true);
                    Smash(v, new Vector3(0f, 3.2f, 0.2f), 260f);
                    break;
                case Damage.Rear:
                    v.BodyHealth = 520f;
                    v.Doors[VehicleDoorIndex.Trunk].Open(true, true);
                    Smash(v, new Vector3(0f, -3.2f, 0.2f), 240f);
                    break;
                case Damage.Side:
                    v.BodyHealth = 560f;
                    Smash(v, new Vector3(rng.Next(2) == 0 ? -1.6f : 1.6f, 0f, 0.2f), 220f);
                    break;
                case Damage.Rollover:
                    v.BodyHealth = 380f;
                    v.EngineHealth = 100f;
                    v.Rotation = new Vector3(0f, rng.Next(2) == 0 ? 82f : -82f, v.Heading);
                    break;
            }

            for (int i = 0; i < call.Flats && i < 4; i++)
            {
                Function.Call(Hash.SET_VEHICLE_TYRE_BURST, v, i, true, 1000f);
            }
        }

        static void Smash(Vehicle v, Vector3 offset, float amount)
        {
            Function.Call(Hash.SET_VEHICLE_DAMAGE, v, offset.X, offset.Y, offset.Z, amount, 100f, true);
        }

        public static void RollUpright(Vehicle v)
        {
            if (v == null || !v.Exists()) return;
            Function.Call(Hash.SET_VEHICLE_ON_GROUND_PROPERLY, v);
        }

        public static void FixTyres(Vehicle v)
        {
            if (v == null || !v.Exists()) return;
            for (int i = 0; i < 8; i++) Function.Call(Hash.SET_VEHICLE_TYRE_FIXED, v, i);
        }

        public static void Revive(Vehicle v)
        {
            if (v == null || !v.Exists()) return;
            Function.Call(Hash.SET_VEHICLE_UNDRIVEABLE, v, false);
            if (v.EngineHealth < 200f) v.EngineHealth = 350f;
            v.IsEngineRunning = true;
        }

        public static void Unlock(Vehicle v)
        {
            if (v == null || !v.Exists()) return;
            Function.Call(Hash.SET_VEHICLE_DOORS_LOCKED, v, 1);
            v.Doors[VehicleDoorIndex.FrontLeftDoor].Open(false, false);
        }

        /* ------------------------------------------------------- the load */

        /// An unsecured load on a boom is genuinely precarious - hard braking or
        /// a sharp turn can drop it. Returns true if it came off.
        public static bool CheckLoadSlip(Vehicle truck, int chains, int required, Random rng)
        {
            if (truck == null || !truck.Exists()) return false;
            var load = TowedBy(truck);
            if (load == null) return false;
            if (chains >= required) return false;

            float speed = truck.Speed;                       // m/s
            float steer = Math.Abs(truck.SteeringAngle);     // degrees
            float slack = 1f - (float)chains / Math.Max(1, required);
            bool rough = speed > 14f && steer > 18f;
            bool hard = speed > 24f;
            if (!rough && !hard) return false;
            // Roughly once every few seconds of genuinely bad driving.
            if (rng.NextDouble() > 0.02 * slack) return false;

            Unhook(truck);
            return true;
        }
    }
}
