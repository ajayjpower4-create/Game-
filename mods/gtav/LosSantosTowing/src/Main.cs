// Los Santos Towing - the shift loop.
//
// Clock on, dispatch calls, you drive out, hook it, secure it, deliver it, get
// paid. Everything runs on stock Los Santos and stock vehicles: the mod spawns
// the casualty car and cleans it up again, and touches nothing else.
using GTA;
using GTA.Math;
using GTA.Native;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Forms;
using Control = GTA.Control;   // System.Windows.Forms has one too

namespace LosSantosTowing
{
    public class Main : Script
    {
        public const string Version = "1.1.0";

        readonly Config _cfg;
        readonly Garages _garages;
        readonly Random _rng = new Random();
        readonly HashSet<string> _used = new HashSet<string>();

        bool _onDuty;
        ElsMode _els = ElsMode.Off;

        Job _job;
        Call _offer;
        Garage _offerGarage;
        Vector3 _offerScene;
        float _offerHeading;
        int _offerExpiresAt;
        int _nextCallAt;

        // Key presses are only recorded here; every call into the game happens on
        // the script's own tick. Doing game work straight out of a key handler is
        // the classic way to take GTA V down with you.
        enum Pending { ToggleDuty, Accept, Decline, Els, CaptureGarage, RequestTruck,
            MenuToggle, MenuUp, MenuDown, MenuSelect, MenuBack }
        readonly Queue<Pending> _pending = new Queue<Pending>();
        bool _wantStartOnDuty;
        int _errors;
        bool _disabled;

        // hold-to-act
        StepId _holding;
        int _holdStartedAt;
        bool _holdActive;

        Vehicle _requestedTruck;
        readonly Menu _menu = new Menu();
        int _shiftEarnings;
        int _shiftJobs;
        int _lastSlipCheck;

        public Main()
        {
            _cfg = new Config(Settings);
            Log.Init(BaseDirectory, _cfg.LogToFile);
            try { _cfg.EnsureWritten(); }
            catch (Exception ex) { Log.Error("Config.EnsureWritten", ex); }
            _garages = new Garages(Settings);
            Hud.Rich = _cfg.RichHud;
            Log.Write("Version " + Version + ". " + Calls.Count + " calls on the board. RichHud=" + _cfg.RichHud);

            Interval = 0;
            Tick += OnTick;
            KeyDown += OnKeyDown;
            Aborted += OnAborted;

            // Not here: the game may not be ready during construction.
            _wantStartOnDuty = _cfg.StartOnDuty;
        }

        /* --------------------------------------------------------------- duty */

        void GoOnDuty()
        {
            _onDuty = true;
            _errors = 0;
            Log.Write("On duty.");
            _nextCallAt = Game.GameTime + _cfg.FirstCallSeconds * 1000;
            if (_cfg.ShowGarageBlips) _garages.ShowBlips(true);

            // Start the shift at the yard with a truck, the way you would in real
            // life: turn up, sign for the keys, wait for the phone.
            var yard = _garages.ById(_cfg.YardGarage) ?? _garages.ById("yard");
            var existing = Rig.PlayerTruck();
            if (yard != null && existing == null)
            {
                _requestedTruck = Yard.StartShift(yard.Position, _cfg.YardHeading,
                    ParseTruck(_cfg.YardTruck), _cfg.TeleportToYard, null);
                if (_requestedTruck != null)
                {
                    Hud.Dispatch("Clocked on at the yard",
                        "Truck is next to you, keys are in it. First call in about a minute."
                        + "~n~~c~" + _cfg.MenuHint);
                }
                else
                {
                    Hud.Dispatch("Clocked on",
                        "Could not drop a truck here - find one, or use the menu."
                        + "~n~~c~" + _cfg.MenuHint);
                }
            }
            else
            {
                Hud.Dispatch("Clocked on",
                    "You are on the board. First call in about a minute."
                    + "~n~~c~" + _cfg.MenuHint);
            }
        }

        static VehicleHash ParseTruck(string name)
        {
            switch ((name ?? "").Trim().ToLowerInvariant())
            {
                case "towtruck": return VehicleHash.TowTruck;
                case "flatbed": return VehicleHash.Flatbed;
                default: return VehicleHash.TowTruck2;
            }
        }

