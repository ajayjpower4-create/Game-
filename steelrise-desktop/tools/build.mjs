// Bundles the game into build/ (index.html + game.js + style.css).
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";

mkdirSync("build", { recursive: true });
await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outfile: "build/game.js",
  minify: process.argv.includes("--min"),
  sourcemap: !process.argv.includes("--min"),
  logLevel: "warning",
});
copyFileSync("src/index.html", "build/index.html");
copyFileSync("src/style.css", "build/style.css");
console.log("built build/game.js");
