using System;
using System.Collections.Generic;
using GTA;
using GTA.Math;

namespace ConstructionProps
{
    /// <summary>
    /// Turns scene data into world entities, a few at a time, only where the
    /// camera can see them.
    ///
    /// The rules that keep frame time flat:
    ///   1. Only props inside the stream radius exist as entities at all.
    ///   2. Spawning and despawning are budgeted per pass, never bulk.
    ///   3. Passes run on a timer, not every frame.
    ///   4. Everything spawned is frozen and non-dynamic, so it costs the
    ///      physics step nothing, and collision is switched off past a radius.
    ///   5. A hard entity cap protects the game's own object pool.
    /// </summary>
    internal class PropStreamer
    {
        readonly Config cfg;
        readonly ModelPool models;
        readonly List<PlacedProp> nearby = new List<PlacedProp>();
        readonly List<PlacedProp> liveList = new List<PlacedProp>();
        readonly List<PlacedProp> pendingSpawn = new List<PlacedProp>();
        readonly List<PlacedProp> overflow = new List<PlacedProp>();

        Scene scene;
        int lastPass;
        int validateCursor;

        public int LiveCount { get; private set; }
        public int PendingCount { get; private set; }
        public float LastPassMs { get; private set; }

        public PropStreamer(Config cfg, Scene scene)
        {
            this.cfg = cfg;
            this.scene = scene;
            models = new ModelPool(cfg);
        }

        public void SwapScene(Scene next)
        {
            DespawnAll();
            scene = next;
        }

        public bool IsModelUnavailable(int hash)
        {
            return models.IsKnownInvalid(hash);
        }

        /// <summary>Force a single prop into the world now (used right after placing one).</summary>
        public void SpawnImmediate(PlacedProp p)
        {
            if (p.Live != null && p.Live.Exists()) return;
            Spawn(p);
        }

        /// <summary>Finds the scene record behind a world entity, for grab/delete under the cursor.</summary>
        public PlacedProp FindLive(Entity e)
        {
            if (e == null) return null;
            int handle = e.Handle;
            for (int i = 0; i < liveList.Count; i++)
            {
                var p = liveList[i];
                if (p.Live != null && p.Live.Handle == handle) return p;
            }
            return null;
        }

        public void Despawn(PlacedProp p)
        {
            if (p.Live == null) return;
            if (p.Live.Exists()) p.Live.Delete();
            p.Live = null;
            liveList.Remove(p);
            models.Release(p.ModelHash);
        }

        public void DespawnAll()
        {
            for (int i = 0; i < liveList.Count; i++)
            {
                var p = liveList[i];
                if (p.Live != null && p.Live.Exists()) p.Live.Delete();
                p.Live = null;
            }
            liveList.Clear();
            pendingSpawn.Clear();
            models.ReleaseAll();
            LiveCount = 0;
            PendingCount = 0;
        }

        /// <summary>Re-apply transform to a live entity after an edit.</summary>
        public void Refresh(PlacedProp p)
        {
            if (p.Live == null || !p.Live.Exists()) return;
            N.Freeze(p.Live, false);
            p.Live.Position = p.Position;
            p.Live.Rotation = p.Rotation;
            N.SetCollision(p.Live, p.Collision);
            p.CollisionApplied = p.Collision;
            N.Freeze(p.Live, p.Frozen);
            N.SetDynamic(p.Live, !p.Frozen);
        }

