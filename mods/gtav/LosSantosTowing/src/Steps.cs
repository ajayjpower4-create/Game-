// The same step chains the browser game used, expressed in things you can
// actually do in Los Santos with a stock tow truck.
using System.Collections.Generic;

namespace LosSantosTowing
{
    public enum StepId
    {
        Cones, JumpPack, Hood, Clamps, Crank, Righting, Hook, Chains, Deliver, Drop,
        Unlock, Fuel, TyreOff, SpareOn,
    }

    public sealed class Step
    {
        public StepId Id;
        public string Text;
        public bool Done;

        public Step(StepId id, string text) { Id = id; Text = text; }
    }

    public static class Steps
    {
        public static List<Step> For(Call call, int chainsRequired)
        {
            var list = new List<Step>();
            void Add(StepId id, string text) { list.Add(new Step(id, text)); }

            if (call.Cones) Add(StepId.Cones, "Put two cones out behind the scene");

            switch (call.Kind)
            {
                case JobKind.Jump:
                    Add(StepId.JumpPack, "Grab the jump pack off your truck");
                    Add(StepId.Hood, "Pop the hood");
                    Add(StepId.Clamps, "Clamp the pack onto the battery");
                    Add(StepId.Crank, "Crank it over");
                    Add(StepId.Hook, "Hook it up (or drive it in yourself)");
                    Add(StepId.Chains, "Secure the load - " + chainsRequired + " points");
                    Add(StepId.Deliver, "Deliver to the shop");
                    Add(StepId.Drop, "Drop it off");
                    break;

                case JobKind.Lockout:
                    Add(StepId.Unlock, "Get the door open");
                    break;

                case JobKind.Fuel:
                    Add(StepId.Fuel, "Put fuel in the tank");
                    if (!call.NoTow) AddTow(list, chainsRequired);
                    break;

                case JobKind.Tire:
                    Add(StepId.TyreOff, "Get the flat off");
                    if (call.NoTow) Add(StepId.SpareOn, "Fit the spare");
                    else AddTow(list, chainsRequired);
                    break;

                case JobKind.Winchout:
                case JobKind.Crash:
                    if (call.Damage == Damage.Rollover) Add(StepId.Righting, "Roll it back onto its wheels");
                    AddTow(list, chainsRequired);
                    break;

                default:
                    AddTow(list, chainsRequired);
                    break;
            }
            return list;
        }

        static void AddTow(List<Step> list, int chainsRequired)
        {
            list.Add(new Step(StepId.Hook, "Back the truck up and hook it"));
            list.Add(new Step(StepId.Chains, "Secure the load - " + chainsRequired + " points"));
            list.Add(new Step(StepId.Deliver, "Deliver to the shop"));
            list.Add(new Step(StepId.Drop, "Drop it off"));
        }
    }
}
