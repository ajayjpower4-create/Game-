using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Windows.Forms;
using GTA;
using GTA.Math;
using GTA.UI;
using Font = GTA.UI.Font;

namespace ConstructionProps
{
    /// <summary>
    /// Owns the scene, the streamer, the placement cursor and the menu, and
    /// wires player input to all four.
    /// </summary>
    internal class Editor
    {
        readonly Config cfg;
        readonly string sceneDir;
        readonly Menu menu = new Menu();
        readonly History history = new History();
        readonly Placement placement;

        Scene scene = new Scene();
        PropStreamer streamer;
        string status = string.Empty;
        int statusUntil;

        public Editor(Config cfg, string dataDir)
        {
            this.cfg = cfg;
            sceneDir = Path.Combine(dataDir, "Scenes");
            Directory.CreateDirectory(sceneDir);
            placement = new Placement(cfg);
            streamer = new PropStreamer(cfg, scene);
        }

        public bool Active
        {
            get { return menu.Visible || placement.Mode != PlaceMode.Off; }
        }

        public void Toggle()
        {
            if (menu.Visible) { menu.Close(); return; }
            menu.Open(BuildRoot());
        }

        public void Shutdown()
        {
            placement.DestroyGhost();
            streamer.DespawnAll();
        }

        void Say(string msg)
        {
            status = msg;
            statusUntil = Game.GameTime + 4000;
        }

        // ================= tick =================

        public void Tick()
        {
            Vector3 cam = N.CamCoord();
            streamer.Update(cam);

            if (!Active)
            {
                DrawStatus();
                return;
            }

            SuppressGameInput();
            N.ShowCursorThisFrame();
            N.SetCursorSprite(placement.Mode == PlaceMode.Off ? 1 : 3);

            placement.UpdateCursor();
            HandleMouse();

            menu.Draw();
            if (cfg.ShowHud) DrawHud();
            DrawStatus();
        }

        void SuppressGameInput()
        {
            // Keep the player from shooting, swapping weapons or answering the
            // phone while they are building. Camera control stays live.
            Game.DisableControlThisFrame(0, Control.Attack);
            Game.DisableControlThisFrame(0, Control.Attack2);
            Game.DisableControlThisFrame(0, Control.Aim);
            Game.DisableControlThisFrame(0, Control.MeleeAttack1);
            Game.DisableControlThisFrame(0, Control.MeleeAttack2);
            Game.DisableControlThisFrame(0, Control.VehicleAim);
            Game.DisableControlThisFrame(0, Control.VehicleAttack);
            Game.DisableControlThisFrame(0, Control.SelectWeapon);
            Game.DisableControlThisFrame(0, Control.Phone);
            Game.DisableControlThisFrame(0, Control.SelectNextWeapon);
            Game.DisableControlThisFrame(0, Control.SelectPrevWeapon);
            Game.DisableControlThisFrame(0, Control.CursorScrollUp);
            Game.DisableControlThisFrame(0, Control.CursorScrollDown);
        }

        void HandleMouse()
        {
            float cx = N.CursorX() * 1280f;
            float cy = N.CursorY() * 720f;
            bool overMenu = menu.CursorOver(cx, cy);

            if (overMenu)
            {
                int idx = menu.ItemAt(cx, cy);
                if (idx >= 0) menu.HoverTo(idx);
            }

            // Scroll: menu navigation over the panel, prop rotation over the world.
            int scroll = 0;
            if (Game.IsDisabledControlJustPressed(0, Control.CursorScrollUp)) scroll = 1;
            else if (Game.IsDisabledControlJustPressed(0, Control.CursorScrollDown)) scroll = -1;

            if (scroll != 0)
            {
                if (overMenu) menu.ScrollBy(-scroll);
                else ApplyScroll(scroll);
            }

            if (Game.IsDisabledControlJustPressed(0, Control.Attack))
            {
                if (overMenu) menu.Activate();
                else if (placement.Mode == PlaceMode.Placing) Commit();
                else if (placement.Mode == PlaceMode.Moving) DropGrabbed();
            }
            else if (placement.PaintMode && placement.Mode == PlaceMode.Placing && !overMenu &&
                     Game.IsDisabledControlPressed(0, Control.Attack))
            {
                if (placement.PaintGateOpen()) Commit();
            }

            if (!Game.IsDisabledControlPressed(0, Control.Attack)) placement.ResetPaint();

            if (Game.IsDisabledControlJustPressed(0, Control.Aim))
            {
                if (placement.Mode == PlaceMode.Moving) CancelGrab();
                else if (placement.Mode == PlaceMode.Placing) placement.Cancel();
                else if (menu.Visible && !menu.Back()) menu.Close();
            }
        }

