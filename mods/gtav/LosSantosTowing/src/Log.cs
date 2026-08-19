// A log next to the dll, so a crash or a swallowed exception leaves evidence
// even when ScriptHookVDotNet.log does not.
using System;
using System.IO;

namespace LosSantosTowing
{
    public static class Log
    {
        static string _path;
        static bool _enabled = true;

        public static void Init(string baseDirectory, bool enabled)
        {
            _enabled = enabled;
            try
            {
                _path = Path.Combine(baseDirectory ?? ".", "LosSantosTowing.log");
                if (_enabled) File.WriteAllText(_path, "[" + DateTime.Now + "] Los Santos Towing loaded" + Environment.NewLine);
            }
            catch { _enabled = false; }
        }

        public static void Write(string message)
        {
            if (!_enabled || _path == null) return;
            try { File.AppendAllText(_path, "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + message + Environment.NewLine); }
            catch { }
        }

        public static void Error(string where, Exception ex)
        {
            Write("ERROR in " + where + ": " + ex.GetType().Name + " - " + ex.Message);
            Write("  " + (ex.StackTrace ?? "").Replace(Environment.NewLine, " | "));
        }
    }
}