        void GoOffDuty()
        {
            _onDuty = false;
            Log.Write("Off duty. " + _shiftJobs + " jobs, $" + _shiftEarnings + ".");
            ClearOffer();
            if (_job != null)
            {
                _job.Cleanup(false);
                _job = null;
            }
            _garages.ShowBlips(false);
            _menu.Close();
            if (_requestedTruck != null && _requestedTruck.Exists())
            {
                try
                {
                    if (_requestedTruck.AttachedBlip != null && _requestedTruck.AttachedBlip.Exists())
                        _requestedTruck.AttachedBlip.Delete();
                    _requestedTruck.IsPersistent = false;
                    _requestedTruck.MarkAsNoLongerNeeded();
                }
                catch (Exception ex) { Log.Error("GoOffDuty/truck", ex); }
                _requestedTruck = null;
            }
            Hud.Dispatch("Clocked off",
                string.Format("{0} call{1} tonight, ${2} earned.", _shiftJobs, _shiftJobs == 1 ? "" : "s", _shiftEarnings));
        }

        void OnKeyDown(object sender, KeyEventArgs e)
        {
            // Nothing in here may touch the game.
            if (_disabled) return;

            if (e.KeyCode == _cfg.MenuKey && (!_cfg.MenuNeedsShift || e.Shift))
            {
                _pending.Enqueue(Pending.MenuToggle);
                return;
            }

            if (_menu.IsOpen)
            {
                switch (e.KeyCode)
                {
                    case Keys.Up: case Keys.NumPad8: _pending.Enqueue(Pending.MenuUp); return;
                    case Keys.Down: case Keys.NumPad2: _pending.Enqueue(Pending.MenuDown); return;
                    case Keys.Enter: case Keys.NumPad5: _pending.Enqueue(Pending.MenuSelect); return;
                    case Keys.Back: case Keys.NumPad0: case Keys.Escape: _pending.Enqueue(Pending.MenuBack); return;
                }
            }

            if (e.KeyCode == _cfg.ToggleDutyKey) _pending.Enqueue(Pending.ToggleDuty);
            else if (e.KeyCode == _cfg.AcceptKey) _pending.Enqueue(Pending.Accept);
            else if (e.KeyCode == _cfg.DeclineKey) _pending.Enqueue(Pending.Decline);
            else if (e.KeyCode == _cfg.ElsKey) _pending.Enqueue(Pending.Els);
            else if (e.KeyCode == _cfg.RequestTruckKey) _pending.Enqueue(Pending.RequestTruck);
            else if (e.KeyCode == _cfg.CaptureGarageKey) _pending.Enqueue(Pending.CaptureGarage);
        }

        void DrainKeys()
        {
            while (_pending.Count > 0)
            {
                var action = _pending.Dequeue();
                switch (action)
                {
                    case Pending.MenuToggle:
                        BuildMenu();
                        _menu.Toggle();
                        break;
                    case Pending.MenuUp: _menu.Up(); break;
                    case Pending.MenuDown: _menu.Down(); break;
                    case Pending.MenuSelect: _menu.Select(); BuildMenu(); break;
                    case Pending.MenuBack: _menu.Close(); break;
                    case Pending.ToggleDuty:
                        if (_onDuty) GoOffDuty(); else GoOnDuty();
                        break;
                    case Pending.Accept:
                        if (_onDuty && _offer != null) AcceptOffer();
                        break;
                    case Pending.Decline:
                        if (_onDuty && _offer != null) DeclineOffer();
                        break;
                    case Pending.Els:
                        if (!_onDuty) break;
                        _els = (ElsMode)(((int)_els + 1) % 3);
                        Hud.Subtitle("ELS - " + Rig.ElsLabel(_els), 1800);
                        break;
                    case Pending.RequestTruck:
                        if (_onDuty && _cfg.AllowTruckRequest) RequestTruck();
                        break;
                    case Pending.CaptureGarage:
                        if (!_onDuty) break;
                        var g = _garages.Capture(Game.Player.Character.Position);
                        if (g != null) Hud.Subtitle("Drop-off moved: " + g.Name, 3000);
                        break;
                }
            }
        }

