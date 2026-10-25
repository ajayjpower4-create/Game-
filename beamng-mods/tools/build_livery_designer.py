"""Bundles the Livery Designer sources into one HTML file that runs offline.

    python3 build_livery_designer.py <livery-designer folder> <output folder>

Writes LiveryDesigner.html (the app) and GUIDE.html (the guide on its own).

The word reader (Tesseract, Apache License 2.0) is packed into the page so the app
works offline. Its files are fetched from npm into <livery-designer>/vendor the
first time this runs.
"""
import base64
import subprocess
import sys
import tarfile
from pathlib import Path

root = Path(sys.argv[1])
src = root / "src"
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

# Word reader files: (npm package, file inside it)
OCR_FILES = {
    "tesseract.min.js": ("tesseract.js@7.0.0", "package/dist/tesseract.min.js"),
    "worker.min.js": ("tesseract.js@7.0.0", "package/dist/worker.min.js"),
    "tesseract-core-simd-lstm.wasm.js": ("tesseract.js-core@7.0.0", "package/tesseract-core-simd-lstm.wasm.js"),
    "eng.traineddata.gz": ("@tesseract.js-data/eng@1.0.0", "package/4.0.0_best_int/eng.traineddata.gz"),
    "LICENSE-tesseract.js.txt": ("tesseract.js@7.0.0", "package/LICENSE.md"),
    "LICENSE-tesseract.js-core.txt": ("tesseract.js-core@7.0.0", "package/LICENSE"),
}


def vendor_file(name):
    vendor = root / "vendor"
    path = vendor / name
    if not path.exists():
        vendor.mkdir(exist_ok=True)
        package, inner = OCR_FILES[name]
        tgz = subprocess.run(["npm", "pack", package, "--silent"], cwd=vendor, check=True,
                             capture_output=True, text=True).stdout.strip().splitlines()[-1]
        with tarfile.open(vendor / tgz) as tar:
            path.write_bytes(tar.extractfile(inner).read())
    return path


ocr_text = {name: vendor_file(name).read_text() for name in ("tesseract.min.js", "worker.min.js", "tesseract-core-simd-lstm.wasm.js")}
for name in ("LICENSE-tesseract.js.txt", "LICENSE-tesseract.js-core.txt"):
    vendor_file(name)
for name, text in ocr_text.items():
    assert "</script" not in text and "<!--" not in text, name
eng = base64.b64encode(vendor_file("eng.traineddata.gz").read_bytes()).decode()
ocr_blocks = (
    '<script type="text/plain" id="ocr-core">' + ocr_text["tesseract-core-simd-lstm.wasm.js"] + "</script>\n"
    '<script type="text/plain" id="ocr-worker">' + ocr_text["worker.min.js"] + "</script>\n"
    '<script type="text/plain" id="ocr-eng">' + eng + "</script>\n"
    "<!-- Word reader: Tesseract via tesseract.js (Apache License 2.0) -->\n"
    "<script>" + ocr_text["tesseract.min.js"] + "</script>"
)

css = (src / "styles.css").read_text()
guide = (src / "guide.html").read_text()
scripts = "\n".join((src / name).read_text() for name in ("zip.js", "dds.js", "uvmap.js", "textfix.js", "app.js"))
page = (src / "index.html").read_text()
for marker, text in (("/*STYLES*/", css), ("<!--GUIDE-->", guide), ("/*SCRIPTS*/", scripts), ("<!--OCR-->", ocr_blocks)):
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
