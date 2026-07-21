const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

delete globalThis.DashboardLogic;
vm.runInThisContext(fs.readFileSync("js/logic.js", "utf8"));
const L = globalThis.DashboardLogic;

const dataContext = { window: {} };
vm.createContext(dataContext);
vm.runInContext(fs.readFileSync("data/trip-data.js", "utf8"), dataContext);
const data = JSON.parse(JSON.stringify(dataContext.window.TRIP_DATA));
const day = data.itinerary[0];

const timeline = L.itineraryTimeline(day);
assert.equal(timeline[0].timeLabel, "09:40", "Timeline 未解析活动时间");
assert.equal(timeline[0].text, "搭乘四川航空3U3995从成都天府国际机场T1出发", "Timeline 未移除时间前缀");
assert.equal(L.nextItineraryEvent(day, new Date(2026, 6, 20, 16, 0)).time, "16:30", "Next Action 未选择下一定时活动");
assert.equal(L.nextItineraryEvent(day, new Date(2026, 6, 20, 22, 0)), null, "当天结束后仍显示过期事件");
assert.equal(L.nextItineraryEvent(data.itinerary[1], new Date(2026, 6, 20, 16, 0)).text, "睡醒后早餐", "未来日期未选择首项活动");

const liveFlights = [
  { flightNumber: "OD157", date: "2026-07-21", departureTime: "17:55", arrivalTime: "21:05", status: "cancelled", actualStatus: "取消" },
  { flightNumber: "OD306", date: "2026-07-22", departureTime: "09:00", arrivalTime: "12:00", departureAirport: "Kuala Lumpur", arrivalAirport: "Bali", status: "confirmed", actualStatus: "等待确认" }
];
assert.equal(L.nextActiveFlight(liveFlights, new Date(2026, 6, 21, 22, 0)).flightNumber, "OD306", "旧航班覆盖了当前有效航班");
assert.equal(L.nextTravelAction(data.itinerary[1], liveFlights, [], new Date(2026, 6, 21, 22, 0)).type, "航班", "Next Action 未优先展示临近航班");
assert.equal(L.nextTravelAction(data.itinerary[1], [], [{ nameZh: "当前酒店", checkIn: "2026-07-21", checkOut: "2026-07-22", status: "confirmed" }], new Date(2026, 6, 21, 22, 0)).type, "酒店", "Next Action 未回退到当前酒店");
assert.equal(L.nextTravelAction(data.itinerary[1], [], [], new Date(2026, 6, 21, 22, 0)).type, "交通", "Next Action 未回退到交通摘要");

const override = {
  dayId: day.id,
  baseVersion: data.meta.version,
  travelDate: day.date,
  city: "共享城市",
  theme: "共享主题",
  transport: "共享交通",
  periods: {
    morning: [{ id: "shared-next", time: "23:50", text: "首页共享事件", order: 10, status: "planned" }],
    noon: [],
    afternoon: [],
    evening: []
  },
  notes: [],
  maps: [],
  status: "changed",
  revision: 2
};
const merged = L.mergeItinerary([day], [override])[0];
assert.equal(L.itineraryTimeline(merged)[0].text, "首页共享事件", "Command Center 未使用 override 合并结果");

const expenses = [
  { incurredOn: day.date, currency: "CNY", paymentStatus: "paid", amountMinor: 1000 },
  { incurredOn: day.date, currency: "CNY", paymentStatus: "pending", amountMinor: 500 },
  { incurredOn: "2026-07-21", currency: "CNY", paymentStatus: "paid", amountMinor: 9999 }
];
const todayTotals = L.expenseLedgerTotals(expenses.filter((expense) => expense.incurredOn === day.date));
assert.deepEqual(todayTotals.CNY, { paid: 1000, pending: 500, refunded: 0 }, "首页今日费用混入其他日期");
const recent = L.recentSharedChanges(
  [{ theme: "较早行程", updatedAt: "2026-07-21T08:00:00Z" }],
  [{ title: "最新费用", updatedAt: "2026-07-21T09:00:00Z" }]
);
assert.deepEqual(recent.map((item) => [item.type, item.title]), [["费用", "最新费用"], ["行程", "较早行程"]], "最近修改未按时间排序");

const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const persisted = app.match(/function persistentState\(value\) \{([\s\S]*?)\n  \}/)?.[1] || "";

assert.match(app, /function commandCenterActive\(\) \{[\s\S]*documentService\.authenticated[\s\S]*Boolean\(sharedSnapshot\)/, "Private Command Center 登录边界缺失");
assert.match(app, /function renderHome\(\) \{\s*if \(commandCenterActive\(\)\) return renderCommandCenter\(\);/, "首页未区分 Public 与 Private 模式");
assert.match(app, /<article class="hero"/, "Public Mode 原首页被移除");
assert.match(app, /const itinerary = itineraryDays\(\);[\s\S]*L\.itineraryTimeline\(focusDay\)/, "首页未读取合并行程");
assert.match(app, /expense\.incurredOn === focusDay\.date/, "首页费用未限定当天");
assert.match(app, /const documents = documentCounts\(\)/, "首页未读取 Document Center 状态");
assert.match(app, /<h2>最近修改<\/h2>/, "Command Center 缺少最近修改");
assert.match(app, /<strong>编辑今日行程<\/strong>/, "首页缺少编辑今日行程入口");
assert.match(app, /Realtime Travel Status/, "Command Center 未升级为旅行实时状态中心");
assert.match(app, /当前有效航班/, "Command Center 缺少当前有效航班状态");
assert.match(app, /L\.nextTravelAction\(/, "Command Center 未使用优先行动逻辑");
assert.doesNotMatch(app, /DATA\.alerts\[1\]/, "行程页仍被固定旧航班提醒覆盖");
for (const action of ["data-command-itinerary", "data-command-expense", "data-command-upload", 'data-go="documents"']) {
  assert.match(app, new RegExp(action), `Quick Action 缺失: ${action}`);
}
for (const status of ["已同步", "保存中", "冲突", "离线只读"]) assert.match(app, new RegExp(status), `同步状态缺失: ${status}`);
assert.match(app, /saveItineraryOverride[\s\S]*loadSharedSnapshot\(true\)/, "行程保存后未刷新首页快照");
assert.match(app, /createExpense[\s\S]*loadSharedSnapshot\(true\)/, "费用新增后未刷新首页快照");
assert.match(app, /data-command-upload[\s\S]*switchView\("documents"\)[\s\S]*#document-upload/, "上传资料入口未定位 Document Center");
assert.doesNotMatch(persisted, /command|snapshot|expense|itinerary|document/i, "Command Center 私有数据进入 localStorage 白名单");
assert.doesNotMatch(worker, /command-center|travel_expenses|travel_itinerary_overrides/i, "Service Worker 缓存了 Command Center 私有数据路径");
assert.doesNotMatch(app, /supabase_realtime|\.channel\(/i, "Command Center 提前启用了 Realtime");
assert.match(css, /\.command-center \{[^}]*min-width: 0;/, "Command Center 缺少窄屏收缩边界");
assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.command-next-action \{ grid-template-columns: 78px minmax\(0, 1fr\);/, "430px Command Center 布局缺失");

console.log("travel command center: ok");
