// One live call: the casualty vehicle, where it sits, its blips, and how far
// through the checklist you are.
using GTA;
using GTA.Math;
using GTA.Native;
using System;
using System.Collections.Generic;
using System.Linq;

namespace LosSantosTowing
{
    public sealed class Job
    {
        public Call Call;
        public Garage Garage;
        public Vector3 ScenePosition;
        public float SceneHeading;
        public Vehicle Casualty;
        public Ped Client;
        public Blip SceneBlip;
        public Blip GarageBlip;
        public List<Step> Steps;
        public List<Prop> Cones = new List<Prop>();

        public int Chains;
        public bool CarryingJumpPack;
        public bool Jumped;
        public bool ArrivedOnScene;
        public int StartedAt;          // Game.GameTime when accepted
        public int DamageBill;         // knocked off the ticket at payout

        public bool Has(StepId id) { return Steps.Any(s => s.Id == id); }

        public Step Current { get { return Steps.FirstOrDefault(s => !s.Done); } }

        public bool IsDone { get { return Steps.All(s => s.Done); } }

        public bool Complete(StepId id)
        {
            var step = Steps.FirstOrDefault(s => s.Id == id && !s.Done);
            if (step == null) return false;
            step.Done = true;
            return true;
        }

        public void Undo(StepId id)
        {
            var step = Steps.FirstOrDefault(s => s.Id == id);
            if (step != null) step.Done = false;
        }

        public bool IsCurrent(StepId id)
        {
            var c = Current;
            return c != null && c.Id == id;
        }

        /// Everything the mod spawned goes away again - no litter left in the save.
        public void Cleanup(bool keepCasualty)
        {
            if (SceneBlip != null && SceneBlip.Exists()) SceneBlip.Delete();
            if (GarageBlip != null && GarageBlip.Exists()) GarageBlip.Delete();
            SceneBlip = null;
            GarageBlip = null;

            foreach (var cone in Cones)
            {
                if (cone != null && cone.Exists()) cone.Delete();
            }
            Cones.Clear();

            if (Client != null && Client.Exists())
            {
                Client.MarkAsNoLongerNeeded();
                Client = null;
            }

            if (Casualty != null && Casualty.Exists())
            {
                if (keepCasualty) Casualty.MarkAsNoLongerNeeded();
                else Casualty.Delete();
                Casualty = null;
            }
        }

        public int Payout(float multiplier, bool hazardBonus)
        {
            int seconds = (Game.GameTime - StartedAt) / 1000;
            float speed = seconds < 240 ? 1.15f : seconds < 480 ? 1.0f : 0.9f;
            float weather = hazardBonus ? 1.2f : 1.0f;
            int gross = (int)Math.Round(Call.Pay * multiplier * speed * weather);
            return Math.Max(20, gross - DamageBill);
        }
    }
}
