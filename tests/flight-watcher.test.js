const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = {
  window: {},
  AbortController,
  setTimeout,
  clearTimeout
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/flight-watcher.js", "utf8"), context);
const FlightWatcher = context.window.TravelFlightWatcher;

let requests = 0;
let now = Date.parse("2026-07-21T15:00:00Z");
const response = {
  flightNumber: "OD306",
  date: "2026-07-22",
  status: "scheduled",
  statusLabel: "正常",
  statusDetail: "On time",
  departure: { airport: "KUL", scheduledTime: "09:00", estimatedTime: "09:00", estimatedAt: "2026-07-22T01:00:00.000Z", terminal: "1", gate: null },
  arrival: { airport: "DPS", scheduledTime: "12:00", estimatedTime: "12:00", estimatedAt: "2026-07-22T04:00:00.000Z", terminal: "I", gate: null },
  fetchedAt: "2026-07-21T15:00:00.000Z",
  source: "FlightStats public tracker",
  cached: false
};
const request = async (_url, options) => {
  requests += 1;
  assert.equal(options.cache, "no-store", "航班响应不应进入浏览器持久缓存");
  assert.match(options.headers.Authorization, /^Bearer /, "航班查询缺少用户会话");
  return { ok: true, status: 200, async json() { return response; } };
};
const service = FlightWatcher.create({
  enabled: true,
  supabaseUrl: "https://project.supabase.co/rest/v1/",
  publishableKey: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
  tripId: "malaysia-bali-2026"
}, { async getSession() { return { access_token: "user-jwt", user: { id: "11111111-1111-4111-8111-111111111111" } }; } }, request, () => now);

(async () => {
  const first = await service.query({ flightNumber: "od-306", date: "2026-07-22" });
  const second = await service.query({ flightNumber: "OD306", date: "2026-07-22" });
  assert.equal(first.flightNumber, "OD306", "航班号未规范化");
  assert.equal(second.cached, true, "五分钟内未命中页面内存缓存");
  assert.equal(requests, 1, "重复查询仍访问 Edge Function");
  now += FlightWatcher.cacheTtlMs + 1;
  await service.query({ flightNumber: "OD306", date: "2026-07-22" });
  assert.equal(requests, 2, "缓存过期后未重新查询");
  await assert.rejects(() => service.query({ flightNumber: "../../secret", date: "2026-07-22" }), /航班号/, "非法航班号未被拒绝");
  await assert.rejects(() => service.query({ flightNumber: "MXD306", date: "2026-07-22" }), /航班号/, "用户输入应使用两字符 IATA 航班号");

  let publicToken = "";
  const publicService = FlightWatcher.create({
    enabled: true,
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "sb_publishable_abcdefghijklmnopqrstuvwxyz"
  }, { async getSession() { return null; } }, async (_url, options) => {
    publicToken = options.headers.Authorization;
    return { ok: true, status: 200, async json() { return response; } };
  }, () => now);
  await publicService.query({ flightNumber: "OD306", date: "2026-07-22" });
  assert.equal(publicToken, "Bearer sb_publishable_abcdefghijklmnopqrstuvwxyz", "公开航班查询仍依赖登录会话");

  vm.runInContext(fs.readFileSync("js/logic.js", "utf8"), context);
  const L = context.window.DashboardLogic;
  assert.equal(L.flightWatchTarget(response), "2026-07-22T01:00:00.000Z", "计划航班倒计时目标错误");
  assert.match(L.flightDepartureAdvice(response, new Date("2026-07-21T23:30:00+08:00")), /3小时/, "出发建议缺少国际航班缓冲");
  assert.equal(L.flightDepartureAdvice({ ...response, status: "cancelled" }), "航班已取消，请联系航空公司确认后续安排", "取消航班建议错误");

  const app = fs.readFileSync("js/app.js", "utf8");
  const index = fs.readFileSync("index.html", "utf8");
  const worker = fs.readFileSync("service-worker.js", "utf8");
  const edge = fs.readFileSync("supabase/functions/flight-watcher/index.ts", "utf8");
  assert.ok(index.indexOf("js/flight-watcher.js") < index.indexOf("js/app.js"), "Flight Watcher 客户端加载顺序错误");
  assert.doesNotMatch(app, /id="flight-watcher-form"/, "Command Center 仍显示手动航班号入口");
  assert.match(app, /const query = active \? \{ flightNumber: active\.flightNumber, date: active\.date \} : null/, "Flight Watcher 未自动绑定当前航班");
  assert.match(app, /L\.itineraryBoundFlight\(itinerary \|\| \[day\], flights, reference\)/, "Flight Watcher 未优先从行程绑定航班");
  assert.match(app, /L\.flightIntelligence\(flight, matchingWatch\)/, "网络失败时未回退行程状态");
  assert.match(app, /live\.flights\.map/, "多航段航班列表缺失");
  assert.match(app, /预计出发|预计抵达/, "Command Center 缺少预计时间");
  assert.match(app, /航班倒计时/, "Command Center 缺少航班倒计时");
  assert.match(app, /出发建议/, "Command Center 缺少出发建议");
  assert.match(edge, /const cache = new Map/, "Edge Function 缺少内存缓存");
  assert.doesNotMatch(edge, /authenticatedUser|claims\.role/, "公开 Flight Watcher 仍依赖登录身份");
  assert.match(edge, /FlightStats public tracker/, "Edge Function 未使用无密钥公开查询源");
  assert.doesNotMatch(edge, /service_role|\.from\(|rest\/v1|INSERT|UPDATE|DELETE/i, "Edge Function 不应访问或修改数据库");
  assert.doesNotMatch(fs.readFileSync("js/flight-watcher.js", "utf8"), /localStorage|sessionStorage|caches\./, "航班查询结果进入持久化存储");
  assert.doesNotMatch(worker, /functions\/v1\/flight-watcher/, "Service Worker 不应缓存航班 API");
  console.log("flight watcher: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
