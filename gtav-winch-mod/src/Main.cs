using System;
using System.Collections.Generic;
using System.Windows.Forms;
using GTA;
using GTA.Math;
using GTA.Native;
using GTA.UI;

namespace WinchMod
{
    public class WinchMain : Script
    {
        private readonly List<WinchLine> _lines = new List<WinchLine>();
        private AttachPoint _pending;
        private bool _mouseMode;
        private int _lastTextureRequest;

        public WinchMain()
        {
            Log.Try("loading the config", Config.Load);
            Interval = 0;
            Tick += OnTick;
            KeyDown += OnKeyDown;
            Aborted += OnAborted;
        }

        private void OnTick(object sender, EventArgs e)
        {
            Log.Try("the update loop", Update);
        }

        private void Update()
        {
            EnsureRopeTextures();

            float dt = Game.LastFrameTime;
            PruneLines();

            if (_mouseMode)
                MouseModeInput();

            WinchLine active = ActiveLine();
            if (active != null)
                HandleSpooling(active, dt);

            for (int i = 0; i < _lines.Count; i++)
                _lines[i].Update(dt);

            if (_pending != null && !_pending.IsValid)
            {
                _pending.Cleanup();
                _pending = null;
            }

            Hud.Draw(_lines, _pending, active, _mouseMode, AimPoint());
        }

