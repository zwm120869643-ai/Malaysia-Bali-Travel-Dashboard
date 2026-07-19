const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = { window: { atob: (value) => Buffer.from(value, "base64").toString("utf8") }, AbortController, URL, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/sync.js", "utf8"), context);
const Sync = context.window.TravelChecklistSync;
const sql = fs.readFileSync("supabase/travel_checklist.sql", "utf8");
["id", "trip_id", "task_id", "task_name", "completed", "completed_by", "updated_by_user_id", "updated_at"].forEach((field) => assert.match(sql, new RegExp(`\\b${field}\\b`), `数据表缺少字段: ${field}`));
assert.match(sql, /enable row level security/i, "travel_checklist 未启用RLS");
assert.match(sql, /auth\.uid\(\)/i, "未预留未来Supabase Auth身份校验说明");

const configContext = { window: {} };
vm.createContext(configContext);
vm.runInContext(fs.readFileSync("config/sync-config.js", "utf8"), configContext);
assert.equal(configContext.window.TRAVEL_SYNC_CONFIG.enabled, true, "实际同步配置未启用");
assert.equal(Sync.normalizeConfig(configContext.window.TRAVEL_SYNC_CONFIG).configured, true, "实际Supabase配置无效");
assert.equal(configContext.window.TRAVEL_SYNC_CONFIG.userName, "TBD", "默认用户名称必须为TBD");

const exampleContext = { window: {} };
vm.createContext(exampleContext);
vm.runInContext(fs.readFileSync("config/sync-config.example.js", "utf8"), exampleContext);
["supabaseUrl", "publishableKey", "tripId", "userName"].forEach((field) => assert.ok(field in exampleContext.window.TRAVEL_SYNC_CONFIG, `配置模板缺少字段: ${field}`));
assert.equal(exampleContext.window.TRAVEL_SYNC_CONFIG.enabled, false, "配置模板必须默认关闭");
assert.equal(Sync.normalizeConfig({
  enabled: true,
  supabaseUrl: "https://travel-test.supabase.co/rest/v1/",
  publishableKey: `sb_publishable_${"x".repeat(24)}`,
  tripId: "malaysia-bali-2026"
}).supabaseUrl, "https://travel-test.supabase.co", "REST URL未正确规范化");

const rows = new Map();
async function mockRequest(url, options) {
  if (options.method === "POST") {
    JSON.parse(options.body).forEach((row) => rows.set(`${row.trip_id}:${row.task_id}`, { ...row, updated_at: "2026-07-19T15:30:45Z" }));
    return { ok: true, status: 201, async json() { return []; } };
  }
  const tripId = new URL(url).searchParams.get("trip_id").replace(/^eq\./, "");
  return { ok: true, status: 200, async json() { return [...rows.values()].filter((row) => row.trip_id === tripId); } };
}

const baseConfig = {
  enabled: true,
  supabaseUrl: "https://travel-test.supabase.co",
  publishableKey: `sb_publishable_${"x".repeat(24)}`,
  tripId: "malaysia-bali-2026"
};

(async () => {
  const phoneA = Sync.create({ ...baseConfig, userName: "张微明" }, mockRequest);
  const phoneB = Sync.create({ ...baseConfig, userName: "女朋友" }, mockRequest);
  assert.equal(phoneA.configured, true, "有效配置未启用");
  assert.equal(phoneA.userName, "张微明", "手机A身份配置错误");
  assert.equal(phoneB.userName, "女朋友", "手机B身份配置错误");
  assert.equal(await phoneA.push({ taskId: "task-esim", taskName: "购买 eSIM", completed: true, completedBy: phoneA.userName }), true, "手机A写入失败");
  const phoneBRows = await phoneB.pull();
  const esim = phoneBRows.find((row) => row.task_id === "task-esim");
  assert.equal(esim.completed, true, "手机B未读取手机A状态");
  assert.equal(esim.completed_by, "张微明", "完成者身份未同步");
  assert.equal(esim.updated_at, "2026-07-19T15:30:45Z", "更新时间未同步");
  assert.equal(phoneB.status, "synced", "同步状态错误");

  const offline = Sync.create(baseConfig, async () => { throw new Error("offline"); });
  assert.equal(await offline.push({ taskId: "task-esim", taskName: "购买 eSIM", completed: false, completedBy: "device-a" }), false, "离线写入应失败并回退");
  assert.equal(offline.status, "offline", "离线状态错误");
  assert.equal(Sync.normalizeChange({ taskId: "unsafe", taskName: "护照号: AB123456", completed: true }), null, "敏感字段未拦截");
  assert.equal(Sync.normalizeChange({ taskId: "unsafe-user", taskName: "购买 eSIM", completed: true, completedBy: "银行卡号 1234" }), null, "完成者敏感信息未拦截");
  const allowlisted = Sync.normalizeChange({ taskId: "task-esim", taskName: "购买 eSIM", completed: true, completedBy: "张微明", passport: "secret", orderNumber: "secret", paymentData: "secret" });
  assert.deepEqual(Object.keys(allowlisted).sort(), ["completed", "completedBy", "taskId", "taskName"], "上传字段未严格限制");

  const rolePayload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const legacyServiceRole = `eyJhbGciOiJIUzI1NiJ9.${rolePayload}.signature`;
  assert.equal(Sync.normalizeConfig({ ...baseConfig, publishableKey: legacyServiceRole }).configured, false, "service_role JWT未拦截");

  console.log("shared checklist sync: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