        void ApplyScroll(int dir)
        {
            if (Game.IsKeyPressed(Keys.ControlKey))
            {
                placement.HeightOffset += dir * cfg.HeightStep;
            }
            else if (Game.IsKeyPressed(Keys.ShiftKey))
            {
                placement.Rotate(dir * cfg.RotateStep, 0);
            }
            else if (Game.IsKeyPressed(Keys.Menu))
            {
                placement.Rotate(dir * cfg.RotateStep, 1);
            }
            else
            {
                placement.Rotate(dir * cfg.RotateStep, 2);
            }
        }

        // ================= keyboard =================

        public void KeyDown(Keys key)
        {
            bool ctrl = Game.IsKeyPressed(Keys.ControlKey);

            if (key == cfg.MenuKey) { Toggle(); return; }
            if (!Active) return;

            if (ctrl && key == cfg.UndoKey) { Undo(); return; }
            if (ctrl && key == cfg.RedoKey) { Redo(); return; }

            switch (key)
            {
                case Keys.Up:
                case Keys.NumPad8:
                    menu.MoveSelection(-1);
                    return;
                case Keys.Down:
                case Keys.NumPad2:
                    menu.MoveSelection(1);
                    return;
                case Keys.Left:
                case Keys.NumPad4:
                    menu.Adjust(-1);
                    return;
                case Keys.Right:
                case Keys.NumPad6:
                    menu.Adjust(1);
                    return;
                case Keys.Enter:
                case Keys.NumPad5:
                    menu.Activate();
                    return;
                case Keys.Back:
                case Keys.Escape:
                    if (placement.Mode != PlaceMode.Off && !menu.Visible) placement.Cancel();
                    else if (!menu.Back()) menu.Close();
                    return;
            }

            if (key == cfg.SnapKey)
            {
                placement.SnapOn = !placement.SnapOn;
                Say("Grid snap " + (placement.SnapOn ? "on (" + cfg.SnapStep.ToString("0.##") + "m)" : "off"));
            }
            else if (key == cfg.ResetRotationKey)
            {
                placement.ResetRotation();
                placement.HeightOffset = 0f;
                Say("Rotation reset");
            }
            else if (key == cfg.GroundKey)
            {
                DropToGround();
            }
            else if (key == cfg.GrabKey)
            {
                GrabUnderCursor();
            }
            else if (key == cfg.DeleteKey)
            {
                DeleteUnderCursor();
            }
        }

        // ================= edits =================

        void Commit()
        {
            var pp = placement.BuildPlacement();
            if (pp == null)
            {
                Say("That model is not available in this install");
                return;
            }
            pp.Frozen = cfg.PlaceFrozen;
            scene.Add(pp);
            streamer.SpawnImmediate(pp);
            history.Push(new EditAction { Kind = EditKind.Add, Target = pp });
            placement.MarkPainted();
        }

