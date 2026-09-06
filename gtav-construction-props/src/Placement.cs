using System;
using System.Collections.Generic;
using GTA;
using GTA.Math;
using GTA.Native;

namespace ConstructionProps
{
    internal enum PlaceMode { Off, Placing, Moving }

    /// <summary>
    /// Cursor-to-world placement: a ghost prop rides the mouse ray, a click
    /// commits it to the scene. Only ever one ghost entity exists, and it is
    /// collision-free and non-dynamic, so hovering it around is free.
    /// </summary>
    internal class Placement
    {
        readonly Config cfg;
        readonly Dictionary<int, Vector3> dimensionCache = new Dictionary<int, Vector3>();

        public PlaceMode Mode = PlaceMode.Off;
        public PropEntry Selected;
        public bool SnapOn;
        public bool PaintMode;

        public float Heading;
        public float Pitch;
        public float Roll;
        public float HeightOffset;

        public Vector3 CursorWorld;
        public bool CursorValid;
        public Entity HoverEntity;

        Prop ghost;
        int ghostHash;
        Vector3 lastPaintPoint;
        bool hasPaintPoint;

        public PlacedProp Grabbed;
        public Vector3 GrabOriginalPosition;
        public Vector3 GrabOriginalRotation;

        public Placement(Config cfg)
        {
            this.cfg = cfg;
            SnapOn = cfg.SnapDefaultOn;
        }

        public bool HasGhost { get { return ghost != null && ghost.Exists(); } }

        public void Select(PropEntry entry)
        {
            Selected = entry;
            Mode = entry == null ? PlaceMode.Off : PlaceMode.Placing;
            HeightOffset = 0f;
            DestroyGhost();
        }

        public void Cancel()
        {
            Mode = PlaceMode.Off;
            Selected = null;
            Grabbed = null;
            PaintMode = false;
            hasPaintPoint = false;
            DestroyGhost();
        }

        public void DestroyGhost()
        {
            if (ghost != null && ghost.Exists()) ghost.Delete();
            ghost = null;
            if (ghostHash != 0)
            {
                // Hand the preview's model request back; live props keep their own.
                new Model(ghostHash).MarkAsNoLongerNeeded();
                ghostHash = 0;
            }
        }

        public void ResetRotation()
        {
            Heading = 0f;
            Pitch = 0f;
            Roll = 0f;
        }

        public void Rotate(float degrees, int axis)
        {
            switch (axis)
            {
                case 0: Pitch = Wrap(Pitch + degrees); break;
                case 1: Roll = Wrap(Roll + degrees); break;
                default: Heading = Wrap(Heading + degrees); break;
            }
        }

        static float Wrap(float d)
        {
            while (d >= 360f) d -= 360f;
            while (d < 0f) d += 360f;
            return d;
        }

        public Vector3 Rotation
        {
            get { return new Vector3(Pitch, Roll, Heading); }
        }

        /// <summary>
        /// Casts the mouse ray into the world and parks the ghost on whatever it
        /// hits. Called once per frame while the editor is up.
        /// </summary>
        public void UpdateCursor()
        {
            RaycastResult hit = CastFromCursor();
            HoverEntity = hit.DidHit ? hit.HitEntity : null;
            CursorValid = hit.DidHit;

            Vector3 point = hit.DidHit
                ? hit.HitPosition
                : N.CamCoord() + CursorDirection() * cfg.MaxPlaceDistance;

            if (SnapOn)
            {
                point.X = (float)Math.Round(point.X / cfg.SnapStep) * cfg.SnapStep;
                point.Y = (float)Math.Round(point.Y / cfg.SnapStep) * cfg.SnapStep;
            }

            CursorWorld = point;

            if (Mode == PlaceMode.Placing && Selected != null) UpdateGhost(Selected.Hash, point);
            else if (Mode == PlaceMode.Moving && Grabbed != null) UpdateGrabbed(point);
            else DestroyGhost();
        }

        void UpdateGrabbed(Vector3 point)
        {
            Grabbed.Position = SeatPosition(Grabbed.ModelHash, point);
            Grabbed.Rotation = Rotation;
            if (Grabbed.Live != null && Grabbed.Live.Exists())
            {
                N.Freeze(Grabbed.Live, false);
                Grabbed.Live.Position = Grabbed.Position;
                Grabbed.Live.Rotation = Grabbed.Rotation;
                N.Freeze(Grabbed.Live, true);
            }
        }

