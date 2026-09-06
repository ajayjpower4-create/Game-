using System;
using System.Collections.Generic;
using System.IO;
using GTA;

namespace ConstructionProps
{
    internal class PropEntry
    {
        public string Label;
        public string ModelName;
        public int Hash;

        /// <summary>
        /// Null until the model has been probed once. False means the model
        /// is not in this install (DLC missing, typo in a user catalog), and the
        /// menu greys it out instead of silently placing nothing.
        /// </summary>
        public bool? Valid;

        public PropEntry(string label, string model)
        {
            Label = label;
            ModelName = model;
            Hash = Game.GenerateHash(model);
        }
    }

    internal class PropCategory
    {
        public string Name;
        public List<PropEntry> Entries = new List<PropEntry>();

        public PropCategory(string name) { Name = name; }

        public PropCategory Add(string label, string model)
        {
            Entries.Add(new PropEntry(label, model));
            return this;
        }
    }

    /// <summary>
    /// The construction prop catalog. Built in, but everything here can be
    /// replaced or extended by dropping a props.json next to the script.
    /// </summary>
    internal static class Catalog
    {
        public static List<PropCategory> Categories = new List<PropCategory>();
        static readonly Dictionary<int, PropEntry> ByHash = new Dictionary<int, PropEntry>();

        public static void Build(string dataDir, Action<string> log)
        {
            Categories.Clear();
            ByHash.Clear();
            BuildDefaults();

            string userFile = Path.Combine(dataDir, "props.json");
            if (File.Exists(userFile))
            {
                try
                {
                    MergeUserCatalog(File.ReadAllText(userFile));
                    log("Merged custom prop catalog from props.json");
                }
                catch (Exception ex)
                {
                    log("props.json is malformed, ignoring it: " + ex.Message);
                }
            }

            foreach (var cat in Categories)
                foreach (var e in cat.Entries)
                    ByHash[e.Hash] = e;
        }

        public static PropEntry Find(int hash)
        {
            PropEntry e;
            return ByHash.TryGetValue(hash, out e) ? e : null;
        }

        public static string LabelFor(int hash, string fallback)
        {
            var e = Find(hash);
            return e != null ? e.Label : fallback;
        }

        static void MergeUserCatalog(string text)
        {
            var root = Json.Parse(text);
            var cats = root["categories"];
            if (cats == null) return;

            foreach (var c in cats.Items())
            {
                string name = c.Opt("name").AsString("Custom");
                bool replace = c["replace"] != null && c["replace"].AsBool(false);

                PropCategory target = Categories.Find(x => x.Name == name);
                if (target == null)
                {
                    target = new PropCategory(name);
                    Categories.Add(target);
                }
                else if (replace)
                {
                    target.Entries.Clear();
                }

                var props = c["props"];
                if (props == null) continue;
                foreach (var p in props.Items())
                {
                    if (p.Kind == JsonKind.String)
                    {
                        target.Add(Prettify(p.String), p.String);
                        continue;
                    }
                    string model = p.Opt("model").AsString(null);
                    if (string.IsNullOrEmpty(model)) continue;
                    string label = p.Opt("label").AsString(Prettify(model));
                    target.Add(label, model);
                }
            }
        }

        /// <summary>prop_barrier_work01a -> "Barrier Work01a", so unlabelled user entries stay readable.</summary>
        static string Prettify(string model)
        {
            string s = model;
            if (s.StartsWith("prop_")) s = s.Substring(5);
            else if (s.StartsWith("p_")) s = s.Substring(2);
            s = s.Replace('_', ' ').Trim();
            if (s.Length == 0) return model;
            var parts = s.Split(' ');
            for (int i = 0; i < parts.Length; i++)
                if (parts[i].Length > 0)
                    parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
            return string.Join(" ", parts);
        }

