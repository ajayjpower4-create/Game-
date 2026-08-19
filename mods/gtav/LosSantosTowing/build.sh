#!/usr/bin/env bash
# Builds LosSantosTowing.dll. Needs the .NET SDK; works on Windows, macOS or Linux.
set -euo pipefail
cd "$(dirname "$0")"
dotnet build -c Release "$@"
echo
echo "Built: $(pwd)/bin/Release/LosSantosTowing.dll"
echo "Copy it and LosSantosTowing.ini into your GTA V\\scripts\\ folder."