        /// Sends a stock tow truck round - the same towtruck that drives past in
        /// traffic, nothing custom - because hunting for one is not the game.
        void RequestTruck()
        {
            var player = Game.Player.Character;
            if (Rig.PlayerTruck() != null)
            {
                Hud.Subtitle("You are already in a tow truck.", 2500);
                return;
            }

            bool heavy = _job != null && _job.Call.Heavy;
            var hash = heavy ? VehicleHash.Flatbed : VehicleHash.TowTruck;
            var model = new Model(hash);
            model.Request(3000);
            if (!model.IsValid || !model.IsLoaded)
            {
                Hud.Subtitle("No truck available right now.", 2500);
                return;
            }

            var spot = World.GetNextPositionOnStreet(player.Position + player.ForwardVector * 12f, true);
            if (spot == Vector3.Zero) spot = player.Position + player.ForwardVector * 8f;
            var truck = World.CreateVehicle(model, spot, player.Heading);
            model.MarkAsNoLongerNeeded();
            if (truck == null || !truck.Exists())
            {
                Hud.Subtitle("No room to drop a truck here.", 2500);
                return;
            }

            truck.PlaceOnGround();
            truck.IsPersistent = true;
            if (_requestedTruck != null && _requestedTruck.Exists()) _requestedTruck.MarkAsNoLongerNeeded();
            _requestedTruck = truck;

            var blip = truck.AddBlip();
            if (blip != null && blip.Exists())
            {
                blip.Sprite = BlipSprite.TowTruck;
                blip.Color = BlipColor.Blue;
                blip.Name = "Your tow truck";
                blip.IsShortRange = true;
            }
            Log.Write("Dropped a " + hash + " for the player.");
            Hud.Dispatch("Truck dropped off", (heavy ? "Flatbed" : "Tow truck") + " is round the corner. Keys are in it.");
        }

        /// Rebuilt whenever it opens or an item is chosen, so labels and greyed-out
        /// states always reflect the shift as it stands.
        void BuildMenu()
        {
            _menu.Items.Clear();
            _menu.Title = "LOS SANTOS TOWING";
            _menu.Subtitle = _onDuty
                ? (_job != null ? "On a job - " + _job.Call.KindLabel
                    : _offer != null ? "Call ringing" : "On duty, waiting on dispatch")
                : "Off duty";

            _menu.Items.Add(new MenuItem(
                _onDuty ? "Clock off" : "Clock on",
                _onDuty ? "End the shift. Anything outstanding is dropped."
                        : "Start a shift at the yard with a truck.",
                () => { if (_onDuty) GoOffDuty(); else GoOnDuty(); _menu.Close(); }));

            _menu.Items.Add(new MenuItem("Request a call",
                "Ask dispatch for work now instead of waiting.",
                () => { _nextCallAt = 0; _menu.Close(); },
                () => _offer != null ? "ringing" : _job != null ? "on a job" : "",
                () => _onDuty && _job == null && _offer == null));

            _menu.Items.Add(new MenuItem("Accept the call",
                "Take the call that is ringing.",
                () => { AcceptOffer(); _menu.Close(); },
                null, () => _offer != null));

            _menu.Items.Add(new MenuItem("Turn the call down",
                "Pass it to somebody else.",
                () => { DeclineOffer(); },
                null, () => _offer != null));

            _menu.Items.Add(new MenuItem("Drop this job",
                "Cancel the job you are on. No pay, no penalty.",
                () => { AbandonJob(); },
                null, () => _job != null));

            _menu.Items.Add(new MenuItem("Amber lights",
                "Off, steady, or the slow wig-wag.",
                () => { _els = (ElsMode)(((int)_els + 1) % 3); },
                () => Rig.ElsLabel(_els)));

            _menu.Items.Add(new MenuItem("Bring me a truck",
                "Drops a stock tow truck on the road next to you.",
                () => { RequestTruck(); _menu.Close(); },
                () => _cfg.YardTruck,
                () => _cfg.AllowTruckRequest));

            _menu.Items.Add(new MenuItem("Change truck",
                "Which truck the yard hands you: tow truck, the older one, or the flatbed.",
                () =>
                {
                    _cfg.YardTruck = _cfg.YardTruck == "towtruck2" ? "towtruck"
                        : _cfg.YardTruck == "towtruck" ? "flatbed" : "towtruck2";
                    _cfg.EnsureWritten();
                },
                () => _cfg.YardTruck));

            _menu.Items.Add(new MenuItem("Fix the truck",
                "Repairs and cleans the truck you are in.",
                () =>
                {
                    var t = Rig.PlayerTruck();
                    if (t != null)
                    {
                        t.Repair();
                        Function.Call(Hash.SET_VEHICLE_DIRT_LEVEL, t, 0f);
                        Hud.Subtitle("Truck patched up.", 2500);
                    }
                },
                null, () => Rig.PlayerTruck() != null));

            _menu.Items.Add(new MenuItem("Go to the yard",
                "Teleports you (and the truck you are in) back to the yard.",
                () =>
                {
                    var yard = _garages.ById(_cfg.YardGarage) ?? _garages.ById("yard");
                    if (yard != null) { _menu.Close(); Yard.Teleport(yard.Position, _cfg.YardHeading); }
                }));

            _menu.Items.Add(new MenuItem("Go to the call",
                "Skips the drive. Puts you at the scene.",
                () =>
                {
                    if (_job != null) { _menu.Close(); Yard.Teleport(_job.ScenePosition + new Vector3(6f, 0f, 0f), _job.SceneHeading); }
                },
                null, () => _job != null));

            _menu.Items.Add(new MenuItem("Set the yard here",
                "Uses where you are standing as the yard from now on.",
                () =>
                {
                    var g = _garages.Capture(Game.Player.Character.Position, _cfg.YardGarage);
                    if (g != null)
                    {
                        _cfg.YardHeading = Game.Player.Character.Heading;
                        _cfg.EnsureWritten();
                        Hud.Subtitle("Yard set here.", 3000);
                    }
                }));

            _menu.Items.Add(new MenuItem("Move nearest drop-off here",
                "Fixes a garage marker that sits in a wall.",
                () =>
                {
                    var g = _garages.Capture(Game.Player.Character.Position);
                    if (g != null) Hud.Subtitle("Drop-off moved: " + g.Name, 3000);
                }));

            _menu.Items.Add(new MenuItem("Garage blips",
                "Grey blips on every drop-off.",
                () =>
                {
                    _cfg.ShowGarageBlips = !_cfg.ShowGarageBlips;
                    _garages.ShowBlips(_cfg.ShowGarageBlips && _onDuty);
                    _cfg.EnsureWritten();
                },
                () => _cfg.ShowGarageBlips ? "on" : "off"));

            _menu.Items.Add(new MenuItem("Shift so far",
                "What you have done since clocking on.",
                () => Hud.Dispatch("Shift so far",
                    _shiftJobs + " job" + (_shiftJobs == 1 ? "" : "s") + ", $" + _shiftEarnings + " earned."),
                () => "$" + _shiftEarnings));
        }

