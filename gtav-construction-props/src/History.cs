using System;
using System.Collections.Generic;
using GTA.Math;

namespace ConstructionProps
{
    internal enum EditKind { Add, Remove, Transform }

    internal class EditAction
    {
        public EditKind Kind;
        public PlacedProp Target;          // live reference for Remove/Transform
        public PlacedProp Snapshot;        // data copy for Add/Remove
        public Vector3 OldPosition, NewPosition;
        public Vector3 OldRotation, NewRotation;
    }

    /// <summary>Bounded undo/redo. Bounded because a builder session can run for hours.</summary>
    internal class History
    {
        const int MaxDepth = 200;

        readonly List<EditAction> undo = new List<EditAction>();
        readonly List<EditAction> redo = new List<EditAction>();

        public int UndoDepth { get { return undo.Count; } }
        public int RedoDepth { get { return redo.Count; } }

        public void Push(EditAction a)
        {
            undo.Add(a);
            if (undo.Count > MaxDepth) undo.RemoveAt(0);
            redo.Clear();
        }

        public EditAction PopUndo()
        {
            if (undo.Count == 0) return null;
            var a = undo[undo.Count - 1];
            undo.RemoveAt(undo.Count - 1);
            redo.Add(a);
            if (redo.Count > MaxDepth) redo.RemoveAt(0);
            return a;
        }

        public EditAction PopRedo()
        {
            if (redo.Count == 0) return null;
            var a = redo[redo.Count - 1];
            redo.RemoveAt(redo.Count - 1);
            undo.Add(a);
            return a;
        }

        public void Clear()
        {
            undo.Clear();
            redo.Clear();
        }
    }
}
