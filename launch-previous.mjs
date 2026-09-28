import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const root = dirname(fileURLToPath(import.meta.url));
const project = join(root, "petcare");
const address = "http://localhost:5173";
const noBrowser = process.argv.includes("--no-browser");
process.chdir(project);
process.env.PATH = dirname(process.execPath) + ";" + process.env.PATH;

async function isOurApp() {
  try {
    const response = await fetch(address + "/manifest.webmanifest", { signal: AbortSignal.timeout(2000) });
    const manifest = await response.json();
    return response.ok && manifest.name === "포데이 반려동물 관리";
  } catch { return false; }
}
function openApp() {
  console.log("\n앱 준비 완료: " + address);
  if (noBrowser) return;
  const browser = spawn("cmd.exe", ["/d", "/c", "start", "", address], { windowsHide: true, stdio: "ignore" });
  browser.on("error", () => console.log("브라우저에서 위 주소를 열어주세요."));
}
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: project, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("초기 준비에 실패했습니다. 위 오류 내용을 확인해주세요.");
}
async function main() {
  if (await isOurApp()) { console.log("이미 실행 중인 포데이를 엽니다."); openApp(); return; }
  const free = await new Promise(resolve => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(5173, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
  if (!free) {
    if (await isOurApp()) { console.log("이미 실행 중인 포데이를 엽니다."); openApp(); return; }
    throw new Error("5173 포트를 다른 프로그램이 사용하고 있습니다. 해당 프로그램을 종료한 뒤 다시 실행해주세요.");
  }
  if (!existsSync(join(project, "node_modules", "vinext"))) {
    console.log("최초 실행에 필요한 파일을 설치합니다. 인터넷 연결이 필요합니다.");
    run(join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), ["ci", "--include=dev", "--include=optional", "--no-audit", "--no-fund"]);
  }
  if (!existsSync(join(project, ".sites-runtime/migrations-applied.json"))) {
    console.log("최초 실행을 준비합니다.");
    run("scripts/run-framework.mjs", ["build"]);
    run("scripts/migrate-local.mjs");
  }
  console.log("포데이를 시작합니다. 준비되면 브라우저가 자동으로 열립니다.");
  console.log("사용 중에는 이 창을 열어 두세요. 종료: Ctrl+C 또는 창 닫기\n");
  let checking = false;
  const timer = setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      if (await isOurApp()) {
        const page = await fetch(address, { signal: AbortSignal.timeout(15000) });
        if (page.ok) { clearInterval(timer); openApp(); }
      }
    } catch {} finally { checking = false; }
  }, 1500);
  try {
    process.argv = [process.execPath, join(project, "scripts/run-framework.mjs"), "dev", "--port", "5173"];
    await import(pathToFileURL(join(project, "scripts/run-framework.mjs")).href);
  } catch (error) { clearInterval(timer); throw error; }
}
main().catch(error => { console.error("\n실행 오류: " + error.message); process.exitCode = 1; });