        void AbandonJob()
        {
            if (_job == null) return;
            Log.Write("Player dropped job " + _job.Call.Id);
            Rig.ForgetFlatbedLoad();
            _job.Cleanup(false);
            _job = null;
            _nextCallAt = Game.GameTime + _cfg.CallGapSeconds * 1000;
            Hud.Note("Job dropped. Dispatch will find somebody else.");
        }

        void OnAborted(object sender, EventArgs e)
        {
            if (_requestedTruck != null && _requestedTruck.Exists()) _requestedTruck.MarkAsNoLongerNeeded();
            if (_job != null) _job.Cleanup(false);
            _garages.ShowBlips(false);
            Rig.ForgetFlatbedLoad();
        }

        /* --------------------------------------------------------------- tick */

        void OnTick(object sender, EventArgs e)
        {
            if (_disabled) return;
            try
            {
                TickBody();
            }
            catch (Exception ex)
            {
                _errors++;
                Log.Error("OnTick", ex);
                if (_errors >= 5)
                {
                    _disabled = true;
                    Log.Write("Too many errors - shutting the script down. Nothing else will run this session.");
                    try { Hud.Note("Los Santos Towing hit an error and stopped. See LosSantosTowing.log."); } catch { }
                    try { if (_job != null) _job.Cleanup(false); _garages.ShowBlips(false); } catch { }
                }
            }
        }

        void TickBody()
        {
            if (Game.IsLoading) return;

            var player = Game.Player.Character;
            if (player == null || !player.Exists()) return;

            DrainKeys();

            if (_menu.IsOpen)
            {
                _menu.Draw();
                // Stop the shooting/attack controls firing behind the menu.
                Game.DisableControlThisFrame(Control.Attack);
                Game.DisableControlThisFrame(Control.Aim);
                Game.DisableControlThisFrame(Control.VehicleAim);
                Game.DisableControlThisFrame(Control.MeleeAttack1);
            }

            if (_wantStartOnDuty)
            {
                _wantStartOnDuty = false;
                GoOnDuty();
            }

            if (!_onDuty || Game.IsPaused || player.IsDead) return;

            var truck = Rig.PlayerTruck();
            if (truck != null) Rig.ApplyEls(truck, _els, Game.GameTime);

            if (_job != null) RunJob(player, truck);
            else if (_offer != null) RunOffer();
            else if (Game.GameTime >= _nextCallAt) MakeOffer(player);
        }

        /* -------------------------------------------------------------- calls */

