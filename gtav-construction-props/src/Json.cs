using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace ConstructionProps
{
    internal enum JsonKind { Null, Bool, Number, String, Array, Object }

    /// <summary>
    /// A tiny, dependency-free JSON reader/writer. Scene files and the prop
    /// catalog are plain JSON so people can hand-edit them, and shipping a
    /// Newtonsoft.Json.dll alongside a SHVDN script is a known source of
    /// assembly-binding pain, so we parse it ourselves.
    /// </summary>
    internal class Json
    {
        public JsonKind Kind;
        public bool Bool;
        public double Number;
        public string String;
        public List<Json> Array;
        public Dictionary<string, Json> Object;

        public static Json NewObject()
        {
            return new Json { Kind = JsonKind.Object, Object = new Dictionary<string, Json>() };
        }

        public static Json NewArray()
        {
            return new Json { Kind = JsonKind.Array, Array = new List<Json>() };
        }

        public static Json Str(string s)
        {
            return new Json { Kind = JsonKind.String, String = s ?? string.Empty };
        }

        public static Json Num(double d)
        {
            return new Json { Kind = JsonKind.Number, Number = d };
        }

        public static Json Bl(bool b)
        {
            return new Json { Kind = JsonKind.Bool, Bool = b };
        }

        static readonly Json MissingValue = new Json { Kind = JsonKind.Null };

        /// <summary>Null-safe member access, so a missing key reads as JSON null.</summary>
        public Json Opt(string key)
        {
            var v = this[key];
            return v ?? MissingValue;
        }

        public Json this[string key]
        {
            get
            {
                Json v;
                if (Kind == JsonKind.Object && Object.TryGetValue(key, out v)) return v;
                return null;
            }
            set
            {
                if (Kind != JsonKind.Object) throw new InvalidOperationException("not an object");
                Object[key] = value;
            }
        }

        public string AsString(string fallback)
        {
            return Kind == JsonKind.String ? String : fallback;
        }

        public double AsNumber(double fallback)
        {
            return Kind == JsonKind.Number ? Number : fallback;
        }

        public float AsFloat(float fallback)
        {
            return Kind == JsonKind.Number ? (float)Number : fallback;
        }

        public int AsInt(int fallback)
        {
            return Kind == JsonKind.Number ? (int)Math.Round(Number) : fallback;
        }

        public bool AsBool(bool fallback)
        {
            return Kind == JsonKind.Bool ? Bool : fallback;
        }

        public IEnumerable<Json> Items()
        {
            if (Kind == JsonKind.Array) return Array;
            return new List<Json>();
        }

        // ---------------- writing ----------------

        public string ToJson(bool pretty)
        {
            var sb = new StringBuilder(1024);
            Write(sb, pretty, 0);
            return sb.ToString();
        }

        void Write(StringBuilder sb, bool pretty, int depth)
        {
            switch (Kind)
            {
                case JsonKind.Null:
                    sb.Append("null");
                    break;
                case JsonKind.Bool:
                    sb.Append(Bool ? "true" : "false");
                    break;
                case JsonKind.Number:
                    sb.Append(FormatNumber(Number));
                    break;
                case JsonKind.String:
                    WriteString(sb, String);
                    break;
                case JsonKind.Array:
                    {
                        if (Array.Count == 0) { sb.Append("[]"); break; }
                        sb.Append('[');
                        for (int i = 0; i < Array.Count; i++)
                        {
                            if (i > 0) sb.Append(',');
                            if (pretty) NewLine(sb, depth + 1);
                            Array[i].Write(sb, pretty, depth + 1);
                        }
                        if (pretty) NewLine(sb, depth);
                        sb.Append(']');
                        break;
                    }
                case JsonKind.Object:
                    {
                        if (Object.Count == 0) { sb.Append("{}"); break; }
                        sb.Append('{');
                        bool first = true;
                        foreach (var kv in Object)
                        {
                            if (!first) sb.Append(',');
                            first = false;
                            if (pretty) NewLine(sb, depth + 1);
                            WriteString(sb, kv.Key);
                            sb.Append(':');
                            if (pretty) sb.Append(' ');
                            kv.Value.Write(sb, pretty, depth + 1);
                        }
                        if (pretty) NewLine(sb, depth);
                        sb.Append('}');
                        break;
                    }
            }
        }

        static void NewLine(StringBuilder sb, int depth)
        {
            sb.Append('\n');
            sb.Append(' ', depth * 2);
        }

        static string FormatNumber(double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) return "0";
            // Round-trippable but not littered with float noise.
            double r = Math.Round(d, 4);
            return r.ToString("0.####", CultureInfo.InvariantCulture);
        }

        static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        // ---------------- parsing ----------------

        public static Json Parse(string text)
        {
            int i = 0;
            Json v = ParseValue(text, ref i);
            SkipWhite(text, ref i);
            return v;
        }

        static void SkipWhite(string s, ref int i)
        {
            while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
        }

        static Json ParseValue(string s, ref int i)
        {
            SkipWhite(s, ref i);
            if (i >= s.Length) throw new FormatException("unexpected end of JSON");
            char c = s[i];
            switch (c)
            {
                case '{': return ParseObject(s, ref i);
                case '[': return ParseArray(s, ref i);
                case '"': return Str(ParseString(s, ref i));
                case 't':
                    Expect(s, ref i, "true");
                    return Bl(true);
                case 'f':
                    Expect(s, ref i, "false");
                    return Bl(false);
                case 'n':
                    Expect(s, ref i, "null");
                    return new Json { Kind = JsonKind.Null };
                default: return ParseNumber(s, ref i);
            }
        }

        static void Expect(string s, ref int i, string literal)
        {
            if (i + literal.Length > s.Length || string.CompareOrdinal(s, i, literal, 0, literal.Length) != 0)
                throw new FormatException("expected " + literal + " at " + i);
            i += literal.Length;
        }

        static Json ParseObject(string s, ref int i)
        {
            var o = NewObject();
            i++; // {
            SkipWhite(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return o; }
            while (true)
            {
                SkipWhite(s, ref i);
                string key = ParseString(s, ref i);
                SkipWhite(s, ref i);
                if (i >= s.Length || s[i] != ':') throw new FormatException("expected ':' at " + i);
                i++;
                o.Object[key] = ParseValue(s, ref i);
                SkipWhite(s, ref i);
                if (i >= s.Length) throw new FormatException("unterminated object");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == '}') { i++; return o; }
                throw new FormatException("expected ',' or '}' at " + i);
            }
        }

        static Json ParseArray(string s, ref int i)
        {
            var a = NewArray();
            i++; // [
            SkipWhite(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return a; }
            while (true)
            {
                a.Array.Add(ParseValue(s, ref i));
                SkipWhite(s, ref i);
                if (i >= s.Length) throw new FormatException("unterminated array");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == ']') { i++; return a; }
                throw new FormatException("expected ',' or ']' at " + i);
            }
        }

        static string ParseString(string s, ref int i)
        {
            if (i >= s.Length || s[i] != '"') throw new FormatException("expected string at " + i);
            i++;
            var sb = new StringBuilder();
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') return sb.ToString();
                if (c != '\\') { sb.Append(c); continue; }
                if (i >= s.Length) break;
                char e = s[i++];
                switch (e)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw new FormatException("bad \\u escape");
                        sb.Append((char)Convert.ToInt32(s.Substring(i, 4), 16));
                        i += 4;
                        break;
                    default: throw new FormatException("bad escape \\" + e);
                }
            }
            throw new FormatException("unterminated string");
        }

        static Json ParseNumber(string s, ref int i)
        {
            int start = i;
            if (i < s.Length && (s[i] == '-' || s[i] == '+')) i++;
            while (i < s.Length && ((s[i] >= '0' && s[i] <= '9') || s[i] == '.' || s[i] == 'e' || s[i] == 'E' ||
                                    ((s[i] == '-' || s[i] == '+') && (s[i - 1] == 'e' || s[i - 1] == 'E')))) i++;
            if (i == start) throw new FormatException("bad number at " + start);
            double d;
            if (!double.TryParse(s.Substring(start, i - start), NumberStyles.Float, CultureInfo.InvariantCulture, out d))
                throw new FormatException("bad number at " + start);
            return Num(d);
        }
    }
}
