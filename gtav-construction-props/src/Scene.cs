using System;
using System.Collections.Generic;
using System.IO;
using GTA;
using GTA.Math;

namespace ConstructionProps
{
    /// <summary>
    /// One placed prop. This is pure data - it exists whether or not the prop is
    /// currently spawned in the world. That split is the whole trick behind
    /// keeping thousand-prop scenes playable.
    /// </summary>
    internal class PlacedProp
    {
        public int Id;
        public int ModelHash;
        public string ModelName;
        public Vector3 Position;
        public Vector3 Rotation;
        public bool Collision = true;
        public bool Frozen = true;

        // Runtime only - never serialised.
        public Prop Live;
        public long CellKey;
        public bool CollisionApplied = true;

        public PlacedProp Clone()
        {
            return new PlacedProp
            {
                Id = Id,
                ModelHash = ModelHash,
                ModelName = ModelName,
                Position = Position,
                Rotation = Rotation,
                Collision = Collision,
                Frozen = Frozen
            };
        }

        public Json ToJson()
        {
            var o = Json.NewObject();
            o["model"] = Json.Str(ModelName);
            var p = Json.NewArray();
            p.Array.Add(Json.Num(Position.X));
            p.Array.Add(Json.Num(Position.Y));
            p.Array.Add(Json.Num(Position.Z));
            o["pos"] = p;
            var r = Json.NewArray();
            r.Array.Add(Json.Num(Rotation.X));
            r.Array.Add(Json.Num(Rotation.Y));
            r.Array.Add(Json.Num(Rotation.Z));
            o["rot"] = r;
            o["collision"] = Json.Bl(Collision);
            o["frozen"] = Json.Bl(Frozen);
            return o;
        }

        public static PlacedProp FromJson(Json o)
        {
            string model = o.Opt("model").AsString(null);
            if (string.IsNullOrEmpty(model)) return null;

            var pos = o["pos"];
            var rot = o["rot"];
            if (pos == null || pos.Kind != JsonKind.Array || pos.Array.Count < 3) return null;

            var pp = new PlacedProp
            {
                ModelName = model,
                ModelHash = Game.GenerateHash(model),
                Position = new Vector3(pos.Array[0].AsFloat(0), pos.Array[1].AsFloat(0), pos.Array[2].AsFloat(0)),
                Collision = o.Opt("collision").AsBool(true),
                Frozen = o.Opt("frozen").AsBool(true)
            };
            if (rot != null && rot.Kind == JsonKind.Array && rot.Array.Count >= 3)
                pp.Rotation = new Vector3(rot.Array[0].AsFloat(0), rot.Array[1].AsFloat(0), rot.Array[2].AsFloat(0));
            return pp;
        }
    }

    /// <summary>
    /// A named collection of placed props, indexed by a flat 32m spatial grid so
    /// the streamer can ask "what is near the camera" without walking the whole
    /// list every frame.
    /// </summary>
    internal class Scene
    {
        public const float CellSize = 32f;

        public string Name = "untitled";
        public readonly List<PlacedProp> Props = new List<PlacedProp>();
        public readonly Dictionary<long, List<PlacedProp>> Grid = new Dictionary<long, List<PlacedProp>>();
        public bool Dirty;

        int nextId = 1;

        public int Count { get { return Props.Count; } }

        public static long CellKeyFor(Vector3 p)
        {
            int cx = (int)Math.Floor(p.X / CellSize);
            int cy = (int)Math.Floor(p.Y / CellSize);
            return ((long)cx << 32) ^ (uint)cy;
        }

        public static long CellKeyFor(int cx, int cy)
        {
            return ((long)cx << 32) ^ (uint)cy;
        }

        public void Add(PlacedProp p)
        {
            if (p.Id == 0) p.Id = nextId++;
            else if (p.Id >= nextId) nextId = p.Id + 1;

            Props.Add(p);
            Index(p);
            Dirty = true;
        }

        public void Remove(PlacedProp p)
        {
            Props.Remove(p);
            Unindex(p);
            Dirty = true;
        }

        /// <summary>Call after moving a prop so the grid stays correct.</summary>
        public void Reindex(PlacedProp p)
        {
            long key = CellKeyFor(p.Position);
            if (key == p.CellKey) return;
            Unindex(p);
            Index(p);
            Dirty = true;
        }

        void Index(PlacedProp p)
        {
            p.CellKey = CellKeyFor(p.Position);
            List<PlacedProp> cell;
            if (!Grid.TryGetValue(p.CellKey, out cell))
            {
                cell = new List<PlacedProp>();
                Grid[p.CellKey] = cell;
            }
            cell.Add(p);
        }