        void MakeOffer(Ped player)
        {
            var call = Calls.Pick(_rng, _used);
            Vector3 scene;
            float heading;
            if (!FindScene(player.Position, call, out scene, out heading))
            {
                _nextCallAt = Game.GameTime + 10000;   // nowhere to put it; try again shortly
                return;
            }

            _offer = call;
            _offerScene = scene;
            _offerHeading = heading;
            _offerGarage = call.Garage != null ? _garages.ById(call.Garage) : null;
            if (_offerGarage == null) _offerGarage = _garages.Random(_rng);
            _offerExpiresAt = Game.GameTime + 30000;

            Hud.PlayBeep();
            Hud.Dispatch(call.KindLabel + " - $" + call.Pay,
                call.Text + "~n~~c~Caller: " + call.Caller + "  -  To: " + _offerGarage.Name);
        }

        void RunOffer()
        {
            Hud.Prompt(string.Format("~y~{0}~s~  ${1}  -  {2}~n~Press ~b~{3}~s~ to accept, ~b~{4}~s~ to pass.",
                _offer.KindLabel, _offer.Pay, _offerGarage.Name, _cfg.AcceptKey, _cfg.DeclineKey));
            if (Game.GameTime > _offerExpiresAt)
            {
                Hud.Note("Call went to somebody else.");
                ClearOffer();
                _nextCallAt = Game.GameTime + _cfg.CallGapSeconds * 1000;
            }
        }

        void AcceptOffer()
        {
            var call = _offer;
            var garage = _offerGarage;
            var scene = _offerScene;
            float heading = _offerHeading;
            ClearOffer();

            var model = new Model(call.Model);
            model.Request(4000);
            if (!model.IsValid || !model.IsLoaded)
            {
                Hud.Note("Could not get a vehicle out there. Dispatch will call back.");
                _nextCallAt = Game.GameTime + 15000;
                return;
            }

            Function.Call(Hash.CLEAR_AREA_OF_VEHICLES, scene.X, scene.Y, scene.Z, 6f, false, false, false, false, false);
            var casualty = World.CreateVehicle(model, scene, heading);
            model.MarkAsNoLongerNeeded();
            if (casualty == null || !casualty.Exists())
            {
                Hud.Note("Could not get a vehicle out there. Dispatch will call back.");
                _nextCallAt = Game.GameTime + 15000;
                return;
            }

            // Spawned up to a mile away, so ask the game to stream collision in
            // around it — otherwise it can drop through an unloaded road.
            Function.Call(Hash.SET_ENTITY_LOAD_COLLISION_FLAG, casualty, true);
            Function.Call(Hash.REQUEST_COLLISION_AT_COORD, scene.X, scene.Y, scene.Z);
            Rig.Prepare(casualty, call, _rng);

            _job = new Job
            {
                Call = call,
                Garage = garage,
                ScenePosition = casualty.Position,
                SceneHeading = heading,
                Casualty = casualty,
                Steps = Steps.For(call, _cfg.ChainsRequired),
                StartedAt = Game.GameTime,
            };
            _used.Add(call.Id);
            Log.Write("Accepted " + call.Id + " (" + call.Model + ") at " + scene + " -> " + garage.Name);

            _job.SceneBlip = World.CreateBlip(_job.ScenePosition);
            _job.SceneBlip.Sprite = BlipSprite.TowTruck;
            _job.SceneBlip.Color = BlipColor.Yellow;
            _job.SceneBlip.Name = "Tow call - " + call.KindLabel;
            _job.SceneBlip.ShowRoute = true;

            string hint = Rig.PlayerTruck() == null && Rig.NearestTruck(Game.Player.Character.Position, 60f) == null
                ? "~n~~c~You will need a tow truck - press " + _cfg.RequestTruckKey + " to have one sent out."
                : "";
            Hud.Dispatch("Call accepted", call.Text + hint);
        }

        void DeclineOffer()
        {
            ClearOffer();
            _nextCallAt = Game.GameTime + _cfg.CallGapSeconds * 1000;
            Hud.Note("Passed. Somebody else will take it.");
        }

        void ClearOffer()
        {
            _offer = null;
            _offerGarage = null;
        }

        /// Puts the casualty on a real road: pick a point out at the right sort of
        /// distance and let the game snap it to the nearest street node.
        bool FindScene(Vector3 from, Call call, out Vector3 scene, out float heading)
        {
            for (int attempt = 0; attempt < 12; attempt++)
            {
                double angle = _rng.NextDouble() * Math.PI * 2.0;
                float distance = _cfg.MinCallDistance +
                    (float)_rng.NextDouble() * Math.Max(1f, _cfg.MaxCallDistance - _cfg.MinCallDistance);
                var guess = new Vector3(
                    from.X + (float)Math.Cos(angle) * distance,
                    from.Y + (float)Math.Sin(angle) * distance,
                    from.Z);

                var onStreet = World.GetNextPositionOnStreet(guess, true);
                if (onStreet == Vector3.Zero) continue;
                if (onStreet.DistanceTo(from) < _cfg.MinCallDistance * 0.6f) continue;

                scene = onStreet;
                heading = (float)(_rng.NextDouble() * 360.0);
                return true;
            }
            scene = Vector3.Zero;
            heading = 0f;
            return false;
        }

