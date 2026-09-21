#!/usr/bin/env bash
# Build the Windows .exe. Run from desktop/:  ./build.sh
set -euo pipefail
cd "$(dirname "$0")"

# The desktop app runs the same UI the website serves, so copy it in fresh.
rm -rf ui && mkdir -p ui/madden
cp ../public/madden/* ui/madden/

# On the web the page pulls its assets from /madden/...; off the filesystem it
# needs relative paths, and the page itself sits one level up.
sed -e 's#"/madden/#"./madden/#g' ui/madden/index.html > ui/index.html
rm ui/madden/index.html

npm install

# Stamping the exe's icon and version strings runs a 32-bit Windows tool, so
# off Windows it needs wine. Without it, build anyway and skip that step — the
# app is identical, it just carries Electron's default icon.
if [ "$(uname -s)" != "Linux" ] || command -v wine >/dev/null 2>&1; then
  npx electron-builder --win portable nsis --x64
else
  echo "No wine found — building without the icon/version stamp."
  npx electron-builder --win portable --x64 -c.win.signAndEditExecutable=false
fi

echo
echo "Built into desktop/release/"
