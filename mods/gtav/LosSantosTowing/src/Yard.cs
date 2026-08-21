// The yard: where a shift starts. Fade out, put the player there, drop the
// truck on the ground beside them, fade back in.
using GTA;
using GTA.Math;
using GTA.Native;
using GTA.UI;
using System;

namespace LosSantosTowing
{
    public static class Yard
    {
        /// Teleports the player to a position and hands them a truck.
        /// Returns the truck, or null if it could not be spawned.
        public static Vehicle StartShift(Vector3 yardPosition, float heading, VehicleHash truckModel,
            bool teleport, Vehicle existingTruck)
        {
            var player = Game.Player.Character;
            if (player == null || !player.Exists()) return null;

            if (teleport)
            {
                try
                {
                    Screen.FadeOut(600);
                    Script.Wait(700);

                    // Make sure the world is actually there before we arrive.
                    Function.Call(Hash.REQUEST_COLLISION_AT_COORD, yardPosition.X, yardPosition.Y, yardPosition.Z);
                    Function.Call(Hash.LOAD_SCENE, yardPosition.X, yardPosition.Y, yardPosition.Z);

                    if (player.IsInVehicle())
                    {
                        var veh = player.CurrentVehicle;
                        player.Task.WarpOutOfVehicle(veh);
                        Script.Wait(50);
                    }

                    player.Position = yardPosition;
                    player.Heading = heading;
                    Script.Wait(400);
                }
                catch (Exception ex)
                {
                    Log.Error("Yard.StartShift/teleport", ex);
                }
            }

            Vehicle truck = existingTruck;
            if (truck == null || !truck.Exists())
            {
                truck = SpawnTruck(player, yardPosition, heading, truckModel);
            }

            try
            {
                Screen.FadeIn(600);
            }
            catch (Exception ex) { Log.Error("Yard.StartShift/fadeIn", ex); }

            return truck;
        }

        public static Vehicle SpawnTruck(Ped player, Vector3 near, float heading, VehicleHash hash)
        {
            try
            {
                var model = new Model(hash);
                model.Request(5000);
                if (!model.IsValid || !model.IsLoaded)
                {
                    Log.Write("Truck model " + hash + " would not load.");
                    return null;
                }

                // Just to the player's right, nose the same way they are facing.
                double rad = heading * Math.PI / 180.0;
                var right = new Vector3((float)Math.Cos(rad), (float)-Math.Sin(rad), 0f);
                var spot = near + right * 5f;
                spot.Z = World.GetGroundHeight(spot) + 1f;
                if (spot.Z < 1f) spot = near + right * 5f;

                Function.Call(Hash.CLEAR_AREA_OF_VEHICLES, spot.X, spot.Y, spot.Z, 6f, false, false, false, false, false);
                var truck = World.CreateVehicle(model, spot, heading);
                model.MarkAsNoLongerNeeded();
                if (truck == null || !truck.Exists())
                {
                    Log.Write("Truck spawn failed at " + spot);
                    return null;
                }

                truck.PlaceOnGround();
                truck.IsPersistent = true;
                truck.IsEngineRunning = false;
                Function.Call(Hash.SET_VEHICLE_NUMBER_PLATE_TEXT, truck, "LSTOW");
                Function.Call(Hash.SET_VEHICLE_DIRT_LEVEL, truck, 3.0f);

                var blip = truck.AddBlip();
                if (blip != null && blip.Exists())
                {
                    blip.Sprite = BlipSprite.TowTruck;
                    blip.Color = BlipColor.Blue;
                    blip.Name = "Your tow truck";
                    blip.IsShortRange = true;
                }
                Log.Write("Spawned " + hash + " at " + spot);
                return truck;
            }
            catch (Exception ex)
            {
                Log.Error("Yard.SpawnTruck", ex);
                return null;
            }
        }

        public static void Teleport(Vector3 position, float heading = 0f, bool inVehicle = true)
        {
            var player = Game.Player.Character;
            if (player == null || !player.Exists()) return;
            try
            {
                Screen.FadeOut(500);
                Script.Wait(600);
                Function.Call(Hash.REQUEST_COLLISION_AT_COORD, position.X, position.Y, position.Z);
                Function.Call(Hash.LOAD_SCENE, position.X, position.Y, position.Z);

                var vehicle = inVehicle && player.IsInVehicle() ? player.CurrentVehicle : null;
                if (vehicle != null && vehicle.Exists())
                {
                    vehicle.Position = position;
                    vehicle.Heading = heading;
                    vehicle.PlaceOnGround();
                }
                else
                {
                    player.Position = position;
                    player.Heading = heading;
                }
                Script.Wait(300);
                Screen.FadeIn(500);
            }
            catch (Exception ex)
            {
                Log.Error("Yard.Teleport", ex);
                try { Screen.FadeIn(400); } catch { }
            }
        }
    }
}