        /* ---------------------------------------------------------- the job */

        void RunJob(Ped player, Vehicle truck)
        {
            var job = _job;
            var casualty = job.Casualty;

            if (casualty == null || !casualty.Exists() || casualty.IsDead)
            {
                Hud.Dispatch("Call cancelled", "The vehicle is gone. Dispatch will find you another one.");
                job.Cleanup(false);
                _job = null;
                _nextCallAt = Game.GameTime + _cfg.CallGapSeconds * 1000;
                return;
            }

            Hud.Checklist(job);

            float toScene = player.Position.DistanceTo(casualty.Position);
            if (!job.ArrivedOnScene && toScene < _cfg.SceneRadius)
            {
                job.ArrivedOnScene = true;
                if (job.SceneBlip != null && job.SceneBlip.Exists()) job.SceneBlip.ShowRoute = false;
                // Settle it onto road that has definitely streamed in by now,
                // unless the call is a rollover and it is meant to be on its side.
                if (job.Call.Damage != Damage.Rollover) casualty.PlaceOnGround();
                Hud.Subtitle("~y~" + job.Call.Caller + ":~s~ " + job.Call.Text, 6000);
            }

            // Unsecured loads wander. Check a few times a second, not every frame.
            if (Game.GameTime - _lastSlipCheck > 400)
            {
                _lastSlipCheck = Game.GameTime;
                if (_cfg.UnsecuredLoadsFall && truck != null &&
                    Rig.CheckLoadSlip(truck, job.Chains, _cfg.ChainsRequired, _rng))
                {
                    job.DamageBill += 60;
                    job.Chains = 0;
                    job.Undo(StepId.Chains);
                    job.Undo(StepId.Deliver);
                    Hud.Dispatch("You lost the load", "It came off the back. Hook it again - and chain it down this time.");
                }
            }

            HandleDelivery(player, truck, job, casualty);
            HandleInteractions(player, truck, job, casualty);
        }

        void HandleDelivery(Ped player, Vehicle truck, Job job, Vehicle casualty)
        {
            if (!job.Has(StepId.Deliver)) return;

            // The route blip only appears once there is something to deliver.
            bool hooked = truck != null && Rig.TowedBy(truck) == casualty;
            bool drivingItIn = player.IsInVehicle(casualty);
            if ((hooked || drivingItIn) && job.GarageBlip == null)
            {
                job.GarageBlip = World.CreateBlip(job.Garage.Position);
                job.GarageBlip.Sprite = BlipSprite.Garage;
                job.GarageBlip.Color = BlipColor.Green;
                job.GarageBlip.Name = job.Garage.Name;
                job.GarageBlip.ShowRoute = true;
            }

            if (!hooked && !drivingItIn) return;

            // Driving the customer's car in yourself covers the hook and chains.
            if (drivingItIn)
            {
                job.Complete(StepId.Hook);
                job.Chains = _cfg.ChainsRequired;
                job.Complete(StepId.Chains);
            }

            float toGarage = casualty.Position.DistanceTo(job.Garage.Position);
            if (toGarage > _cfg.DropRadius * 3f) return;

            Hud.Marker(job.Garage.Position, 60, 200, 110);
            if (toGarage > _cfg.DropRadius) return;

            // Arriving is not the same as finishing: anything still open on the
            // checklist (chains, most often) has to be done before it comes off.
            bool ready = !job.Steps.Any(s => !s.Done && s.Id != StepId.Deliver && s.Id != StepId.Drop);
            if (!ready)
            {
                Hud.Prompt("Finish the job before you drop it - " + job.Current.Text.ToLowerInvariant() + ".");
                return;
            }

            job.Complete(StepId.Deliver);

            var mover = drivingItIn ? casualty : truck;
            if (mover != null && mover.Speed > 1.5f)
            {
                Hud.Prompt("Stop in the bay to drop it off.");
                return;
            }

            Hud.Prompt("Press ~INPUT_CONTEXT~ to drop it off at " + job.Garage.Name + ".");
            if (Game.IsControlJustPressed(Control.Context))
            {
                if (hooked) Rig.Unhook(truck);
                job.Complete(StepId.Drop);
                FinishJob(job);
            }
        }