        void GrabUnderCursor()
        {
            if (placement.Mode == PlaceMode.Moving) { DropGrabbed(); return; }

            var hit = placement.CastFromCursor();
            if (!hit.DidHit) return;
            var pp = streamer.FindLive(hit.HitEntity);
            if (pp == null)
            {
                Say("Nothing of ours under the cursor");
                return;
            }

            placement.Selected = null;
            placement.Grabbed = pp;
            placement.GrabOriginalPosition = pp.Position;
            placement.GrabOriginalRotation = pp.Rotation;
            placement.Pitch = pp.Rotation.X;
            placement.Roll = pp.Rotation.Y;
            placement.Heading = pp.Rotation.Z;
            placement.HeightOffset = 0f;
            placement.Mode = PlaceMode.Moving;
            Say("Moving " + Catalog.LabelFor(pp.ModelHash, pp.ModelName) + " - click to drop, right click to cancel");
        }

        void DropGrabbed()
        {
            var pp = placement.Grabbed;
            if (pp == null) { placement.Mode = PlaceMode.Off; return; }

            scene.Reindex(pp);
            streamer.Refresh(pp);
            history.Push(new EditAction
            {
                Kind = EditKind.Transform,
                Target = pp,
                OldPosition = placement.GrabOriginalPosition,
                OldRotation = placement.GrabOriginalRotation,
                NewPosition = pp.Position,
                NewRotation = pp.Rotation
            });
            placement.Grabbed = null;
            placement.Mode = PlaceMode.Off;
        }

        void CancelGrab()
        {
            var pp = placement.Grabbed;
            if (pp != null)
            {
                pp.Position = placement.GrabOriginalPosition;
                pp.Rotation = placement.GrabOriginalRotation;
                scene.Reindex(pp);
                streamer.Refresh(pp);
            }
            placement.Grabbed = null;
            placement.Mode = PlaceMode.Off;
        }

        void DeleteUnderCursor()
        {
            var hit = placement.CastFromCursor();
            if (!hit.DidHit) return;
            var pp = streamer.FindLive(hit.HitEntity);
            if (pp == null) return;

            streamer.Despawn(pp);
            scene.Remove(pp);
            history.Push(new EditAction { Kind = EditKind.Remove, Target = pp });
            Say("Deleted " + Catalog.LabelFor(pp.ModelHash, pp.ModelName));
        }

        void DropToGround()
        {
            PlacedProp pp = placement.Grabbed;
            if (pp == null)
            {
                placement.HeightOffset = 0f;
                Say("Height offset cleared");
                return;
            }
            float ground = World.GetGroundHeight(pp.Position);
            pp.Position = new Vector3(pp.Position.X, pp.Position.Y, ground);
            streamer.Refresh(pp);
        }

        void Undo()
        {
            var a = history.PopUndo();
            if (a == null) { Say("Nothing to undo"); return; }

            switch (a.Kind)
            {
                case EditKind.Add:
                    streamer.Despawn(a.Target);
                    scene.Remove(a.Target);
                    break;
                case EditKind.Remove:
                    scene.Add(a.Target);
                    streamer.SpawnImmediate(a.Target);
                    break;
                case EditKind.Transform:
                    a.Target.Position = a.OldPosition;
                    a.Target.Rotation = a.OldRotation;
                    scene.Reindex(a.Target);
                    streamer.Refresh(a.Target);
                    break;
            }
            Say("Undo (" + scene.Count + " props)");
        }

        void Redo()
        {
            var a = history.PopRedo();
            if (a == null) { Say("Nothing to redo"); return; }

            switch (a.Kind)
            {
                case EditKind.Add:
                    scene.Add(a.Target);
                    streamer.SpawnImmediate(a.Target);
                    break;
                case EditKind.Remove:
                    streamer.Despawn(a.Target);
                    scene.Remove(a.Target);
                    break;
                case EditKind.Transform:
                    a.Target.Position = a.NewPosition;
                    a.Target.Rotation = a.NewRotation;
                    scene.Reindex(a.Target);
                    streamer.Refresh(a.Target);
                    break;
            }
            Say("Redo (" + scene.Count + " props)");
        }

        void ClearScene()
        {
            streamer.DespawnAll();
            scene.Clear();
            history.Clear();
            Say("Scene cleared");
        }

