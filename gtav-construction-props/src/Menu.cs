using System;
using System.Collections.Generic;
using System.Drawing;
using GTA;
using GTA.UI;
using Font = GTA.UI.Font;

namespace ConstructionProps
{
    internal class MenuItem
    {
        public string Text;
        public Func<string> Value;          // right-hand column, evaluated on draw
        public Action Activate;
        public Action<int> Adjust;          // left/right arrows, -1 / +1
        public Func<bool> Enabled;
        public string Hint;
        public object Tag;
        public bool IsHeader;

        public bool IsEnabled { get { return Enabled == null || Enabled(); } }
    }

    internal class MenuPanel
    {
        public string Title;
        public string Subtitle;
        public List<MenuItem> Items = new List<MenuItem>();
        public int Index;
        public int Scroll;
        public Action<MenuItem> OnHighlight;

        public MenuItem Current
        {
            get { return Index >= 0 && Index < Items.Count ? Items[Index] : null; }
        }

        public MenuItem Add(string text, Action activate)
        {
            var i = new MenuItem { Text = text, Activate = activate };
            Items.Add(i);
            return i;
        }
    }

    /// <summary>
    /// A small immediate-mode menu. It allocates nothing per frame beyond the
    /// draw elements themselves and only runs at all while it is open.
    /// </summary>
    internal class Menu
    {
        public const float X = 40f;
        public const float W = 400f;
        public const float TitleH = 62f;
        public const float SubH = 28f;
        public const float ItemH = 34f;
        public const float Y = 50f;
        public const int MaxVisible = 12;

        static readonly Color Accent = Color.FromArgb(255, 240, 150, 30);
        static readonly Color Bg = Color.FromArgb(190, 12, 12, 14);
        static readonly Color BgSel = Color.FromArgb(235, 240, 150, 30);
        static readonly Color TextCol = Color.FromArgb(235, 235, 235, 235);
        static readonly Color TextSel = Color.FromArgb(255, 15, 15, 15);
        static readonly Color TextDim = Color.FromArgb(140, 190, 190, 190);
        static readonly Color BarBg = Color.FromArgb(220, 20, 20, 22);

        readonly List<MenuPanel> stack = new List<MenuPanel>();

        public bool Visible;

        public MenuPanel Top { get { return stack.Count > 0 ? stack[stack.Count - 1] : null; } }
        public int Depth { get { return stack.Count; } }

        public void Open(MenuPanel root)
        {
            stack.Clear();
            stack.Add(root);
            Visible = true;
            RaiseHighlight();
        }

        public void Push(MenuPanel panel)
        {
            stack.Add(panel);
            RaiseHighlight();
        }

        public bool Back()
        {
            if (stack.Count <= 1) return false;
            stack.RemoveAt(stack.Count - 1);
            RaiseHighlight();
            return true;
        }

        public void Close()
        {
            Visible = false;
            stack.Clear();
        }

        public void MoveSelection(int delta)
        {
            var p = Top;
            if (p == null || p.Items.Count == 0) return;

            int start = p.Index;
            do
            {
                p.Index += delta;
                if (p.Index < 0) p.Index = p.Items.Count - 1;
                if (p.Index >= p.Items.Count) p.Index = 0;
                if (!p.Items[p.Index].IsHeader) break;
            } while (p.Index != start);

            EnsureVisible(p);
            RaiseHighlight();
        }

        void EnsureVisible(MenuPanel p)
        {
            if (p.Index < p.Scroll) p.Scroll = p.Index;
            if (p.Index >= p.Scroll + MaxVisible) p.Scroll = p.Index - MaxVisible + 1;
            if (p.Scroll < 0) p.Scroll = 0;
        }

        void RaiseHighlight()
        {
            var p = Top;
            if (p != null && p.OnHighlight != null) p.OnHighlight(p.Current);
        }

        public void Activate()
        {
            var item = Top != null ? Top.Current : null;
            if (item == null || !item.IsEnabled || item.Activate == null) return;
            item.Activate();
        }

        public void Adjust(int delta)
        {
            var item = Top != null ? Top.Current : null;
            if (item == null || !item.IsEnabled || item.Adjust == null) return;
            item.Adjust(delta);
        }

        /// <summary>Screen-space bounds in 1280x720 space, for cursor hit tests.</summary>
        public RectangleF Bounds
        {
            get
            {
                var p = Top;
                int rows = p == null ? 0 : Math.Min(p.Items.Count, MaxVisible);
                float h = TitleH + SubH + rows * ItemH + 26f;
                return new RectangleF(X, Y, W, h);
            }
        }

