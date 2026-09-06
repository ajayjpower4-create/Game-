using System;
using System.Collections.Generic;
using GTA;

namespace ConstructionProps
{
    /// <summary>
    /// Reference-counted model streaming. Requests are asynchronous - we never
    /// block the script thread waiting on a model, because a blocking
    /// Model.Request(timeout) inside a tick is exactly what produces the
    /// stutter people blame mods for.
    /// </summary>
    internal class ModelPool
    {
        class State
        {
            public int Refs;
            public bool Requested;
            public bool Invalid;
            public int ReleasedAt;
        }

        readonly Dictionary<int, State> states = new Dictionary<int, State>();
        readonly List<int> sweepScratch = new List<int>();
        readonly Config cfg;
        int lastSweep;

        public ModelPool(Config cfg) { this.cfg = cfg; }

        State Get(int hash)
        {
            State s;
            if (!states.TryGetValue(hash, out s))
            {
                s = new State();
                states[hash] = s;
            }
            return s;
        }

        public bool IsKnownInvalid(int hash)
        {
            State s;
            return states.TryGetValue(hash, out s) && s.Invalid;
        }

        /// <summary>
        /// True once the model is resident. False means "not yet" - ask again on
        /// the next pass. Permanently invalid models return false and are
        /// remembered so we stop asking.
        /// </summary>
        public bool TryLoad(int hash)
        {
            var s = Get(hash);
            if (s.Invalid) return false;

            var model = new Model(hash);
            if (!model.IsValid)
            {
                s.Invalid = true;
                return false;
            }

            if (model.IsLoaded) return true;

            if (!s.Requested)
            {
                model.Request();
                s.Requested = true;
            }
            return false;
        }

        public void AddRef(int hash)
        {
            var s = Get(hash);
            s.Refs++;
        }

        public void Release(int hash)
        {
            State s;
            if (!states.TryGetValue(hash, out s)) return;
            s.Refs--;
            if (s.Refs <= 0)
            {
                s.Refs = 0;
                s.ReleasedAt = Game.GameTime;
            }
        }

        /// <summary>
        /// Hands models back to the streamer once nothing has used them for a
        /// while. The grace period stops a model thrashing in and out when the
        /// player paces back and forth across a scene boundary.
        /// </summary>
        public void Sweep()
        {
            int now = Game.GameTime;
            if (now - lastSweep < 1000) return;
            lastSweep = now;

            sweepScratch.Clear();
            foreach (var kv in states)
            {
                var s = kv.Value;
                if (s.Refs > 0 || !s.Requested || s.Invalid) continue;
                if (now - s.ReleasedAt < cfg.ModelUnloadGraceMs) continue;
                sweepScratch.Add(kv.Key);
            }

            for (int i = 0; i < sweepScratch.Count; i++)
            {
                int hash = sweepScratch[i];
                new Model(hash).MarkAsNoLongerNeeded();
                states[hash].Requested = false;
            }
        }

        /// <summary>Drop every request we are holding - used on unload.</summary>
        public void ReleaseAll()
        {
            foreach (var kv in states)
            {
                if (!kv.Value.Requested) continue;
                new Model(kv.Key).MarkAsNoLongerNeeded();
                kv.Value.Requested = false;
                kv.Value.Refs = 0;
            }
        }

        public int LoadedCount
        {
            get
            {
                int n = 0;
                foreach (var kv in states) if (kv.Value.Requested) n++;
                return n;
            }
        }
    }
}