        // ================= scenes =================

        void SaveScene(bool askName)
        {
            string name = scene.Name;
            if (askName || string.IsNullOrEmpty(name) || name == "untitled")
            {
                string typed = AskText("Scene name", name == "untitled" ? "site01" : name);
                if (string.IsNullOrEmpty(typed)) { Say("Save cancelled"); return; }
                name = typed;
            }

            try
            {
                scene.SaveTo(sceneDir, name);
                Say("Saved \"" + scene.Name + "\" (" + scene.Count + " props)");
            }
            catch (Exception ex)
            {
                Say("Save failed: " + ex.Message);
            }
        }

        void LoadScene(string name)
        {
            try
            {
                var loaded = Scene.LoadFrom(sceneDir, name);
                streamer.DespawnAll();
                scene = loaded;
                streamer.SwapScene(scene);
                history.Clear();
                Say("Loaded \"" + name + "\" (" + scene.Count + " props) - streaming in");
            }
            catch (Exception ex)
            {
                Say("Load failed: " + ex.Message);
            }
        }

        void DeleteSceneFile(string name)
        {
            try
            {
                string path = Path.Combine(sceneDir, Scene.SafeName(name) + ".json");
                if (File.Exists(path)) File.Delete(path);
                Say("Deleted scene file \"" + name + "\"");
            }
            catch (Exception ex)
            {
                Say("Delete failed: " + ex.Message);
            }
        }

        static string AskText(string title, string preset)
        {
            try
            {
                Game.DisableAllControlsThisFrame(0);
                return Game.GetUserInput(WindowTitle.EnterMessage60, preset, 40);
            }
            catch
            {
                try { return Game.GetUserInput(preset, 40); }
                catch { return null; }
            }
        }

        // ================= menus =================

        MenuPanel BuildRoot()
        {
            var p = new MenuPanel { Title = "Construction Props", Subtitle = "Build a site, keep your frames" };

            p.Add("Place a Prop", () => menu.Push(BuildCategories()))
                .Hint = "Browse the construction catalog and start placing.";
            p.Add("Scenes", () => menu.Push(BuildScenes()))
                .Hint = "Save the current site, or load one you built earlier.";
            p.Add("Performance", () => menu.Push(BuildPerformance()))
                .Hint = "Streaming budget. Lower the radius first if frames dip.";
            p.Add("Editor Options", () => menu.Push(BuildOptions()))
                .Hint = "Snapping, rotation step, paint mode.";

            var info = p.Add("Scene", null);
            info.Value = () => scene.Name + "  ·  " + scene.Count + " props";
            info.Enabled = () => false;

            p.Add("Clear Scene", ClearScene).Hint = "Removes every prop in the current scene. Ctrl+Z undoes one at a time.";
            p.Add("Close Menu", () => menu.Close()).Hint = "The editor keeps running if a prop is still selected.";
            return p;
        }

        MenuPanel BuildCategories()
        {
            var p = new MenuPanel { Title = "Prop Catalog", Subtitle = "Pick a category" };
            foreach (var cat in Catalog.Categories)
            {
                var c = cat;
                var item = p.Add(c.Name, () => menu.Push(BuildProps(c)));
                item.Value = () => c.Entries.Count.ToString(CultureInfo.InvariantCulture);
            }
            return p;
        }

        MenuPanel BuildProps(PropCategory cat)
        {
            var p = new MenuPanel
            {
                Title = cat.Name,
                Subtitle = "Highlight to preview · Enter to place with the mouse"
            };

            foreach (var e in cat.Entries)
            {
                var entry = e;
                var item = p.Add(entry.Label, () =>
                {
                    placement.Select(entry);
                    menu.Close();
                    Say("Click to place " + entry.Label + " · scroll rotates · right click cancels");
                });
                item.Tag = entry;
                item.Hint = entry.ModelName;
                item.Value = () => streamer.IsModelUnavailable(entry.Hash) ? "missing" : string.Empty;
                item.Enabled = () => !streamer.IsModelUnavailable(entry.Hash);
            }

            // Highlighting a row previews it under the cursor straight away.
            p.OnHighlight = item =>
            {
                var entry = item != null ? item.Tag as PropEntry : null;
                if (entry != null) placement.Select(entry);
            };
            return p;
        }

