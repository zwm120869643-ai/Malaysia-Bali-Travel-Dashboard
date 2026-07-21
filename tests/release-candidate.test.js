const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED_FILES = [
  "README.md",
  "index.html",
  "service-worker.js",
  "styles.css",
  "js/app.js",
  "js/logic.js",
  "js/shared-data.js",
  "supabase/travel_command_center.sql",
  "tests/command-center.test.js",
  "tests/dashboard.test.js",
  "tests/expense-ledger.test.js",
  "tests/itinerary-override.test.js",
  "tests/release-candidate.test.js",
  "tests/shared-data.test.js",
  "tests/storage-boundary.test.js",
  "tests/travel-command-center-db.test.js"
];

function gitReleaseGate() {
  const tracked = new Set(execFileSync("git", ["ls-files", "-z", "--", ...REQUIRED_FILES], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean));
  const missing = REQUIRED_FILES.filter((file) => !tracked.has(file));
  assert.deepEqual(missing, [], `发布文件未纳入 Git: ${missing.join(", ")}`);
  const dirty = execFileSync("git", ["status", "--porcelain=v1", "-z", "--", ...REQUIRED_FILES], { cwd: ROOT, encoding: "utf8" });
  assert.equal(dirty, "", `发布文件存在未提交变更:\n${dirty.replaceAll("\0", "\n")}`);
}

(async () => {
  REQUIRED_FILES.forEach((file) => assert.ok(fs.existsSync(path.join(ROOT, file)), `发布文件缺失: ${file}`));

  const listeners = {};
  const stores = new Map([
    ["malaysia-bali-dashboard-v1.5.0", new Map([["./js/app.js", new Response("old")]])],
    ["unrelated-cache", new Map()]
  ]);
  let cacheCalls = 0;
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  const keyOf = (value) => typeof value === "string" ? value : value.url;
  const cache = (name) => ({
    async put(key, response) { stores.get(name).set(keyOf(key), response); }
  });
  const context = {
    URL,
    Response,
    location: { origin: "https://travel.example" },
    fetch: async (request) => new Response(keyOf(request), { status: 200 }),
    caches: {
      async open(name) { cacheCalls += 1; if (!stores.has(name)) stores.set(name, new Map()); return cache(name); },
      async keys() { cacheCalls += 1; return [...stores.keys()]; },
      async delete(name) { cacheCalls += 1; return stores.delete(name); },
      async match(request) {
        cacheCalls += 1;
        for (const entries of stores.values()) if (entries.has(keyOf(request))) return entries.get(keyOf(request));
        return undefined;
      }
    },
    self: {
      addEventListener(type, listener) { listeners[type] = listener; },
      skipWaiting() { skipWaitingCalls += 1; return Promise.resolve(); },
      clients: { claim() { claimCalls += 1; return Promise.resolve(); } }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8"), context);

  const version = vm.runInContext("CACHE_VERSION", context);
  const cacheName = vm.runInContext("CACHE", context);
  const shell = JSON.parse(vm.runInContext("JSON.stringify(SHELL)", context));
  assert.equal(version, "v1.5.3", "Service Worker 缓存版本错误");
  assert.ok(shell.includes("./js/shared-data.js"), "shared-data.js 未进入应用壳缓存");
  shell.forEach((file) => assert.ok(fs.existsSync(path.join(ROOT, file.replace(/^\.\//, ""))), `缓存文件缺失: ${file}`));

  let installRun;
  listeners.install({ waitUntil(run) { installRun = run; } });
  await installRun;
  assert.equal(skipWaitingCalls, 1, "新 Service Worker 未立即进入等待切换流程");
  assert.deepEqual([...stores.get(cacheName).keys()].sort(), [...shell].sort(), "v1.5.3 应用壳缓存不完整");

  let activateRun;
  listeners.activate({ waitUntil(run) { activateRun = run; } });
  await activateRun;
  assert.equal(stores.has("malaysia-bali-dashboard-v1.5.0"), false, "v1.5.0 缓存未删除");
  assert.equal(stores.has(cacheName), true, "v1.5.3 缓存被误删");
  assert.equal(stores.has("unrelated-cache"), true, "非本应用缓存被误删");
  assert.equal(claimCalls, 1, "新 Service Worker 未接管现有页面");

  const privateUrls = [
    "/rest/v1/travel_documents?select=id",
    "/rest/v1/trip_members?select=role",
    "/rest/v1/travel_itinerary_overrides?select=day_id",
    "/rest/v1/travel_expenses?select=id",
    "/auth/v1/user",
    "/storage/v1/object/sign/travel-documents/file.pdf"
  ].map((item) => `https://travel.example${item}`);
  const beforePrivate = cacheCalls;
  privateUrls.forEach((url) => {
    let intercepted = false;
    listeners.fetch({ request: { url, method: "GET", mode: "cors" }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, `私有 API 被 Service Worker 拦截: ${url}`);
  });
  assert.equal(cacheCalls, beforePrivate, "私有 API 触发了 Cache API");

  if (process.argv.includes("--release")) gitReleaseGate();
  console.log(`v1.5.3 release candidate: ok${process.argv.includes("--release") ? " (Git ready)" : ""}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
