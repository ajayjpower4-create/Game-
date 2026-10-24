"""Bundles the Livery Designer sources into one HTML file that runs offline.

    python3 build_livery_designer.py <livery-designer folder> <output folder>

Writes LiveryDesigner.html (the app) and GUIDE.html (the guide on its own).
"""
import sys
from pathlib import Path

src = Path(sys.argv[1]) / "src"
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

css = (src / "styles.css").read_text()
guide = (src / "guide.html").read_text()
scripts = "\n".join((src / name).read_text() for name in ("zip.js", "dds.js", "uvmap.js", "app.js"))
page = (src / "index.html").read_text()
for marker, text in (("/*STYLES*/", css), ("<!--GUIDE-->", guide), ("/*SCRIPTS*/", scripts)):
    assert page.count(marker) == 1, marker
    page = page.replace(marker, text)
assert "</script" not in scripts, "a script contains </script"
(out / "LiveryDesigner.html").write_text(page)

guide_page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Livery Guide</title>
<style>
{css}
html, body {{ overflow: auto; height: auto; }}
main {{ max-width: 900px; margin: 0 auto; padding: 20px 16px 60px; }}
main > h1 {{ font-size: 24px; margin: 6px 0 4px; }}
</style>
</head>
<body>
<main class="guide">
<h1>BeamNG Livery Designer: how to make and install a livery</h1>
<p>Open <code>LiveryDesigner.html</code> to start. This guide is also inside the app (the <b>Guide</b> button).</p>
{guide}
</main>
</body>
</html>
"""
(out / "GUIDE.html").write_text(guide_page)
print("built", out / "LiveryDesigner.html", len(page), "bytes")