        MenuPanel BuildScenes()
        {
            var p = new MenuPanel { Title = "Scenes", Subtitle = sceneDir };

            p.Add("Save", () => SaveScene(false)).Hint = "Writes to " + sceneDir;
            p.Add("Save As...", () => SaveScene(true));
            p.Add("New Empty Scene", () =>
            {
                ClearScene();
                scene.Name = "untitled";
            });
            p.Add("Refresh List", () =>
            {
                menu.Back();
                menu.Push(BuildScenes());
            });

            var files = Scene.List(sceneDir);
            var header = new MenuItem { Text = files.Count == 0 ? "No saved scenes yet" : "Saved scenes", IsHeader = true };
            p.Items.Add(header);

            foreach (var f in files)
            {
                string name = f;
                var item = p.Add(name, () => LoadScene(name));
                item.Hint = "Enter loads this scene into the world.";
            }

            if (files.Count > 0)
            {
                p.Add("Delete a Saved Scene...", () => menu.Push(BuildSceneDelete()));
            }
            return p;
        }

        MenuPanel BuildSceneDelete()
        {
            var p = new MenuPanel { Title = "Delete Scene File", Subtitle = "This cannot be undone" };
            foreach (var f in Scene.List(sceneDir))
            {
                string name = f;
                p.Add(name, () =>
                {
                    DeleteSceneFile(name);
                    menu.Back();
                });
            }
            return p;
        }

        MenuPanel BuildPerformance()
        {
            var p = new MenuPanel { Title = "Performance", Subtitle = "Streaming budget" };

            var live = p.Add("Live / Scene", null);
            live.Value = () => streamer.LiveCount + " / " + scene.Count;
            live.Enabled = () => false;
            live.Hint = "Only the live ones are real entities. The rest cost nothing.";

            var pending = p.Add("Waiting to stream in", null);
            pending.Value = () => streamer.PendingCount.ToString(CultureInfo.InvariantCulture);
            pending.Enabled = () => false;

            var pass = p.Add("Last streaming pass", null);
            pass.Value = () => streamer.LastPassMs.ToString("0") + " ms";
            pass.Enabled = () => false;

            Slider(p, "Stream Radius", () => cfg.StreamRadius.ToString("0") + " m",
                d => cfg.StreamRadius = Clamp(cfg.StreamRadius + d * 10f, 40f, 600f),
                "Props further out are removed from the world. This is the big one.");

            Slider(p, "Max Live Props", () => cfg.MaxLiveProps.ToString(CultureInfo.InvariantCulture),
                d => cfg.MaxLiveProps = (int)Clamp(cfg.MaxLiveProps + d * 25, 25, 2500),
                "Hard cap on entities. GTA's object pool is finite - do not get greedy.");

            Slider(p, "Spawns per Pass", () => cfg.SpawnsPerPass.ToString(CultureInfo.InvariantCulture),
                d => cfg.SpawnsPerPass = (int)Clamp(cfg.SpawnsPerPass + d, 1, 40),
                "Lower means smoother streaming, higher means props appear sooner.");

            Slider(p, "Despawns per Pass", () => cfg.DespawnsPerPass.ToString(CultureInfo.InvariantCulture),
                d => cfg.DespawnsPerPass = (int)Clamp(cfg.DespawnsPerPass + d, 1, 80), null);

            Slider(p, "Pass Interval", () => cfg.StreamIntervalMs + " ms",
                d => cfg.StreamIntervalMs = (int)Clamp(cfg.StreamIntervalMs + d * 20, 16, 2000),
                "How often the streamer thinks. 120ms is plenty.");

            Slider(p, "LOD Distance", () => cfg.LodDistance.ToString(CultureInfo.InvariantCulture),
                d => cfg.LodDistance = (int)Clamp(cfg.LodDistance + d * 25, 50, 5000), null);

            Slider(p, "Physics Radius", () => cfg.PhysicsRadius.ToString("0") + " m",
                d => cfg.PhysicsRadius = Clamp(cfg.PhysicsRadius + d * 5f, 0f, cfg.StreamRadius),
                "Props past this keep their model but drop collision.");

            p.Add("Preset: Potato", () => ApplyPreset(90f, 250, 2, 160)).Hint = "Small radius, tight cap.";
            p.Add("Preset: Balanced", () => ApplyPreset(160f, 600, 4, 120)).Hint = "The default.";
            p.Add("Preset: Beefy Rig", () => ApplyPreset(300f, 1200, 8, 80)).Hint = "Big view distance, more entities.";

            p.Add("Restream Everything", () =>
            {
                streamer.DespawnAll();
                Say("Cleared live props - they will stream back in");
            }).Hint = "Use after changing the radius or if something looks wrong.";

            return p;
        }

