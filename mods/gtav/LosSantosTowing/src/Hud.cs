// Notifications, the on-screen checklist, the context prompt and the ground
// markers. All stock GTA V UI - no custom textures.
using GTA;
using GTA.Math;
using GTA.Native;
using GTA.UI;

namespace LosSantosTowing
{
    public static class Hud
    {
        public const string Company = "Los Santos Towing";

        /// Set from the ini. Off means: no custom text drawing, no ground
        /// markers - just notifications, subtitles and help text.
        public static bool Rich = true;

        // Only the plain feed post is used. The icon overload posts through
        // SET_NOTIFICATION_MESSAGE with a CHAR_* texture that no one has
        // streamed in, and that can bring the whole game down.
        public static void Dispatch(string subject, string body)
        {
            Post("~y~" + Company + "~s~~n~~b~" + subject + "~s~~n~" + body);
        }

        public static void Note(string body)
        {
            Post("~y~" + Company + "~s~~n~" + body);
        }

        static void Post(string text)
        {
            try { Notification.Show(text); }
            catch (System.Exception ex) { Log.Error("Hud.Post", ex); }
        }

        public static void Subtitle(string text, int ms = 4000)
        {
            try { Screen.ShowSubtitle(text, ms); }
            catch (System.Exception ex) { Log.Error("Hud.Subtitle", ex); }
        }

        public static void Prompt(string text)
        {
            try { Screen.ShowHelpTextThisFrame(text); }
            catch (System.Exception ex) { Log.Error("Hud.Prompt", ex); }
        }

        /// The job checklist, drawn a line at a time - the game's text natives
        /// have no concept of a line break inside one string.
        public static void Checklist(Job job)
        {
            if (job == null || !Rich) return;
            float y = 0.30f;
            Line("~y~" + job.Call.KindLabel + "~s~   ~g~$" + job.Call.Pay + "~s~", y, 0.38f);
            y += 0.026f;
            foreach (var step in job.Steps)
            {
                string line;
                if (step.Done) line = "~c~[x] " + step.Text + "~s~";
                else if (job.IsCurrent(step.Id)) line = "~y~[>] " + step.Text + "~s~";
                else line = "~c~[ ] " + step.Text + "~s~";
                Line(line, y, 0.32f);
                y += 0.023f;
            }
        }

        static void Line(string text, float y, float scale)
        {
            if (text.Length > 98) text = text.Substring(0, 98);
            try
            {
            Function.Call(Hash.SET_TEXT_FONT, 4);
            Function.Call(Hash.SET_TEXT_SCALE, 0f, scale);
            Function.Call(Hash.SET_TEXT_COLOUR, 255, 255, 255, 225);
            Function.Call(Hash.SET_TEXT_DROP_SHADOW);
            Function.Call(Hash.SET_TEXT_OUTLINE);
            Function.Call(Hash.BEGIN_TEXT_COMMAND_DISPLAY_TEXT, "STRING");
            Function.Call(Hash.ADD_TEXT_COMPONENT_SUBSTRING_PLAYER_NAME, text);
            Function.Call(Hash.END_TEXT_COMMAND_DISPLAY_TEXT, 0.015f, y);
            }
            catch (System.Exception ex) { Log.Error("Hud.Line", ex); Rich = false; }
        }

        public static void Marker(Vector3 position, int r, int g, int b, float size = 2.0f)
        {
            if (!Rich) return;
            try
            {
            Function.Call(Hash.DRAW_MARKER, 1,
                position.X, position.Y, position.Z - 0.9f,
                0f, 0f, 0f, 0f, 0f, 0f,
                size, size, 1.2f,
                r, g, b, 110,
                false, false, 2, false, 0, 0, false);
            }
            catch (System.Exception ex) { Log.Error("Hud.Marker", ex); Rich = false; }
        }

        public static void PlayBeep()
        {
            try { Function.Call(Hash.PLAY_SOUND_FRONTEND, -1, "Text_Arrive_Tone", "Phone_SoundSet_Default", true); }
            catch (System.Exception ex) { Log.Error("Hud.PlayBeep", ex); }
        }

        public static void PlayCash()
        {
            try { Function.Call(Hash.PLAY_SOUND_FRONTEND, -1, "PURCHASE", "HUD_LIQUOR_STORE_SOUNDSET", true); }
            catch (System.Exception ex) { Log.Error("Hud.PlayCash", ex); }
        }
    }
}