        private void OnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Config.AttachKey)
            {
                // With mouse select on, this key is the mode toggle and the clicks do
                // the picking; with it off the key sets the points on its own.
                if (Config.MouseSelect)
                    Log.Try("toggling winch mode", ToggleMouseMode);
                else
                    Log.Try("setting an attach point", Attach);
            }
            else if (e.KeyCode == Config.CutKey)
                Log.Try("cutting a rope", CutAimed);
            else if (e.KeyCode == Config.CutAllKey)
                Log.Try("cutting every rope", delegate { CutAll(true); });
            else if (e.KeyCode == Config.StrapKey)
                Log.Try("strapping the load", ToggleStrap);
            else if (e.KeyCode == Config.ReloadConfigKey)
                Log.Try("reloading the config", ReloadConfig);
        }

        private void OnAborted(object sender, EventArgs e)
        {
            Log.Try("shutting down", delegate
            {
                CutAll(false);
                if (_pending != null)
                {
                    _pending.Cleanup();
                    _pending = null;
                }
                Function.Call(Hash.ROPE_UNLOAD_TEXTURES);
            });
        }

        // ---- mouse -------------------------------------------------------------

        private void ToggleMouseMode()
        {
            _mouseMode = !_mouseMode;

            if (!_mouseMode && _pending != null)
            {
                _pending.Cleanup();
                _pending = null;
            }

            Notification.Show(_mouseMode
                ? "~g~Winch~s~: on. Left click sets a point, right click cuts, wheel spools."
                : "~y~Winch~s~: off");
        }

        private void MouseModeInput()
        {
            // Hold the mouse for the winch so clicking does not also fire your weapon.
            Controls.BlockThisFrame();

            if (Controls.JustPressed(Controls.Attack) || Controls.JustPressed(Controls.VehicleAttack))
                Attach();

            if (Controls.JustPressed(Controls.Aim) || Controls.JustPressed(Controls.VehicleAim))
                CutAimed();

            int wheel = Controls.WheelDelta();
            if (wheel != 0)
            {
                WinchLine line = ActiveLine();
                if (line != null)
                    line.Spool(wheel > 0 ? -Config.WheelSpoolStep : Config.WheelSpoolStep);
            }
        }

        /// <summary>Where the player is looking, for the crosshair and the preview line.</summary>
        private Vector3 AimPoint()
        {
            if (!_mouseMode && _pending == null)
                return Vector3.Zero;

            Aiming.Hit hit = Aiming.AimRay();
            return hit.DidHit ? hit.Position : Vector3.Zero;
        }

        // ---- actions -----------------------------------------------------------

        private void ReloadConfig()
        {
            Config.Load();
            Notification.Show("~y~Winch~s~: config reloaded");
        }

        private void EnsureRopeTextures()
        {
            if (Function.Call<bool>(Hash.ROPE_ARE_TEXTURES_LOADED))
                return;
            if (Game.GameTime - _lastTextureRequest < 500)
                return;
            _lastTextureRequest = Game.GameTime;
            Function.Call(Hash.ROPE_LOAD_TEXTURES);
        }

        private void Attach()
        {
            string label;
            AttachPoint point = Aiming.PickAttachPoint(out label);
            if (point == null)
            {
                Notification.Show("~y~Winch~s~: nothing in range to hook onto");
                return;
            }

            if (_pending == null)
            {
                if (_lines.Count >= Config.MaxLines)
                {
                    point.Cleanup();
                    Notification.Show("~y~Winch~s~: all " + Config.MaxLines + " lines are already out");
                    return;
                }
                _pending = point;
                Notification.Show("~y~Winch~s~: first point on the " + label);
                return;
            }

            if (SamePoint(_pending, point))
            {
                point.Cleanup();
                Notification.Show("~y~Winch~s~: pick a second point somewhere else");
                return;
            }

            if (_pending.IsAnchor && point.IsAnchor)
            {
                point.Cleanup();
                _pending.Cleanup();
                _pending = null;
                Notification.Show("~y~Winch~s~: both ends were fixed - nothing to pull");
                return;
            }

            WinchLine line = WinchLine.Create(_pending, point);
            if (line == null)
            {
                point.Cleanup();
                _pending.Cleanup();
                _pending = null;
                Notification.Show("~r~Winch~s~: could not create the rope");
                return;
            }

            _lines.Add(line);
            _pending = null;
            Notification.Show(string.Format("~g~Winch~s~: hooked {0} to {1} ({2:0.0} m)",
                line.A.Describe(), line.B.Describe(), line.Length));
        }

        private static bool SamePoint(AttachPoint a, AttachPoint b)
        {
            if (a == null || b == null || !a.IsValid || !b.IsValid)
                return false;
            if (a.Entity.Handle != b.Entity.Handle)
                return false;
            return (a.LocalOffset - b.LocalOffset).Length() < 0.35f;
        }

        private void CutAimed()
        {
            if (_pending != null)
            {
                _pending.Cleanup();
                _pending = null;
                Notification.Show("~y~Winch~s~: first point cleared");
                return;
            }

            WinchLine line = Aiming.PickLine(_lines);
            if (line == null)
            {
                Notification.Show("~y~Winch~s~: no rope in front of you");
                return;
            }

            // Off the list first: whatever happens in Cut, the line is not coming back.
            _lines.Remove(line);
            line.Cut();
            Notification.Show("~y~Winch~s~: rope cut");
        }

        private void CutAll(bool notify)
        {
            WinchLine[] doomed = _lines.ToArray();
            _lines.Clear();

            for (int i = 0; i < doomed.Length; i++)
            {
                try { doomed[i].Cut(); }
                catch (Exception ex) { Log.Write("cutting every rope", ex); }
            }

            if (notify && doomed.Length > 0)
                Notification.Show("~y~Winch~s~: cut " + doomed.Length + (doomed.Length == 1 ? " rope" : " ropes"));
        }

        private void ToggleStrap()
        {
            WinchLine line = Aiming.PickLine(_lines);
            if (line == null)
                line = ActiveLine();
            if (line == null)
            {
                Notification.Show("~y~Winch~s~: no line to strap");
                return;
            }

            bool wasStrapped = line.Strapped;
            bool nowStrapped = line.ToggleStrap();

            if (nowStrapped)
                Notification.Show("~g~Winch~s~: load strapped to the bed");
            else if (wasStrapped)
                Notification.Show("~y~Winch~s~: load released");
            else
                Notification.Show("~y~Winch~s~: winch it further onto the bed first");
        }

        private void PruneLines()
        {
            for (int i = _lines.Count - 1; i >= 0; i--)
            {
                WinchLine line = _lines[i];
                if (line.EndsAlive && !line.Broken)
                    continue;

                bool broke = line.Broken;
                _lines.RemoveAt(i);

                try { line.Cut(); }
                catch (Exception ex) { Log.Write("tidying up a dead line", ex); }

                if (broke)
                    Notification.Show("~r~Winch~s~: the rope snapped under the load");
            }
        }

        /// <summary>
        /// The line the spool controls act on: whatever is tied to the vehicle you are
        /// in, then whatever is tied to you, then the closest line.
        /// </summary>
        private WinchLine ActiveLine()
        {
            if (_lines.Count == 0)
                return null;

            Ped player = Game.Player.Character;
            if (player == null || !player.Exists())
                return null;

            Vehicle inside = player.CurrentVehicle;
            if (inside != null && inside.Exists())
            {
                for (int i = 0; i < _lines.Count; i++)
                    if (_lines[i].Involves(inside))
                        return _lines[i];
            }

            for (int i = 0; i < _lines.Count; i++)
                if (_lines[i].Involves(player))
                    return _lines[i];

            WinchLine best = null;
            float bestDist = float.MaxValue;
            for (int i = 0; i < _lines.Count; i++)
            {
                WinchLine line = _lines[i];
                if (!line.EndsAlive) continue;
                Vector3 mid = (line.A.WorldPosition + line.B.WorldPosition) * 0.5f;
                float d = (mid - player.Position).Length();
                if (d < bestDist)
                {
                    bestDist = d;
                    best = line;
                }
            }
            return best;
        }

        private void HandleSpooling(WinchLine line, float dt)
        {
            bool inKey = Game.IsKeyPressed(Config.SpoolInKey);
            bool outKey = Game.IsKeyPressed(Config.SpoolOutKey);
            if (inKey == outKey)
                return;

            line.Spool(inKey ? -Config.SpoolSpeed * dt : Config.SpoolSpeed * dt);
        }
    }
}