        void ApplyPreset(float radius, int cap, int spawns, int interval)
        {
            cfg.StreamRadius = radius;
            cfg.MaxLiveProps = cap;
            cfg.SpawnsPerPass = spawns;
            cfg.StreamIntervalMs = interval;
            cfg.PhysicsRadius = Math.Min(cfg.PhysicsRadius, radius);
            streamer.DespawnAll();
            Say("Preset applied - radius " + radius.ToString("0") + "m, cap " + cap);
        }

        MenuPanel BuildOptions()
        {
            var p = new MenuPanel { Title = "Editor Options", Subtitle = "How placing feels" };

            Toggle(p, "Grid Snap", () => placement.SnapOn, v => placement.SnapOn = v,
                "Rounds X/Y to the snap step. Handy for fences and barriers.");

            Slider(p, "Snap Step", () => cfg.SnapStep.ToString("0.##") + " m",
                d => cfg.SnapStep = Clamp(cfg.SnapStep + d * 0.05f, 0.05f, 10f), null);

            Slider(p, "Rotate Step", () => cfg.RotateStep.ToString("0") + "°",
                d => cfg.RotateStep = Clamp(cfg.RotateStep + d * 5f, 1f, 90f),
                "Scroll wheel turns the prop by this much.");

            Toggle(p, "Paint Mode", () => placement.PaintMode, v => placement.PaintMode = v,
                "Hold the left button and drag to lay a run of props.");

            Slider(p, "Paint Spacing", () => cfg.PaintSpacing.ToString("0.##") + " m",
                d => cfg.PaintSpacing = Clamp(cfg.PaintSpacing + d * 0.25f, 0.2f, 50f), null);

            Toggle(p, "New Props Collide", () => cfg.CollisionByDefault, v => cfg.CollisionByDefault = v,
                "Off makes decoration props you can walk straight through.");

            Toggle(p, "New Props Frozen", () => cfg.PlaceFrozen, v => cfg.PlaceFrozen = v,
                "Frozen props cost the physics step nothing. Unfreeze only if you want them to fall.");

            Toggle(p, "Show HUD", () => cfg.ShowHud, v => cfg.ShowHud = v, null);

            Slider(p, "Height Offset", () => placement.HeightOffset.ToString("0.##") + " m",
                d => placement.HeightOffset += d * cfg.HeightStep,
                "Ctrl + scroll does this in the world too.");

            p.Add("Reset Rotation & Height", () =>
            {
                placement.ResetRotation();
                placement.HeightOffset = 0f;
            });

            p.Add("Controls Reference", () => menu.Push(BuildControls()));
            return p;
        }

