// A small self-contained menu, drawn with the game's own rect and text natives.
// No NativeUI dependency: one less dll for anyone to install or mismatch.
using GTA;
using GTA.Native;
using System;
using System.Collections.Generic;

namespace LosSantosTowing
{
    public sealed class MenuItem
    {
        public string Text;
        public string Description;
        public Func<string> Value;      // right-hand label, e.g. the current ELS mode
        public Func<bool> Enabled;      // greyed out when false
        public Action OnSelect;

        public MenuItem(string text, string description, Action onSelect,
            Func<string> value = null, Func<bool> enabled = null)
        {
            Text = text;
            Description = description;
            OnSelect = onSelect;
            Value = value;
            Enabled = enabled;
        }
    }

    public sealed class Menu
    {
        const float X = 0.16f;          // centre of the panel, screen fraction
        const float Width = 0.20f;
        const float TopY = 0.14f;
        const float RowH = 0.033f;

        public string Title = "TOWING";
        public string Subtitle = "";
        public readonly List<MenuItem> Items = new List<MenuItem>();
        public bool IsOpen;

        int _index;

        public void Toggle() { IsOpen = !IsOpen; if (IsOpen) _index = 0; }
        public void Close() { IsOpen = false; }

        public void Up()
        {
            if (Items.Count == 0) return;
            _index = (_index - 1 + Items.Count) % Items.Count;
            Sound("NAV_UP_DOWN");
        }

        public void Down()
        {
            if (Items.Count == 0) return;
            _index = (_index + 1) % Items.Count;
            Sound("NAV_UP_DOWN");
        }

        public void Select()
        {
            if (Items.Count == 0) return;
            var item = Items[_index];
            if (item.Enabled != null && !item.Enabled())
            {
                Sound("ERROR");
                return;
            }
            Sound("SELECT");
            if (item.OnSelect != null) item.OnSelect();
        }

        static void Sound(string name)
        {
            try { Function.Call(Hash.PLAY_SOUND_FRONTEND, -1, name, "HUD_FRONTEND_DEFAULT_SOUNDSET", true); }
            catch { }
        }

        public void Draw()
        {
            if (!IsOpen) return;
            try
            {
                // Header
                Rect(X, TopY, Width, 0.055f, 20, 24, 30, 235);
                Text(Title, X, TopY - 0.017f, 0.62f, 255, 176, 58, 255, center: true);
                if (!string.IsNullOrEmpty(Subtitle))
                {
                    Rect(X, TopY + 0.041f, Width, 0.026f, 12, 14, 18, 230);
                    Text(Subtitle, X, TopY + 0.033f, 0.30f, 190, 200, 212, 255, center: true);
                }

                float y = TopY + 0.062f;
                for (int i = 0; i < Items.Count; i++)
                {
                    var item = Items[i];
                    bool selected = i == _index;
                    bool enabled = item.Enabled == null || item.Enabled();

                    Rect(X, y + RowH / 2f, Width, RowH,
                        selected ? 245 : 10, selected ? 245 : 12, selected ? 240 : 16, selected ? 245 : 190);

                    int tr = selected ? 15 : (enabled ? 235 : 110);
                    int tg = selected ? 17 : (enabled ? 240 : 115);
                    int tb = selected ? 22 : (enabled ? 245 : 120);
                    Text(item.Text, X - Width / 2f + 0.008f, y + 0.006f, 0.34f, tr, tg, tb, 255);

                    if (item.Value != null)
                    {
                        string v = item.Value();
                        if (!string.IsNullOrEmpty(v))
                            Text(v, X + Width / 2f - 0.008f, y + 0.006f, 0.34f, tr, tg, tb, 255, right: true);
                    }
                    y += RowH;
                }

                // Description strip
                var current = Items.Count > 0 ? Items[_index] : null;
                if (current != null && !string.IsNullOrEmpty(current.Description))
                {
                    Rect(X, y + 0.024f, Width, 0.040f, 12, 14, 18, 225);
                    Text(current.Description, X - Width / 2f + 0.008f, y + 0.010f, 0.28f, 175, 185, 198, 255);
                }
            }
            catch (Exception ex)
            {
                Log.Error("Menu.Draw", ex);
                IsOpen = false;
            }
        }

        static void Rect(float cx, float cy, float w, float h, int r, int g, int b, int a)
        {
            Function.Call(Hash.DRAW_RECT, cx, cy, w, h, r, g, b, a, false);
        }

        static void Text(string text, float x, float y, float scale, int r, int g, int b, int a,
            bool center = false, bool right = false)
        {
            if (text == null) return;
            if (text.Length > 98) text = text.Substring(0, 98);
            Function.Call(Hash.SET_TEXT_FONT, 4);
            Function.Call(Hash.SET_TEXT_SCALE, 0f, scale);
            Function.Call(Hash.SET_TEXT_COLOUR, r, g, b, a);
            Function.Call(Hash.SET_TEXT_DROP_SHADOW);
            if (center) Function.Call(Hash.SET_TEXT_CENTRE, true);
            if (right)
            {
                Function.Call(Hash.SET_TEXT_RIGHT_JUSTIFY, true);
                Function.Call(Hash.SET_TEXT_WRAP, 0f, x);
            }
            Function.Call(Hash.BEGIN_TEXT_COMMAND_DISPLAY_TEXT, "STRING");
            Function.Call(Hash.ADD_TEXT_COMPONENT_SUBSTRING_PLAYER_NAME, text);
            Function.Call(Hash.END_TEXT_COMMAND_DISPLAY_TEXT, x, y);
        }
    }
}