        void Unindex(PlacedProp p)
        {
            List<PlacedProp> cell;
            if (Grid.TryGetValue(p.CellKey, out cell))
            {
                cell.Remove(p);
                if (cell.Count == 0) Grid.Remove(p.CellKey);
            }
        }

        public void Clear()
        {
            Props.Clear();
            Grid.Clear();
            nextId = 1;
            Dirty = true;
        }

        /// <summary>Fills <paramref name="into"/> with props whose cell overlaps the radius.</summary>
        public void QueryRadius(Vector3 center, float radius, List<PlacedProp> into)
        {
            into.Clear();
            int minX = (int)Math.Floor((center.X - radius) / CellSize);
            int maxX = (int)Math.Floor((center.X + radius) / CellSize);
            int minY = (int)Math.Floor((center.Y - radius) / CellSize);
            int maxY = (int)Math.Floor((center.Y + radius) / CellSize);

            for (int cx = minX; cx <= maxX; cx++)
            {
                for (int cy = minY; cy <= maxY; cy++)
                {
                    List<PlacedProp> cell;
                    if (!Grid.TryGetValue(CellKeyFor(cx, cy), out cell)) continue;
                    for (int i = 0; i < cell.Count; i++) into.Add(cell[i]);
                }
            }
        }

        public PlacedProp NearestTo(Vector3 point, float maxDistance)
        {
            PlacedProp best = null;
            float bestSq = maxDistance * maxDistance;
            int minX = (int)Math.Floor((point.X - maxDistance) / CellSize);
            int maxX = (int)Math.Floor((point.X + maxDistance) / CellSize);
            int minY = (int)Math.Floor((point.Y - maxDistance) / CellSize);
            int maxY = (int)Math.Floor((point.Y + maxDistance) / CellSize);

            for (int cx = minX; cx <= maxX; cx++)
            {
                for (int cy = minY; cy <= maxY; cy++)
                {
                    List<PlacedProp> cell;
                    if (!Grid.TryGetValue(CellKeyFor(cx, cy), out cell)) continue;
                    for (int i = 0; i < cell.Count; i++)
                    {
                        float d = (cell[i].Position - point).LengthSquared();
                        if (d < bestSq) { bestSq = d; best = cell[i]; }
                    }
                }
            }
            return best;
        }

        // ---------------- persistence ----------------

        public string ToJson()
        {
            var root = Json.NewObject();
            root["name"] = Json.Str(Name);
            root["version"] = Json.Num(1);
            root["saved"] = Json.Str(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            var arr = Json.NewArray();
            for (int i = 0; i < Props.Count; i++) arr.Array.Add(Props[i].ToJson());
            root["props"] = arr;
            return root.ToJson(true);
        }

        public static Scene FromJson(string text, string fallbackName)
        {
            var root = Json.Parse(text);
            var scene = new Scene { Name = root.Opt("name").AsString(fallbackName) };
            var props = root["props"];
            if (props != null)
            {
                foreach (var p in props.Items())
                {
                    var pp = PlacedProp.FromJson(p);
                    if (pp != null) scene.Add(pp);
                }
            }
            scene.Dirty = false;
            return scene;
        }

        public void SaveTo(string dir, string name)
        {
            Directory.CreateDirectory(dir);
            Name = name;
            string tmp = Path.Combine(dir, SafeName(name) + ".json.tmp");
            string final = Path.Combine(dir, SafeName(name) + ".json");
            File.WriteAllText(tmp, ToJson());
            if (File.Exists(final)) File.Delete(final);
            File.Move(tmp, final);
            Dirty = false;
        }

        public static Scene LoadFrom(string dir, string name)
        {
            string path = Path.Combine(dir, SafeName(name) + ".json");
            return FromJson(File.ReadAllText(path), name);
        }

        public static List<string> List(string dir)
        {
            var names = new List<string>();
            if (!Directory.Exists(dir)) return names;
            foreach (var f in Directory.GetFiles(dir, "*.json"))
                names.Add(Path.GetFileNameWithoutExtension(f));
            names.Sort(StringComparer.OrdinalIgnoreCase);
            return names;
        }

        public static string SafeName(string name)
        {
            if (string.IsNullOrEmpty(name)) return "untitled";
            var chars = name.ToCharArray();
            var invalid = Path.GetInvalidFileNameChars();
            for (int i = 0; i < chars.Length; i++)
                if (Array.IndexOf(invalid, chars[i]) >= 0) chars[i] = '_';
            return new string(chars).Trim();
        }
    }
}