        MenuPanel BuildControls()
        {
            var p = new MenuPanel { Title = "Controls", Subtitle = "Editor cheat sheet" };
            AddInfo(p, "Left click", "Place / confirm");
            AddInfo(p, "Right click", "Cancel or go back");
            AddInfo(p, "Scroll", "Rotate (heading)");
            AddInfo(p, "Shift + scroll", "Pitch");
            AddInfo(p, "Alt + scroll", "Roll");
            AddInfo(p, "Ctrl + scroll", "Raise / lower");
            AddInfo(p, cfg.GrabKey.ToString(), "Grab the prop under the cursor");
            AddInfo(p, cfg.DeleteKey.ToString(), "Delete the prop under the cursor");
            AddInfo(p, cfg.SnapKey.ToString(), "Toggle grid snap");
            AddInfo(p, cfg.ResetRotationKey.ToString(), "Reset rotation");
            AddInfo(p, cfg.GroundKey.ToString(), "Drop to ground / clear height");
            AddInfo(p, "Ctrl+" + cfg.UndoKey, "Undo");
            AddInfo(p, "Ctrl+" + cfg.RedoKey, "Redo");
            AddInfo(p, cfg.MenuKey.ToString(), "Open / close this menu");
            return p;
        }

        static void AddInfo(MenuPanel p, string key, string what)
        {
            var i = p.Add(what, null);
            i.Value = () => key;
            i.Enabled = () => false;
        }

        static void Slider(MenuPanel p, string text, Func<string> value, Action<int> adjust, string hint)
        {
            var i = p.Add(text, null);
            i.Value = () => "< " + value() + " >";
            i.Adjust = adjust;
            i.Activate = () => adjust(1);
            i.Hint = hint;
        }

        static void Toggle(MenuPanel p, string text, Func<bool> get, Action<bool> set, string hint)
        {
            var i = p.Add(text, () => set(!get()));
            i.Value = () => get() ? "ON" : "OFF";
            i.Adjust = d => set(!get());
            i.Hint = hint;
        }

        static float Clamp(float v, float lo, float hi)
        {
            return v < lo ? lo : (v > hi ? hi : v);
        }

        // ================= hud =================

        void DrawHud()
        {
            const float w = 300f;
            const float h = 116f;
            float x = 1280f - w - 24f;
            float y = 720f - h - 40f;

            Menu.Rect(x, y, w, h, Color.FromArgb(180, 12, 12, 14));
            Menu.Rect(x, y, w, 3f, Color.FromArgb(255, 240, 150, 30));

            string sel = placement.Mode == PlaceMode.Moving
                ? "Moving a placed prop"
                : (placement.Selected != null ? placement.Selected.Label : "Nothing selected");

            Menu.Text(sel, x + 12f, y + 10f, 0.34f, Color.FromArgb(240, 240, 240, 240), Font.ChaletLondon);
            Menu.Text("Live " + streamer.LiveCount + " / " + scene.Count + " placed", x + 12f, y + 36f, 0.29f,
                Color.FromArgb(200, 200, 200, 200), Font.ChaletLondon);
            Menu.Text("Pass " + streamer.LastPassMs.ToString("0") + "ms · queued " + streamer.PendingCount,
                x + 12f, y + 56f, 0.29f, Color.FromArgb(200, 200, 200, 200), Font.ChaletLondon);
            Menu.Text("Heading " + placement.Heading.ToString("0") + "° · Z " + placement.HeightOffset.ToString("0.##") +
                      "m · Snap " + (placement.SnapOn ? "on" : "off") + (placement.PaintMode ? " · paint" : ""),
                x + 12f, y + 76f, 0.27f, Color.FromArgb(190, 190, 190, 190), Font.ChaletLondon);
        }

        void DrawStatus()
        {
            if (string.IsNullOrEmpty(status) || Game.GameTime > statusUntil) return;
            Menu.Rect(320f, 660f, 640f, 30f, Color.FromArgb(170, 12, 12, 14));
            new TextElement(status, new PointF(640f, 664f), 0.32f, Color.FromArgb(240, 245, 245, 245),
                Font.ChaletLondon, Alignment.Center, false, true).Draw();
        }
    }
}
