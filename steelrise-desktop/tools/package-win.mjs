// Packages build/ + electron/ into out/STEELRISE-win32-x64/STEELRISE.exe
import packager from "@electron/packager";
import { execSync } from "child_process";

execSync("node tools/build.mjs --min", { stdio: "inherit" });
const paths = await packager({
  dir: ".",
  out: "out",
  platform: "win32",
  arch: "x64",
  electronVersion: "33.2.1",
  name: "STEELRISE",
  executableName: "STEELRISE",
  appCopyright: "STEELRISE",
  overwrite: true,
  asar: true,
  prune: true,
  ignore: [/^\/src/, /^\/tools/, /^\/out/, /^\/node_modules/, /\.map$/],
});
console.log("packaged", paths);
