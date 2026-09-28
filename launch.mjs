import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const root = dirname(fileURLToPath(import.meta.url));
const project = join(root, "petcare");
const runtime = join(project, ".sites-runtime");
const stateFile = join(runtime, "local-app.json");
const lockFile = join(runtime, "local-app-starting.json");
const configFile = join(project, "dist/server/wrangler.json");
const noBrowser = process.argv.includes("--no-browser");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
process.env.PATH = dirname(process.execPath) + ";" + process.env.PATH;
mkdirSync(runtime, { recursive: true });
function read(file) { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } }
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
const validState = (value) => value && value.project === project && Number.isInteger(value.pid) && value.pid > 0 && Number.isInteger(value.port) && value.port >= 5273 && value.port <= 5283;
const url = (port) => `http://127.0.0.1:${port}`;
async function ready(port) {
  try {
    const response = await fetch(url(port) + "/manifest.webmanifest", { signal: AbortSignal.timeout(2000) });
    if (!response.ok || (await response.json()).name !== "Pawday Pet Care") return false;
    const page = await fetch(url(port), { signal: AbortSignal.timeout(3000) });
    return page.ok;
  } catch { return false; }
}
function openApp(port) {
  const address = url(port);
  console.log("Pawday is ready: " + address);
  if (noBrowser) return;
  // Let Windows open the default browser without keeping a terminal window alive.
  const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", address], { detached: true, windowsHide: true, stdio: "ignore" });
  child.on("error", () => console.error("Open this address in your browser: " + address));
  child.unref();
}
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: project, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw Error("Setup failed. Please check the error above.");
}
function hasDatabase(directory) {
  if (!existsSync(directory)) return false;
  return readdirSync(directory, { withFileTypes: true }).some((entry) => entry.isDirectory() ? hasDatabase(join(directory, entry.name)) : entry.name.endsWith(".sqlite"));
}
async function free(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}
async function waitReady(state) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await ready(state.port)) return;
    if (!alive(state.pid)) throw Error("Pawday stopped. Check petcare/.sites-runtime/local-app.log.");
    await pause(1000);
  }
  throw Error("Startup timed out. Please try again in a moment.");
}
function stop() {
  const state = read(stateFile);
  if (!validState(state) || !alive(state.pid)) { console.log("Pawday is not running."); return; }
  // Verify the exact worker config before stopping a saved PID, which Windows may reuse.
  const escaped = configFile.replaceAll("'", "''");
  const check = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$task = Get-CimInstance Win32_Process -Filter 'ProcessId=${state.pid}'; if ($task.CommandLine -and $task.CommandLine.Contains('${escaped}')) { exit 0 } else { exit 1 }`], { windowsHide: true, stdio: "ignore" });
  if (check.status !== 0) throw Error("The saved process does not match Pawday. Nothing was stopped.");
  const result = spawnSync("taskkill.exe", ["/PID", String(state.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  if (result.status !== 0) throw Error("Could not stop Pawday.");
  unlinkSync(stateFile);
  console.log("Pawday has stopped. Your saved data is kept.");
}
async function main() {
  if (process.argv.includes("--stop")) return stop();
  let state = read(stateFile);
  if (validState(state) && alive(state.pid)) { await waitReady(state); openApp(state.port); return; }
  let locked = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { const fd = openSync(lockFile, "wx"); writeFileSync(fd, JSON.stringify({ pid: process.pid })); closeSync(fd); locked = true; break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      const lock = read(lockFile);
      if (lock?.pid && !alive(lock.pid)) { try { unlinkSync(lockFile); } catch {} continue; }
      await pause(1000);
      state = read(stateFile);
      if (validState(state) && alive(state.pid)) { await waitReady(state); openApp(state.port); return; }
    }
  }
  if (!locked) throw Error("Pawday is already starting. Please try again in a moment.");
  try {
    const cli = join(project, "node_modules/wrangler/bin/wrangler.js");
    if (!existsSync(cli)) throw Error("Required files are missing. Keep the complete Pawday folder together.");
    if (!existsSync(configFile)) run(join(project, "scripts/run-framework.mjs"), ["build"]);
    const marker = join(runtime, "migrations-applied.json");
    if (!hasDatabase(join(project, ".wrangler/state/v3/d1")) && existsSync(marker)) unlinkSync(marker);
    run(join(project, "scripts/migrate-local.mjs"));
    let port;
    for (let candidate = 5273; candidate <= 5283; candidate++) if (await free(candidate)) { port = candidate; break; }
    if (!port) throw Error("No local port is available. Close another Pawday instance and try again.");
    console.log("Starting Pawday. Your browser will open automatically.");
    const log = openSync(join(runtime, "local-app.log"), "a");
    const child = spawn(process.execPath, ["--import", pathToFileURL(join(project, "scripts/sites-env.mjs")).href, cli, "dev", "--config", configFile, "--local", "--persist-to", join(project, ".wrangler/state"), "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", "0"], { cwd: project, detached: true, windowsHide: true, stdio: ["ignore", log, log] });
    await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    closeSync(log);
    state = { pid: child.pid, port, project };
    writeFileSync(stateFile, JSON.stringify(state));
    child.unref();
    await waitReady(state);
    openApp(port);
  } finally { try { unlinkSync(lockFile); } catch {} }
}
main().catch((error) => { console.error("Startup error: " + error.message); process.exitCode = 1; });
