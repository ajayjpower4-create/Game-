using System;
using System.IO;
using System.Windows.Forms;
using GTA;
using GTA.UI;

namespace ConstructionProps
{
    /// <summary>
    /// ScriptHookVDotNet entry point. Deliberately thin: it owns the lifetime,
    /// nothing else.
    /// </summary>
    public class Main : Script
    {
        Editor editor;
        Config config;
        string dataDir;
        bool ready;

        public Main()
        {
            Interval = 0; // run every frame; the expensive work is self-throttled

            try
            {
                dataDir = Path.Combine(BaseDirectory, "ConstructionProps");
                Directory.CreateDirectory(dataDir);

                config = Config.Load(Path.Combine(dataDir, "ConstructionProps.ini"));
                Catalog.Build(dataDir, Log);
                editor = new Editor(config, dataDir);
                ready = true;

                Log("loaded - press " + config.MenuKey + " to open the menu");
            }
            catch (Exception ex)
            {
                Log("failed to start: " + ex);
            }

            Tick += OnTick;
            KeyDown += OnKeyDown;
            Aborted += OnAborted;
        }

        static string BaseDirectory
        {
            get
            {
                // scripts\ next to the game exe, wherever SHVDN loaded us from.
                string asm = System.Reflection.Assembly.GetExecutingAssembly().Location;
                string dir = Path.GetDirectoryName(asm);
                return string.IsNullOrEmpty(dir) ? "scripts" : dir;
            }
        }

        void OnTick(object sender, EventArgs e)
        {
            if (!ready) return;
            try
            {
                editor.Tick();
            }
            catch (Exception ex)
            {
                Log("tick error: " + ex.Message);
            }
        }

        void OnKeyDown(object sender, KeyEventArgs e)
        {
            if (!ready) return;
            try
            {
                editor.KeyDown(e.KeyCode);
            }
            catch (Exception ex)
            {
                Log("key error: " + ex.Message);
            }
        }

        void OnAborted(object sender, EventArgs e)
        {
            // Reloading scripts must not leave a field of orphaned props behind.
            try { if (editor != null) editor.Shutdown(); }
            catch { }
        }

        static void Log(string message)
        {
            try
            {
                string line = DateTime.Now.ToString("[HH:mm:ss] ") + "ConstructionProps: " + message;
                File.AppendAllText(Path.Combine(BaseDirectory, "ConstructionProps.log"), line + Environment.NewLine);
            }
            catch { }
        }
    }
}