        static void BuildDefaults()
        {
            Categories.Add(new PropCategory("Barriers & Fencing")
                .Add("Work Barrier A", "prop_barrier_work01a")
                .Add("Work Barrier B", "prop_barrier_work02a")
                .Add("Work Barrier Long", "prop_barrier_work04a")
                .Add("Work Barrier Short", "prop_barrier_work05")
                .Add("Work Barrier Heavy", "prop_barrier_work06a")
                .Add("Work Barrier Heavy B", "prop_barrier_work06b")
                .Add("Concrete Barrier 1", "prop_barier_conc_01a")
                .Add("Concrete Barrier 2", "prop_barier_conc_02a")
                .Add("Concrete Barrier 3", "prop_barier_conc_03a")
                .Add("Concrete Barrier 4", "prop_barier_conc_04a")
                .Add("Concrete Barrier 5", "prop_barier_conc_05a")
                .Add("Water Barrier 1", "prop_barrier_wat_01a")
                .Add("Water Barrier 2", "prop_barrier_wat_02a")
                .Add("Water Barrier 3", "prop_barrier_wat_03a")
                .Add("Water Barrier 4", "prop_barrier_wat_04a")
                .Add("MP Barrier", "prop_mp_barrier_01")
                .Add("MP Barrier Wide", "prop_mp_barrier_02")
                .Add("MP Barrier Wide B", "prop_mp_barrier_02b")
                .Add("Site Fence Panel 1", "prop_fncconstruc_01a")
                .Add("Site Fence Panel 2", "prop_fncconstruc_02a")
                .Add("Site Fence Panel 3", "prop_fncconstruc_03a")
                .Add("Site Fence Panel 4", "prop_fncconstruc_04a"));

            Categories.Add(new PropCategory("Cones & Signage")
                .Add("Road Cone A", "prop_roadcone01a")
                .Add("Road Cone B", "prop_roadcone01b")
                .Add("Road Cone C", "prop_roadcone01c")
                .Add("Road Cone Small A", "prop_roadcone02a")
                .Add("Road Cone Small B", "prop_roadcone02b")
                .Add("Road Cone Small C", "prop_roadcone02c")
                .Add("MP Cone 1", "prop_mp_cone_01")
                .Add("MP Cone 2", "prop_mp_cone_02")
                .Add("MP Cone 3", "prop_mp_cone_03")
                .Add("MP Cone 4", "prop_mp_cone_04")
                .Add("Site Sign 1", "prop_consign_01a")
                .Add("Site Sign 2", "prop_consign_02a")
                .Add("Site Sign 3", "prop_consign_03a")
                .Add("Site Sign 4", "prop_consign_04a")
                .Add("Site Sign 5", "prop_consign_05a"));

            Categories.Add(new PropCategory("Scaffolding & Frames")
                .Add("Scaffold Section 1", "prop_scafold_01a")
                .Add("Scaffold Section 2", "prop_scafold_02a")
                .Add("Scaffold Section 3", "prop_scafold_03a")
                .Add("Scaffold Section 4", "prop_scafold_04a")
                .Add("Scaffold Section 5", "prop_scafold_05a")
                .Add("Scaffold Section 6", "prop_scafold_06a")
                .Add("Scaffold Frame 1", "prop_scafold_frame1a")
                .Add("Scaffold Frame 2", "prop_scafold_frame2a")
                .Add("Scaffold Frame 3", "prop_scafold_frame3a")
                .Add("Scaffold Frame 3C", "prop_scafold_frame3a_c")
                .Add("Scaffold Cross Beam", "prop_scafold_xbeam")
                .Add("Ladder Short", "prop_ladder_01a")
                .Add("Ladder Tall", "prop_ladder_02")
                .Add("Ladder Extension", "prop_ladder_03"));

            Categories.Add(new PropCategory("Materials & Pallets")
                .Add("Pallet 1", "prop_pallet_01a")
                .Add("Pallet 2", "prop_pallet_02a")
                .Add("Pallet 3", "prop_pallet_03a")
                .Add("Pallet 4", "prop_pallet_04a")
                .Add("Pallet 5", "prop_pallet_05a")
                .Add("Pallet Stack 1", "prop_pallet_pile_01")
                .Add("Pallet Stack 2", "prop_pallet_pile_02")
                .Add("Pallet Stack 3", "prop_pallet_pile_03")
                .Add("Cement Bags 1", "prop_cementbags01")
                .Add("Cement Bags 2", "prop_cementbags02")
                .Add("Sand Sacks", "prop_conc_sacks_01a")
                .Add("Box Pile 1", "prop_boxpile_01a")
                .Add("Box Pile 2", "prop_boxpile_02a")
                .Add("Box Pile 3", "prop_boxpile_03a")
                .Add("Crate Pile", "prop_boxpile_06a"));

            Categories.Add(new PropCategory("Machinery & Tools")
                .Add("Cement Mixer", "prop_cement_mixer01")
                .Add("Work Bench 1", "prop_tool_bench01")
                .Add("Work Bench 2", "prop_tool_bench02")
                .Add("Tool Chest 1", "prop_toolchest_01")
                .Add("Tool Chest 2", "prop_toolchest_02")
                .Add("Tool Chest 3", "prop_toolchest_03")
                .Add("Tool Chest 4", "prop_toolchest_04")
                .Add("Tool Chest 5", "prop_toolchest_05")
                .Add("Jackhammer", "prop_tool_jackhamr")
                .Add("Shovel", "prop_tool_shovel")
                .Add("Pickaxe", "prop_tool_pickaxe")
                .Add("Sledgehammer", "prop_tool_sledgeham")
                .Add("Wheelbarrow 1", "prop_wheelbarrow01a")
                .Add("Wheelbarrow 2", "prop_wheelbarrow02a")
                .Add("Bucket", "prop_bucket_01a"));

            Categories.Add(new PropCategory("Site Structures")
                .Add("Site Cabin", "prop_portacabin01")
                .Add("Portable Toilet", "prop_portaloo_01a")
                .Add("Shipping Container", "prop_container_01a")
                .Add("Container Open", "prop_container_01mb")
                .Add("Container Rusty", "prop_container_03a")
                .Add("Container Small", "prop_container_05a")
                .Add("Container Stack", "prop_container_07a"));

            Categories.Add(new PropCategory("Lighting & Power")
                .Add("Work Light 1", "prop_worklight_01a")
                .Add("Work Light 2", "prop_worklight_02a")
                .Add("Work Light 3", "prop_worklight_03a")
                .Add("Work Light 3B", "prop_worklight_03b")
                .Add("Work Light 4", "prop_worklight_04a")
                .Add("Generator 1", "prop_generator_01a")
                .Add("Generator 2", "prop_generator_03a")
                .Add("Electrical Box", "prop_elecbox_01a")
                .Add("Junction Box", "prop_elecbox_16a"));

            Categories.Add(new PropCategory("Debris & Waste")
                .Add("Skip 1", "prop_skip_01a")
                .Add("Skip 2", "prop_skip_02a")
                .Add("Skip 3", "prop_skip_03")
                .Add("Skip 4", "prop_skip_04a")
                .Add("Skip 5", "prop_skip_05a")
                .Add("Skip 8", "prop_skip_08a")
                .Add("Dumpster 1", "prop_dumpster_01a")
                .Add("Dumpster 2", "prop_dumpster_02a")
                .Add("Dumpster 2B", "prop_dumpster_02b")
                .Add("Dumpster 3", "prop_dumpster_03a")
                .Add("Dumpster 4", "prop_dumpster_4a")
                .Add("Rubble Cage", "prop_rub_cage01a")
                .Add("Rubbish Pile 1", "prop_rub_boxpile_01a")
                .Add("Rubbish Pile 2", "prop_rub_boxpile_02a")
                .Add("Rubbish Pile 3", "prop_rub_boxpile_03a"));
        }
    }
}
