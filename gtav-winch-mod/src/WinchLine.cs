using System;
using GTA;
using GTA.Math;
using GTA.Native;

namespace WinchMod
{
    /// <summary>
    /// One rope between two attach points.
    ///
    /// The visible rope is a native rope, but the towing is not left to it: the engine
    /// rope is deliberately kept ~15% longer than the winch length and acts only as a
    /// backstop, while a sequential-impulse constraint solved here does the actual
    /// pulling. That split is what keeps the line from either stretching like elastic
    /// or snapping the load across the street.
    /// </summary>
    internal class WinchLine
    {
        public AttachPoint A;
        public AttachPoint B;
        public float Length;
        public bool Broken;
        public readonly BedLock Bed = new BedLock();

        private int _rope;
        private float _lastTension;
        private bool _cut;

        public float Tension { get { return _lastTension; } }
        public bool Strapped { get { return Bed.Engaged; } }

        public static WinchLine Create(AttachPoint a, AttachPoint b)
        {
            if (a == null || b == null || !a.IsValid || !b.IsValid)
                return null;

            WinchLine line = new WinchLine();
            line.A = a;
            line.B = b;

            Vector3 pa = a.WorldPosition;
            Vector3 pb = b.WorldPosition;
            float dist = (pb - pa).Length();
            line.Length = PhysUtil.Clamp(dist, Config.MinLength, Config.MaxLength);

            float ropeMax = Math.Max(Config.MaxLength, dist + 2f);
            line._rope = Function.Call<int>(Hash.ADD_ROPE,
                pa.X, pa.Y, pa.Z,
                0f, 0f, 0f,
                ropeMax,
                Config.RopeType,
                dist,                       // initial length
                Config.MinLength,           // minimum length
                Config.SpoolSpeed,          // winding speed
                false, false,
                false,                      // not rigid: our solver owns the constraint
                1f,
                false,                      // do not break when shot; cutting is a key
                0);

            if (line._rope == 0)
                return null;

            Function.Call(Hash.ATTACH_ENTITIES_TO_ROPE, line._rope,
                a.Entity.Handle, b.Entity.Handle,
                pa.X, pa.Y, pa.Z,
                pb.X, pb.Y, pb.Z,
                dist * Config.NativeSlack,
                false, false,
                a.BoneName, b.BoneName);

            Function.Call(Hash.ROPE_SET_UPDATE_PINVERTS, line._rope);
            a.EnsurePersistent();
            b.EnsurePersistent();
            PhysUtil.ActivatePhysics(a.Entity);
            PhysUtil.ActivatePhysics(b.Entity);
            return line;
        }

        public bool EndsAlive
        {
            get { return A != null && B != null && A.IsValid && B.IsValid; }
        }

        public bool Involves(Entity entity)
        {
            if (entity == null) return false;
            return (A.IsValid && A.Entity.Handle == entity.Handle)
                || (B.IsValid && B.Entity.Handle == entity.Handle);
        }

        public void Spool(float metres)
        {
            Length = PhysUtil.Clamp(Length + metres, Config.MinLength, Config.MaxLength);
        }

        public void Update(float dt)
        {
            if (_cut || dt <= 0f || !EndsAlive)
                return;

            SyncRopeVisual();

            Bed.Update(dt);
            if (Bed.State == BedState.Free)
            {
                SolveConstraint(dt);
                TryAutoStrap();
            }
            else
            {
                _lastTension = 0f;
            }
        }

        private void SyncRopeVisual()
        {
            if (_rope == 0) return;
            Function.Call(Hash.ROPE_FORCE_LENGTH, _rope, Length * Config.NativeSlack);
        }

