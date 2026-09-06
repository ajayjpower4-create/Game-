using System;
using System.IO;
using GTA.UI;

namespace WinchMod
{
    /// <summary>
    /// Writes failures to scripts\WinchMod.log. An unhandled exception in a script
    /// event handler makes ScriptHookVDotNet abort the whole script, so every entry
    /// point funnels through Try() and the mod keeps running with a note in the log
    /// instead of dying on the first bad frame.
    /// </summary>
    internal static class Log
    {
        private const string Path = "scripts\\WinchMod.log";
        private static int _reported;

        public static void Try(string what, Action action)
        {
            try
            {
                action();
            }
            catch (Exception ex)
            {
                Write(what, ex);

                // Only nag on screen the first few times; the log has the rest.
                if (_reported < 3)
                {
                    _reported++;
                    Notification.Show("~r~Winch~s~: " + what + " failed - see scripts\\WinchMod.log");
                }
            }
        }

        public static void Write(string what, Exception ex)
        {
            try
            {
                File.AppendAllText(Path, string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}{2}{3}{2}{2}",
                    DateTime.Now, what, Environment.NewLine, ex));
            }
            catch
            {
                // A mod that cannot write its log file still has no business crashing.
            }
        }
    }
}
