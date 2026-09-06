using System;
using System.Collections.Generic;
using System.Drawing;
using GTA;
using GTA.Math;
using GTA.UI;

namespace WinchMod
{
    internal static class Hud
    {
        private static readonly Color Dim = Color.FromArgb(190, 235, 235, 235);
        private static readonly Color Hot = Color.FromArgb(230, 255, 190, 90);

        public static void Draw(List<WinchLine> lines, AttachPoint pending, WinchLine active)
        {
            if (!Config.ShowHud)
                return;

            float y = 470f;

            if (pending != null)
            {
                Line("Winch: first point set - aim at the second point and press "
                     + Config.AttachKey, ref y, Hot);
            }
            else if (lines.Count == 0)
            {
                Line("Winch: aim at something and press " + Config.AttachKey + " to set the first point", ref y, Dim);
            }

            if (active != null && active.EndsAlive)
            {
                string state = active.Strapped ? "STRAPPED TO BED" : (active.Tension > 1f ? "taut" : "slack");
                Line(string.Format("Line: {0} <-> {1}   {2:0.0} m   {3}",
                    active.A.Describe(), active.B.Describe(), active.Length, state), ref y, Dim);
                Line(string.Format("{0}/{1} spool   {2} cut   {3} strap/unstrap   {4} cut all",
                    Config.SpoolInKey, Config.SpoolOutKey, Config.CutKey, Config.StrapKey, Config.CutAllKey), ref y, Dim);
            }

            if (lines.Count > 1)
                Line(lines.Count + " lines out", ref y, Dim);

            DrawMarkers(lines, pending);
        }

        private static void Line(string text, ref float y, Color color)
        {
            new TextElement(text, new PointF(20f, y), 0.32f, color, GTA.UI.Font.ChaletLondon,
                GTA.UI.Alignment.Left, false, true).Draw();
            y += 20f;
        }

        private static void DrawMarkers(List<WinchLine> lines, AttachPoint pending)
        {
            if (pending != null && pending.IsValid)
                Sphere(pending.WorldPosition, Color.FromArgb(160, 255, 190, 90));

            for (int i = 0; i < lines.Count; i++)
            {
                WinchLine line = lines[i];
                if (!line.EndsAlive) continue;
                Color c = line.Strapped
                    ? Color.FromArgb(110, 120, 220, 140)
                    : Color.FromArgb(90, 200, 200, 200);
                Sphere(line.A.WorldPosition, c);
                Sphere(line.B.WorldPosition, c);
            }
        }

        private static void Sphere(Vector3 pos, Color color)
        {
            World.DrawMarker(MarkerType.DebugSphere, pos, Vector3.Zero, Vector3.Zero,
                new Vector3(0.08f, 0.08f, 0.08f), color);
        }
    }
}