        public void Update(Vector3 camPos)
        {
            int now = Game.GameTime;
            if (now - lastPass < cfg.StreamIntervalMs) return;
            lastPass = now;

            int startTick = Environment.TickCount;

            float radius = cfg.StreamRadius;
            float keepRadius = radius + cfg.DespawnMargin;
            float keepSq = keepRadius * keepRadius;
            float radiusSq = radius * radius;
            float physSq = cfg.PhysicsRadius * cfg.PhysicsRadius;

            // 1. Retire anything that has wandered out of range, plus anything the
            //    game deleted behind our back.
            int despawns = 0;
            for (int i = liveList.Count - 1; i >= 0; i--)
            {
                var p = liveList[i];
                if (p.Live == null || !p.Live.Exists())
                {
                    liveList.RemoveAt(i);
                    models.Release(p.ModelHash);
                    p.Live = null;
                    continue;
                }

                float dSq = (p.Position - camPos).LengthSquared();
                if (dSq > keepSq)
                {
                    if (despawns >= cfg.DespawnsPerPass) continue;
                    despawns++;
                    p.Live.Delete();
                    p.Live = null;
                    liveList.RemoveAt(i);
                    models.Release(p.ModelHash);
                    continue;
                }

                // Cheap physics culling: geometry stays, collision does not.
                bool wantCollision = p.Collision && dSq <= physSq;
                if (wantCollision != p.CollisionApplied)
                {
                    N.SetCollision(p.Live, wantCollision);
                    p.CollisionApplied = wantCollision;
                }
            }

            // 2. Work out what should be here but is not.
            scene.QueryRadius(camPos, radius, nearby);
            pendingSpawn.Clear();
            for (int i = 0; i < nearby.Count; i++)
            {
                var p = nearby[i];
                if (p.Live != null && p.Live.Exists()) continue;
                if (models.IsKnownInvalid(p.ModelHash)) continue;
                if ((p.Position - camPos).LengthSquared() > radiusSq) continue;
                pendingSpawn.Add(p);
            }
            PendingCount = pendingSpawn.Count;

            // 3. Nearest first, so what is in the player's face appears first.
            if (pendingSpawn.Count > cfg.SpawnsPerPass)
            {
                Vector3 c = camPos;
                pendingSpawn.Sort((a, b) =>
                    (a.Position - c).LengthSquared().CompareTo((b.Position - c).LengthSquared()));
            }

            int budget = cfg.SpawnsPerPass;
            int room = cfg.MaxLiveProps - liveList.Count;
            if (budget > room) budget = room;

            for (int i = 0; i < pendingSpawn.Count && budget > 0; i++)
            {
                if (Spawn(pendingSpawn[i])) budget--;
            }

            // 4. If we are over the entity cap (radius was raised, or a scene was
            //    loaded on top of a dense one), shed the furthest props.
            if (liveList.Count > cfg.MaxLiveProps)
            {
                TrimToCap(camPos);
            }

            ValidateSlice();
            models.Sweep();

            LiveCount = liveList.Count;
            LastPassMs = Environment.TickCount - startTick;
        }

        void TrimToCap(Vector3 camPos)
        {
            overflow.Clear();
            overflow.AddRange(liveList);
            Vector3 c = camPos;
            overflow.Sort((a, b) =>
                (b.Position - c).LengthSquared().CompareTo((a.Position - c).LengthSquared()));

            int excess = liveList.Count - cfg.MaxLiveProps;
            int limit = Math.Min(excess, cfg.DespawnsPerPass * 4);
            for (int i = 0; i < limit; i++) Despawn(overflow[i]);
        }

        /// <summary>
        /// Spot-checks a handful of live props per pass for entities the game
        /// culled on us, instead of polling all of them every pass.
        /// </summary>
        void ValidateSlice()
        {
            int checks = Math.Min(48, liveList.Count);
            for (int i = 0; i < checks; i++)
            {
                if (validateCursor >= liveList.Count) validateCursor = 0;
                if (liveList.Count == 0) return;
                var p = liveList[validateCursor];
                if (p.Live == null || !p.Live.Exists())
                {
                    liveList.RemoveAt(validateCursor);
                    models.Release(p.ModelHash);
                    p.Live = null;
                }
                else validateCursor++;
            }
        }

        bool Spawn(PlacedProp p)
        {
            if (!models.TryLoad(p.ModelHash)) return false;

            var model = new Model(p.ModelHash);
            Prop prop = World.CreateProp(model, p.Position, p.Rotation, false, false);
            if (prop == null || !prop.Exists()) return false;

            models.AddRef(p.ModelHash);

            prop.IsPersistent = true;
            N.SetLoadCollisionFlag(prop, false);
            N.SetLodDist(prop, cfg.LodDistance);
            N.SetDynamic(prop, !p.Frozen);
            N.Freeze(prop, p.Frozen);

            bool wantCollision = p.Collision;
            N.SetCollision(prop, wantCollision);
            p.CollisionApplied = wantCollision;

            prop.IsInvincible = true;

            p.Live = prop;
            liveList.Add(p);
            return true;
        }
    }
}
