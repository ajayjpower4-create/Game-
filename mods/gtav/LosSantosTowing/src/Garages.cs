// Where the work goes. Eight drop-offs at real Los Santos garages, all
// editable in the .ini - nothing here modifies the map, they are just marked
// points on the ground with a blip.
using GTA;
using GTA.Math;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace LosSantosTowing
{
    public sealed class Garage
    {
        public string Id;
        public string Name;
        public Vector3 Position;
        public Blip Blip;
    }

    public sealed class Garages
    {
        // Starting points only. Anything a little off can be fixed in-game with
        // the capture key, which rewrites the .ini from where you are standing.
        static readonly (string id, string name, float x, float y, float z)[] Defaults =
        {
            ("burton",   "Los Santos Customs, Burton",     -337.0f,  -136.0f, 39.0f),
            ("lamesa",   "Los Santos Customs, La Mesa",     731.0f, -1089.0f, 22.2f),
            ("airport",  "Los Santos Customs, the airport",-1155.0f, -2007.0f, 13.2f),
            ("bennys",   "Benny's Original Motor Works",   -205.0f, -1310.0f, 31.3f),
            ("beekers",  "Beeker's Garage, Route 68",      1175.0f,  2640.0f, 37.8f),
            ("paleto",   "Los Santos Customs, Paleto Bay",  105.0f,  6620.0f, 31.9f),
            ("impound",  "Davis impound lot",               409.0f, -1622.0f, 29.3f),
            ("yard",     "The yard, Cypress Flats",         900.0f, -2270.0f, 30.5f),
        };

        readonly List<Garage> _list = new List<Garage>();
        readonly ScriptSettings _settings;

        public Garages(ScriptSettings settings)
        {
            _settings = settings;
            foreach (var d in Defaults)
            {
                var pos = ReadVector(d.id, new Vector3(d.x, d.y, d.z));
                _list.Add(new Garage { Id = d.id, Name = _settings.GetValue("garages", d.id + "_name", d.name), Position = pos });
            }
        }

        public IEnumerable<Garage> All { get { return _list; } }

        public Garage ById(string id)
        {
            return _list.FirstOrDefault(g => g.Id == id);
        }

        public Garage Random(System.Random rng)
        {
            return _list[rng.Next(_list.Count)];
        }

        public Garage Nearest(Vector3 from)
        {
            Garage best = null;
            float bestDist = float.MaxValue;
            foreach (var g in _list)
            {
                float d = g.Position.DistanceTo(from);
                if (d < bestDist) { bestDist = d; best = g; }
            }
            return best;
        }

        Vector3 ReadVector(string id, Vector3 fallback)
        {
            string raw = _settings.GetValue("garages", id, "");
            if (string.IsNullOrEmpty(raw)) return fallback;
            var parts = raw.Split(',');
            if (parts.Length != 3) return fallback;
            float x, y, z;
            if (float.TryParse(parts[0].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out x) &&
                float.TryParse(parts[1].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out y) &&
                float.TryParse(parts[2].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out z))
            {
                return new Vector3(x, y, z);
            }
            return fallback;
        }

        /// Moves the nearest drop-off to a position and writes it back to the ini.
        public Garage Capture(Vector3 position)
        {
            var g = Nearest(position);
            if (g == null) return null;
            g.Position = position;
            _settings.SetValue("garages", g.Id, string.Format(CultureInfo.InvariantCulture,
                "{0:0.00}, {1:0.00}, {2:0.00}", position.X, position.Y, position.Z));
            _settings.Save();
            if (g.Blip != null && g.Blip.Exists()) g.Blip.Position = position;
            return g;
        }

        public void ShowBlips(bool show)
        {
            foreach (var g in _list)
            {
                if (show)
                {
                    if (g.Blip == null || !g.Blip.Exists())
                    {
                        g.Blip = World.CreateBlip(g.Position);
                        g.Blip.Sprite = BlipSprite.Garage;
                        g.Blip.Color = BlipColor.GreyDark;
                        g.Blip.Scale = 0.8f;
                        g.Blip.IsShortRange = true;
                        g.Blip.Name = g.Name;
                    }
                }
                else if (g.Blip != null && g.Blip.Exists())
                {
                    g.Blip.Delete();
                    g.Blip = null;
                }
            }
        }
    }
}