        void UpdateGhost(int hash, Vector3 point)
        {
            if (ghostHash != hash) DestroyGhost();

            Vector3 seated = SeatPosition(hash, point);

            if (ghost == null || !ghost.Exists())
            {
                var model = new Model(hash);
                if (!model.IsValid) { Selected.Valid = false; return; }
                if (!model.IsLoaded)
                {
                    model.Request();
                    return;
                }
                Selected.Valid = true;

                ghost = World.CreateProp(model, seated, Rotation, false, false);
                if (ghost == null || !ghost.Exists()) return;
                ghostHash = hash;
                ghost.IsPersistent = true;
                N.SetCollision(ghost, false);
                N.SetDynamic(ghost, false);
                N.Freeze(ghost, true);
                N.SetLodDist(ghost, cfg.LodDistance);
                ghost.IsInvincible = true;
            }

            N.SetAlpha(ghost, 160);
            N.Freeze(ghost, false);
            ghost.Position = seated;
            ghost.Rotation = Rotation;
            N.Freeze(ghost, true);
        }

        /// <summary>Lifts the model so its base sits on the hit surface instead of through it.</summary>
        public Vector3 SeatPosition(int hash, Vector3 point)
        {
            Vector3 min = Dimensions(hash);
            return new Vector3(point.X, point.Y, point.Z - min.Z + HeightOffset);
        }

        Vector3 Dimensions(int hash)
        {
            Vector3 min;
            if (dimensionCache.TryGetValue(hash, out min)) return min;

            var outMin = new OutputArgument();
            var outMax = new OutputArgument();
            Function.Call(Hash.GET_MODEL_DIMENSIONS, hash, outMin, outMax);
            min = outMin.GetResult<Vector3>();
            dimensionCache[hash] = min;
            return min;
        }

        /// <summary>Direction of the mouse cursor through the gameplay camera.</summary>
        public Vector3 CursorDirection()
        {
            float sx = N.CursorX();
            float sy = N.CursorY();
            float fov = N.CamFov();
            float aspect = N.AspectRatio();
            if (aspect <= 0.01f) aspect = 16f / 9f;

            Vector3 rot = N.CamRot();
            float pitch = rot.X * (float)Math.PI / 180f;
            float yaw = rot.Z * (float)Math.PI / 180f;

            var forward = new Vector3(
                -(float)(Math.Sin(yaw) * Math.Cos(pitch)),
                 (float)(Math.Cos(yaw) * Math.Cos(pitch)),
                 (float)Math.Sin(pitch));

            var right = Vector3.Cross(forward, Vector3.WorldUp);
            if (right.LengthSquared() < 0.0001f) right = new Vector3(1, 0, 0);
            right.Normalize();
            var up = Vector3.Cross(right, forward);

            // Cursor natives give 0..1 across the screen; convert to NDC.
            float ndcX = (sx - 0.5f) * 2f;
            float ndcY = (0.5f - sy) * 2f;

            float halfHeight = (float)Math.Tan(fov * 0.5f * Math.PI / 180f);
            Vector3 dir = forward + right * (ndcX * halfHeight * aspect) + up * (ndcY * halfHeight);
            dir.Normalize();
            return dir;
        }

        public RaycastResult CastFromCursor()
        {
            Vector3 origin = N.CamCoord();
            Vector3 dir = CursorDirection();
            Entity ignore = HasGhost ? (Entity)ghost : null;
            float range = cfg.MaxPlaceDistance;

            var result = World.Raycast(origin, dir, range, IntersectFlags.Everything, ignore);

            // The ray leaves the camera, which in third person sits behind the
            // player - skip past them rather than stacking props on their head.
            Ped player = Game.Player.Character;
            if (result.DidHit && result.HitEntity != null && player != null &&
                result.HitEntity.Handle == player.Handle)
            {
                float travelled = (result.HitPosition - origin).Length();
                Vector3 resume = result.HitPosition + dir * 0.5f;
                float remaining = range - travelled - 0.5f;
                if (remaining > 1f)
                    result = World.Raycast(resume, dir, remaining, IntersectFlags.Everything, player);
            }
            return result;
        }

        /// <summary>
        /// Builds the record for the prop under the cursor. Returns null if there
        /// is nothing to commit yet (model still streaming in).
        /// </summary>
        public PlacedProp BuildPlacement()
        {
            if (Selected == null) return null;
            var model = new Model(Selected.Hash);
            if (!model.IsValid) { Selected.Valid = false; return null; }

            return new PlacedProp
            {
                ModelHash = Selected.Hash,
                ModelName = Selected.ModelName,
                Position = SeatPosition(Selected.Hash, CursorWorld),
                Rotation = Rotation,
                Collision = cfg.CollisionByDefault,
                Frozen = true
            };
        }

        /// <summary>Spacing gate for drag-painting, so holding the button does not carpet-bomb props.</summary>
        public bool PaintGateOpen()
        {
            if (!hasPaintPoint) return true;
            return (CursorWorld - lastPaintPoint).Length() >= cfg.PaintSpacing;
        }

        public void MarkPainted()
        {
            lastPaintPoint = CursorWorld;
            hasPaintPoint = true;
        }

        public void ResetPaint()
        {
            hasPaintPoint = false;
        }
    }
}