        private void SolveConstraint(float dt)
        {
            Vector3 pa = A.WorldPosition;
            Vector3 pb = B.WorldPosition;
            Vector3 delta = pb - pa;
            float dist = delta.Length();
            if (dist < 0.01f)
            {
                _lastTension = 0f;
                return;
            }

            Vector3 dir = delta / dist;
            float stretch = dist - Length;
            if (stretch <= 0f)
            {
                _lastTension = 0f;      // slack rope pushes on nothing
                return;
            }

            float invA = A.InverseMass;
            float invB = B.InverseMass;
            float invSum = invA + invB;
            if (invSum <= 0f)
            {
                _lastTension = 0f;      // both ends immovable
                return;
            }

            // Closing velocity along the rope. Positive means the ends are separating.
            float vRel = Vector3.Dot(B.Velocity - A.Velocity, dir);

            // Do not keep reeling two ends into each other once they are basically touching.
            if (dist < Config.NoCrushDistance && vRel < 0f)
            {
                _lastTension = 0f;
                return;
            }

            // Baumgarte position correction, capped so a big violation does not yank.
            float bias = Math.Min(Config.Beta * stretch / dt, Config.MaxPullSpeed);
            float j = -(vRel * Config.Damping + bias) / invSum;

            // Cap the impulse so the lighter end never gains more than MaxDeltaV in a frame.
            float heaviestInv = Math.Max(invA, invB);
            if (heaviestInv > 0f)
            {
                float maxJ = Config.MaxDeltaV / heaviestInv;
                if (j < -maxJ) j = -maxJ;
                if (j > maxJ) j = maxJ;
            }

            _lastTension = Math.Abs(j) / dt;
            if (Config.BreakUnderLoad && _lastTension > Config.BreakForce)
            {
                Broken = true;
                return;
            }

            Vector3 impulse = dir * j;
            B.ApplyImpulse(impulse);
            A.ApplyImpulse(-impulse);

            // Only once the line is actually pulling: drop handbrakes, ragdoll bodies.
            if (_lastTension > 500f)
            {
                A.PrepareForTow();
                B.PrepareForTow();
            }
        }

        private void TryAutoStrap()
        {
            if (!Config.AutoLockToBed)
                return;

            Vehicle carrier, load;
            if (!TryGetBedPair(out carrier, out load))
                return;

            if (Bed.AutoCanEngage(carrier, load))
                Bed.Engage(carrier, load);
        }

        /// <summary>Works out which end is the truck and which end is the load.</summary>
        public bool TryGetBedPair(out Vehicle carrier, out Vehicle load)
        {
            carrier = null;
            load = null;
            if (!EndsAlive)
                return false;

            Vehicle va = A.Entity as Vehicle;
            Vehicle vb = B.Entity as Vehicle;
            if (va == null || vb == null)
                return false;

            if (BedLock.IsCarrier(va) && !BedLock.IsCarrier(vb)) { carrier = va; load = vb; return true; }
            if (BedLock.IsCarrier(vb) && !BedLock.IsCarrier(va)) { carrier = vb; load = va; return true; }
            if (BedLock.IsCarrier(va) && BedLock.IsCarrier(vb))
            {
                // Two carriers: whichever one the other is sitting over gets to be the truck.
                if (BedLock.LoadIsOverBed(va, vb)) { carrier = va; load = vb; return true; }
                if (BedLock.LoadIsOverBed(vb, va)) { carrier = vb; load = va; return true; }
            }
            return false;
        }

        public bool ToggleStrap()
        {
            if (Bed.Engaged)
            {
                Bed.Release();
                return false;
            }

            Vehicle carrier, load;
            if (TryGetBedPair(out carrier, out load) && Bed.CanEngage(carrier, load))
            {
                Bed.Engage(carrier, load);
                return true;
            }
            return false;
        }

        /// <summary>
        /// Tearing a line down has to survive every order things can go wrong in: the
        /// rope already gone, an end deleted by the game, or a second cut on the same
        /// line. Each step is isolated so one failure cannot strand the others.
        /// </summary>
        public void Cut()
        {
            if (_cut)
                return;
            _cut = true;

            try
            {
                if (Bed.Engaged)
                    Bed.Release();
            }
            catch (Exception ex) { Log.Write("Cut: releasing the bed lock", ex); }

            DeleteRope();

            try { if (A != null) A.Cleanup(); }
            catch (Exception ex) { Log.Write("Cut: cleaning up the first end", ex); }

            try { if (B != null) B.Cleanup(); }
            catch (Exception ex) { Log.Write("Cut: cleaning up the second end", ex); }
        }

        private void DeleteRope()
        {
            int rope = _rope;
            _rope = 0;                       // never hand the same handle to the game twice
            if (rope == 0)
                return;

            try
            {
                // A rope whose attached entity has already been destroyed can leave a
                // stale handle behind, and DELETE_ROPE on one of those is not survivable.
                OutputArgument check = new OutputArgument(rope);
                if (!Function.Call<bool>(Hash.DOES_ROPE_EXIST, check))
                    return;

                OutputArgument handle = new OutputArgument(rope);
                Function.Call(Hash.DELETE_ROPE, handle);
            }
            catch (Exception ex) { Log.Write("Cut: deleting the rope", ex); }
        }
    }
}
