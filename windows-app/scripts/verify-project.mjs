import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const EXPECTED_SPRITESHEET =
  "4d2f75a9cc142f1d4b2bd6edb119dc1dee55273236eda3c2147d3547995c8db2";

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadYaml(path) {
  return parse(await readFile(path, "utf8"));
}

const config = await loadJson("src-tauri/tauri.conf.json");
const capability = await loadJson("src-tauri/capabilities/default.json");
const rootWorkflow = await loadYaml(".github/workflows/windows-build.yml");
const nestedWorkflow = await loadYaml("integration/zhizhicat-windows-build.yml");
const atlas = await readFile("public/pets/zhizhi/spritesheet.webp");
const atlasHash = createHash("sha256").update(atlas).digest("hex");

const assertions = [
  [config.productName === "之之桌面宠物", "product name"],
  [config.mainBinaryName === "ZhizhiPet", "main binary name"],
  [config.app.windows[0].transparent === true, "transparent window"],
  [config.app.windows[0].decorations === false, "borderless window"],
  [config.app.windows[0].alwaysOnTop === true, "always-on-top window"],
  [config.app.windows[0].skipTaskbar === true, "taskbar-hidden window"],
  [config.bundle.targets.includes("nsis"), "NSIS target"],
  [
    config.bundle.windows.nsis.installMode === "currentUser",
    "current-user installer",
  ],
  [
    !capability.permissions.includes("core:window:allow-start-dragging"),
    "no WebView drag permission",
  ],
  [
    !capability.permissions.some((permission) =>
      /http|shell|clipboard|global-shortcut/.test(permission),
    ),
    "no network, shell, clipboard, or keyboard permission",
  ],
  [rootWorkflow.jobs?.["windows-x64"]?.["runs-on"] === "windows-latest", "root Windows workflow"],
  [
    nestedWorkflow.jobs?.["windows-x64"]?.defaults?.run?.["working-directory"] ===
      "windows-app",
    "zhizhicat nested workflow",
  ],
  [atlasHash === EXPECTED_SPRITESHEET, "approved Zhizhi artwork hash"],
];

for (const [valid, label] of assertions) {
  if (!valid) throw new Error(`Project verification failed: ${label}`);
}

console.log(`Verified ${assertions.length} project invariants.`);
console.log(`Zhizhi spritesheet SHA-256: ${atlasHash}`);
