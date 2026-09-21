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
npm run dist
echo
echo "Installer and portable .exe are in desktop/release/"
