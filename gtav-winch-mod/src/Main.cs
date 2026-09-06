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
        private int _lastTextureRequest;

        public WinchMain()
        {
            Config.Load();
            Interval = 0;
            Tick += OnTick;
            KeyDown += OnKeyDown;
            Aborted += OnAborted;
        }

        private void OnTick(object sender, EventArgs e)
        {
            EnsureRopeTextures();

            float dt = Game.LastFrameTime;
            PruneLines();

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

            Hud.Draw(_lines, _pending, active);
        }

        private void OnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Config.AttachKey)
                Attach();
            else if (e.KeyCode == Config.CutKey)
                CutAimed();
            else if (e.KeyCode == Config.CutAllKey)
                CutAll(true);
            else if (e.KeyCode == Config.StrapKey)
                ToggleStrap();
            else if (e.KeyCode == Config.ReloadConfigKey)
            {
                Config.Load();
                Notification.Show("~y~Winch~s~: config reloaded");
            }
        }

        private void OnAborted(object sender, EventArgs e)
        {
            CutAll(false);
            if (_pending != null)
            {
                _pending.Cleanup();
                _pending = null;
            }
            Function.Call(Hash.ROPE_UNLOAD_TEXTURES);
        }

        // -------------------------------------------------------------------

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
            if (!a.IsValid || !b.IsValid)
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

            line.Cut();
            _lines.Remove(line);
            Notification.Show("~y~Winch~s~: rope cut");
        }

        private void CutAll(bool notify)
        {
            for (int i = 0; i < _lines.Count; i++)
                _lines[i].Cut();
            int count = _lines.Count;
            _lines.Clear();
            if (notify && count > 0)
                Notification.Show("~y~Winch~s~: cut " + count + (count == 1 ? " rope" : " ropes"));
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
                line.Cut();
                _lines.RemoveAt(i);
                if (broke)
                    Notification.Show("~r~Winch~s~: the rope snapped under the load");
            }
        }

        /// <summary>
        /// The line the spool keys act on: whatever is tied to the vehicle you are in,
        /// then whatever is tied to you, then the closest line.
        /// </summary>
        private WinchLine ActiveLine()
        {
            if (_lines.Count == 0)
                return null;

            Ped player = Game.Player.Character;
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