        void HandleInteractions(Ped player, Vehicle truck, Job job, Vehicle casualty)
        {
            var current = job.Current;
            if (current == null) return;

            float toCasualty = player.Position.DistanceTo(casualty.Position);
            bool onFoot = !player.IsInVehicle();

            switch (current.Id)
            {
                case StepId.Cones:
                    if (onFoot && toCasualty < 30f)
                    {
                        Hud.Prompt("Press ~INPUT_CONTEXT~ to set a cone down. (" + job.Cones.Count + "/2)");
                        if (Game.IsControlJustPressed(Control.Context)) PlaceCone(player, job);
                    }
                    break;

                case StepId.JumpPack:
                    if (onFoot && truck == null)
                    {
                        var nearTruck = Rig.NearestTruck(player.Position, 7f, casualty);
                        if (nearTruck != null)
                        {
                            Hud.Prompt("Press ~INPUT_CONTEXT~ to grab the jump pack.");
                            if (Game.IsControlJustPressed(Control.Context))
                            {
                                job.CarryingJumpPack = true;
                                job.Complete(StepId.JumpPack);
                                Hud.Subtitle("Jump pack in hand.", 2500);
                            }
                        }
                    }
                    break;

                case StepId.Hood:
                    if (onFoot && NearFront(player, casualty, 3.5f))
                    {
                        Hud.Prompt("Press ~INPUT_CONTEXT~ to pop the hood.");
                        if (Game.IsControlJustPressed(Control.Context))
                        {
                            casualty.Doors[VehicleDoorIndex.Hood].Open(false, false);
                            job.Complete(StepId.Hood);
                        }
                    }
                    break;

                case StepId.Clamps:
                    if (onFoot && job.CarryingJumpPack && NearFront(player, casualty, 3.5f))
                        Hold(job, StepId.Clamps, 2500, "clamping the leads on", () =>
                        {
                            job.Complete(StepId.Clamps);
                            Hud.Subtitle("Red to positive, black to ground. Give it a second.", 3000);
                        });
                    break;

                case StepId.Crank:
                    if (onFoot && toCasualty < 5f)
                        Hold(job, StepId.Crank, 1800, "cranking it over", () =>
                        {
                            Rig.Revive(casualty);
                            job.Jumped = true;
                            job.CarryingJumpPack = false;
                            job.Complete(StepId.Crank);
                            Hud.Subtitle("It caught. Hook it, or drive it in yourself.", 4000);
                        });
                    break;

                case StepId.Righting:
                    if (onFoot && toCasualty < 6f)
                        Hold(job, StepId.Righting, 3000, "rolling it back over", () =>
                        {
                            Rig.RollUpright(casualty);
                            job.Complete(StepId.Righting);
                        });
                    break;

                case StepId.Unlock:
                    if (onFoot && toCasualty < 4f)
                        Hold(job, StepId.Unlock, 3000, "working the door open", () =>
                        {
                            Rig.Unlock(casualty);
                            job.Complete(StepId.Unlock);
                            FinishJob(job);
                        });
                    break;

                case StepId.Fuel:
                    if (onFoot && toCasualty < 4f)
                        Hold(job, StepId.Fuel, 2600, "pouring the can in", () =>
                        {
                            casualty.FuelLevel = 65f;
                            Rig.Revive(casualty);
                            job.Complete(StepId.Fuel);
                            if (job.IsDone) FinishJob(job);
                        });
                    break;

                case StepId.TyreOff:
                    if (onFoot && toCasualty < 4f)
                        Hold(job, StepId.TyreOff, 2600, "running the lug nuts off", () =>
                        {
                            job.Complete(StepId.TyreOff);
                        });
                    break;

                case StepId.SpareOn:
                    if (onFoot && toCasualty < 4f)
                        Hold(job, StepId.SpareOn, 2600, "fitting the spare", () =>
                        {
                            Rig.FixTyres(casualty);
                            job.Complete(StepId.SpareOn);
                            if (job.IsDone) FinishJob(job);
                        });
                    break;

                case StepId.Hook:
                    if (truck != null)
                    {
                        float truckToCar = truck.Position.DistanceTo(casualty.Position);
                        if (truckToCar < 12f)
                        {
                            Hud.Prompt("Press ~INPUT_CONTEXT~ to hook it up.");
                            if (Game.IsControlJustPressed(Control.Context))
                            {
                                if (Rig.Hook(truck, casualty))
                                {
                                    job.Complete(StepId.Hook);
                                    Hud.Subtitle("Hooked. Chain it down before you go anywhere.", 4000);
                                }
                                else Hud.Subtitle("Get the back of the truck closer to it.", 3000);
                            }
                        }
                        else if (truck.Position.DistanceTo(casualty.Position) < 45f)
                        {
                            Hud.Prompt("Back the truck up to it.");
                        }
                    }
                    else if (onFoot && toCasualty < 25f)
                    {
                        Hud.Prompt("Bring a tow truck up to it.");
                    }
                    break;

                case StepId.Chains:
                    if (onFoot && truck == null)
                    {
                        // The closest vehicle to the casualty is the casualty, so
                        // look specifically for a tow truck holding it.
                        var nearTruck = Rig.NearestTruck(casualty.Position, 16f, casualty);
                        bool loadIsOn = nearTruck != null && Rig.TowedBy(nearTruck) == casualty;
                        if (loadIsOn && toCasualty < 6f)
                        {
                            Hold(job, StepId.Chains, 1400,
                                "chaining it down (" + job.Chains + "/" + _cfg.ChainsRequired + ")", () =>
                                {
                                    job.Chains++;
                                    if (job.Chains >= _cfg.ChainsRequired)
                                    {
                                        job.Complete(StepId.Chains);
                                        Hud.Subtitle("All " + _cfg.ChainsRequired + " points on. That is not going anywhere.", 3500);
                                    }
                                });
                        }
                    }
                    else if (truck != null && truck.Speed < 2f && Rig.TowedBy(truck) == casualty)
                    {
                        Hud.Prompt("Get out and chain the load down.");
                    }
                    break;
            }
        }