        public bool CursorOver(float cx, float cy)
        {
            return Visible && Bounds.Contains(cx, cy);
        }

        /// <summary>Returns the item index under the cursor, or -1.</summary>
        public int ItemAt(float cx, float cy)
        {
            var p = Top;
            if (p == null || !Visible) return -1;
            if (cx < X || cx > X + W) return -1;
            float top = Y + TitleH + SubH;
            int rows = Math.Min(p.Items.Count, MaxVisible);
            for (int r = 0; r < rows; r++)
            {
                float iy = top + r * ItemH;
                if (cy >= iy && cy < iy + ItemH)
                {
                    int idx = p.Scroll + r;
                    return idx < p.Items.Count ? idx : -1;
                }
            }
            return -1;
        }

        public void HoverTo(int index)
        {
            var p = Top;
            if (p == null || index < 0 || index >= p.Items.Count) return;
            if (p.Items[index].IsHeader || p.Index == index) return;
            p.Index = index;
            RaiseHighlight();
        }

        public void ScrollBy(int delta)
        {
            MoveSelection(delta);
        }

        public void Draw()
        {
            var p = Top;
            if (!Visible || p == null) return;

            float y = Y;

            // Title
            Rect(X, y, W, TitleH, Color.FromArgb(235, 18, 18, 20));
            Rect(X, y + TitleH - 3f, W, 3f, Accent);
            Text(p.Title, X + 14f, y + 12f, 0.62f, TextCol, Font.HouseScript);
            y += TitleH;

            // Subtitle / breadcrumb
            Rect(X, y, W, SubH, Color.FromArgb(225, 26, 26, 30));
            Text(p.Subtitle ?? string.Empty, X + 14f, y + 4f, 0.30f, TextDim, Font.ChaletLondon);
            string counter = p.Items.Count == 0 ? "0/0" : (p.Index + 1) + "/" + p.Items.Count;
            TextRight(counter, X + W - 14f, y + 4f, 0.30f, TextDim);
            y += SubH;

            int rows = Math.Min(p.Items.Count, MaxVisible);
            for (int r = 0; r < rows; r++)
            {
                int idx = p.Scroll + r;
                if (idx >= p.Items.Count) break;
                var item = p.Items[idx];
                bool selected = idx == p.Index;
                bool enabled = item.IsEnabled;

                if (item.IsHeader)
                {
                    Rect(X, y, W, ItemH, Color.FromArgb(215, 30, 30, 34));
                    Text(item.Text, X + 14f, y + 7f, 0.31f, Accent, Font.ChaletLondon);
                }
                else
                {
                    Rect(X, y, W, ItemH, selected ? BgSel : Bg);
                    Color fg = selected ? TextSel : (enabled ? TextCol : TextDim);
                    Text(item.Text, X + 14f, y + 6f, 0.35f, fg, Font.ChaletLondon);
                    if (item.Value != null)
                        TextRight(item.Value(), X + W - 14f, y + 6f, 0.35f, fg);
                }
                y += ItemH;
            }

            // Scroll indicator
            if (p.Items.Count > MaxVisible)
            {
                Rect(X, y, W, 6f, Color.FromArgb(200, 20, 20, 22));
                float frac = (float)p.Scroll / Math.Max(1, p.Items.Count - MaxVisible);
                float knobW = W * MaxVisible / p.Items.Count;
                Rect(X + (W - knobW) * frac, y, knobW, 6f, Accent);
                y += 6f;
            }

            // Hint line for the highlighted item
            var cur = p.Current;
            if (cur != null && !string.IsNullOrEmpty(cur.Hint))
            {
                Rect(X, y + 4f, W, 30f, Color.FromArgb(210, 18, 18, 20));
                Text(cur.Hint, X + 14f, y + 9f, 0.28f, TextDim, Font.ChaletLondon);
            }
        }

        // ---------------- primitives ----------------

        public static void Rect(float x, float y, float w, float h, Color c)
        {
            new GTA.UI.Rectangle(new PointF(x, y), new SizeF(w, h), c).Draw();
        }

        public static void Text(string s, float x, float y, float scale, Color c, Font font)
        {
            new TextElement(s ?? string.Empty, new PointF(x, y), scale, c, font, Alignment.Left, false, true).Draw();
        }

        public static void TextRight(string s, float x, float y, float scale, Color c)
        {
            new TextElement(s ?? string.Empty, new PointF(x, y), scale, c, Font.ChaletLondon, Alignment.Right, false, true).Draw();
        }
    }
}