        void PlaceCone(Ped player, Job job)
        {
            var model = new Model(_cfg.ConeModel);
            if (!model.IsValid)
            {
                // No cone in this install - do not block the job on scenery.
                job.Complete(StepId.Cones);
                return;
            }
            model.Request(2000);
            if (!model.IsLoaded)
            {
                job.Complete(StepId.Cones);
                return;
            }

            var spot = player.Position + player.ForwardVector * 1.2f;
            var cone = World.CreateProp(model, spot, false, true);
            model.MarkAsNoLongerNeeded();
            if (cone != null && cone.Exists()) job.Cones.Add(cone);
            if (job.Cones.Count >= 2)
            {
                job.Complete(StepId.Cones);
                Hud.Subtitle("Scene is coned off.", 2500);
            }
        }

        /// Shared hold-to-act: press and hold the context control for a while.
        void Hold(Job job, StepId id, int milliseconds, string label, Action done)
        {
            if (_holding != id || !_holdActive)
            {
                _holding = id;
                _holdActive = false;
            }

            if (Game.IsControlPressed(Control.Context))
            {
                if (!_holdActive)
                {
                    _holdActive = true;
                    _holdStartedAt = Game.GameTime;
                }
                int elapsed = Game.GameTime - _holdStartedAt;
                int pct = Math.Min(100, elapsed * 100 / milliseconds);
                Hud.Prompt("Hold ~INPUT_CONTEXT~ - " + label + "  " + pct + "%");
                if (elapsed >= milliseconds)
                {
                    _holdActive = false;
                    done();
                }
            }
            else
            {
                _holdActive = false;
                Hud.Prompt("Hold ~INPUT_CONTEXT~ - " + label);
            }
        }

        void FinishJob(Job job)
        {
            bool hazard = World.Weather == Weather.Raining || World.Weather == Weather.ThunderStorm
                || World.Weather == Weather.Blizzard || World.Weather == Weather.Snowing
                || World.Weather == Weather.Foggy;
            int pay = job.Payout(_cfg.PayMultiplier, hazard);

            Game.Player.Money += pay;
            _shiftEarnings += pay;
            _shiftJobs++;

            Hud.PlayCash();
            Hud.Dispatch("Job closed - $" + pay,
                job.Call.Caller + " is squared away." +
                (job.DamageBill > 0 ? "  ~r~-$" + job.DamageBill + " damage.~s~" : ""));

            Rig.ForgetFlatbedLoad();
            job.Cleanup(true);          // the car stays at the shop, the game can clear it
            _job = null;
            _nextCallAt = Game.GameTime + _cfg.CallGapSeconds * 1000;
        }

        static bool NearFront(Ped player, Vehicle vehicle, float radius)
        {
            var nose = vehicle.Position + vehicle.ForwardVector * (vehicle.Model.Dimensions.frontTopRight.Y);
            return player.Position.DistanceTo(nose) < radius;
        }
    }
}
