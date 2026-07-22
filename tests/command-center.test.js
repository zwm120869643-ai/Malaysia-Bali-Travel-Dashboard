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
assert.equal(L.nextTravelAction(data.itinerary[1], [], [{ nameZh: "当前酒店", checkIn: "2026-07-21", checkOut: "2026-07-22", status: "confirmed" }], new Date(2026, 6, 21, 22, 0)).type, "退房", "Next Action 未优先展示退房");
assert.equal(L.nextTravelAction(data.itinerary[1], [], [], new Date(2026, 6, 21, 22, 0)).type, "交通", "Next Action 未回退到交通摘要");
assert.equal(L.flightStatusLabel({ status: "scheduled", statusDetail: "Boarding" }, liveFlights[1]), "Boarding", "登机状态未标准化");
assert.equal(L.flightStatusLabel({ status: "arrived" }, liveFlights[1]), "Landed", "抵达状态未标准化");
assert.deepEqual(L.activeFlights(liveFlights, new Date(2026, 6, 21, 22, 0)).map((flight) => flight.flightNumber), ["OD306"], "已完成航班仍在追踪列表");
assert.equal(L.itineraryBoundFlight(data.itinerary, [
  { flightNumber: "AB123", date: "2026-07-22", departureTime: "08:00", arrivalTime: "09:00", status: "confirmed" },
  liveFlights[1]
], new Date(2026, 6, 22, 6, 0)).flightNumber, "OD306", "航班未优先绑定行程中的有效航班");
assert.equal(L.nextTravelAction({ date: "2026-07-23", city: "Bali", transport: "", periods: { morning: [], noon: [], afternoon: [], evening: [] } }, [], [], new Date(2026, 6, 22, 20, 0), [{ id: "sea", title: "佩妮达岛西线 + 浮潜", category: "sea", incurredOn: "2026-07-23", paymentStatus: "paid" }]).type, "已付款活动", "Next Action 未识别已付款活动");
const flightAction = L.nextTravelAction(data.itinerary[1], liveFlights, [], new Date(2026, 6, 21, 22, 0));
assert.equal(L.travelCountdown(flightAction.at, new Date(2026, 6, 21, 22, 0)), "11小时", "下一事件倒计时错误");
const delayedFlight = L.flightIntelligence(liveFlights[1], {
  status: "delayed",
  departure: { estimatedTime: "11:00", estimatedAt: "2026-07-22T03:00:00.000Z" },
  arrival: { estimatedTime: "14:00", estimatedAt: "2026-07-22T06:00:00.000Z" }
});
assert.equal(delayedFlight.delayMinutes, 120, "Flight Intelligence 延误分钟计算错误");
assert.equal(delayedFlight.impactLevel, "high", "长延误未标记为高影响");
assert.match(L.nextTravelAction(data.itinerary[2], liveFlights, [], new Date(2026, 6, 22, 8, 0), [], delayedFlight).title, /11:00 → 14:00/, "Next Action 未使用预计航班时间");
assert.equal(L.travelTimeline([data.itinerary[2]], new Date(2026, 6, 22, 9, 30), 8, delayedFlight)[0].timeLabel, "11:00", "延误后的航班未重新进入动态时间轴");
assert.equal(L.activityRisk(data.itinerary[3]).level, "high", "出海活动未识别为高风险");
assert.deepEqual(L.travelTimeline([
  { id: "today", date: "2026-07-21", periods: { morning: ["23:00 当前事件"], noon: [], afternoon: [], evening: [] } },
  { id: "tomorrow", date: "2026-07-22", periods: { morning: ["09:00 明日事件"], noon: [], afternoon: [], evening: [] } }
], new Date(2026, 6, 21, 22, 0), 2).map((item) => item.text), ["当前事件", "明日事件"], "旅行时间轴未跨日排序");

const assistant = L.travelAssistantCore({
  day: data.itinerary[2],
  flight: liveFlights[1],
  flightWatch: { status: "scheduled" },
  hotel: { nameZh: "吉隆坡 Airbnb 民宿", checkOut: "2026-07-22" },
  nextHotel: { nameZh: "巴厘岛酒店", checkIn: "2026-07-22" },
  nextActivity: data.itinerary.find((item) => item.date === "2026-07-23"),
  nextAction: flightAction,
  location: "吉隆坡",
  now: new Date(2026, 6, 22, 6, 0)
});
assert.match(assistant.summary, /吉隆坡 Airbnb 民宿.*OD306.*佩妮达岛西线/, "每日简报未融合酒店、航班和活动上下文");
assert.match(assistant.nextAdvice, /航站楼.*机场/, "Next Action 未生成航班行动建议");
assert.ok(assistant.preparations.some((item) => item.title === "证件与登机"), "准备事项缺少航班资料");
assert.ok(assistant.preparations.some((item) => item.title === "出海装备"), "准备事项缺少出海上下文");
assert.match(assistant.tips[0].detail, /早高峰|机场方向/, "攻略建议未结合吉隆坡早间情境");
assert.match(L.travelAssistantCore({ day, flight: liveFlights[1], flightWatch: { status: "delayed" }, nextAction: flightAction, location: "吉隆坡", now: new Date(2026, 6, 22, 6, 0) }).nextAdvice, /延误.*原计划/, "延误状态未影响智能建议");

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
const travelContextSource = fs.readFileSync("js/travel-context.js", "utf8");
const timelineSource = fs.readFileSync("js/timeline-engine.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const persisted = app.match(/function persistentState\(value\) \{([\s\S]*?)\n  \}/)?.[1] || "";

assert.match(app, /function renderHome\(\) \{\s*return renderCommandCenter\(\);/, "未登录首页未默认显示 Command Center");
assert.match(app, /const privateMode = documentService\.authenticated && Boolean\(sharedSnapshot\)/, "私有 Command Center 数据缺少登录边界");
assert.match(app, /privateMode \? `<div class="section-head"><div><p class="eyebrow">Expense Snapshot/, "公开模式未隔离费用金额");
assert.match(app, /登录后才能编辑行程|登录后才能记账|登录后才能上传文件/, "公开快捷入口缺少登录写入门禁");
assert.match(app, /const travelContext = travelContextFor\(itinerary, now, flightWatch\);[\s\S]*timelineEngine\.build\(travelContext, L, 8\)/, "首页未通过统一上下文读取动态跨日行程");
assert.match(app, /expense\.incurredOn === focusDay\.date/, "首页费用未限定当天");
assert.match(app, /const documents = privateMode \? documentCounts\(\) : \{ total: 0 \}/, "首页未隔离读取 Document Center 状态");
assert.match(app, /<h2>最近修改<\/h2>/, "Command Center 缺少最近修改");
assert.match(app, /<strong>编辑今日行程<\/strong>/, "首页缺少编辑今日行程入口");
assert.match(app, /Smart Public Travel Command Center/, "Command Center 未升级为公开旅行状态中心");
assert.match(app, /当前地点|当前住宿|下一交通|下一活动/, "Command Center 缺少旅行状态卡");
assert.match(app, /flightActualTag\(actual\)/, "航班卡片未突出显示实际状态");
assert.match(app, /timelineEngine\.nextAction\(travelContext, timeline, L\)/, "Command Center 未使用统一 Next Action 逻辑");
assert.match(app, /preparationEngine\.generate\(|locationContextService\.generate\(|briefingEngine\.generate\(/, "Command Center 未接入 Travel Assistant Experience");
assert.match(travelContextSource, /logic\.flightIntelligence\(flight, matchingWatch\)/, "Travel Context 未接入 Flight Intelligence");
assert.match(travelContextSource, /let activityRisk = \{ type: "activity"/, "Travel Context 未接入活动风险检测");
assert.match(timelineSource, /classification: fixed \? "Fixed Event" : "Flexible Event"/, "Timeline Engine 未区分固定与弹性事件");
assert.match(app, /<h2>今日状态<\/h2>/, "Command Center 缺少 Today Status Card");
assert.match(app, /✈ 航班|🏠 住宿|🌊 活动|⚠ 当前建议/, "Today Status Card 信息不完整");
assert.match(app, /计划时间[\s\S]*实时调整/, "航班卡缺少计划与实时调整对照");
assert.match(app, /Flight Intelligence · 延误影响/, "航班卡缺少延误影响");
assert.match(app, /data-command-expense="\$\{category\}"/, "首页缺少快速记账分类");
assert.match(app, /startExpenseCreate\(commandExpense\.dataset\.commandExpense\)/, "快速记账分类未传入账本表单");
assert.match(app, /每日旅行简报|今晚准备|当前位置附近/, "Travel Assistant Experience 展示不完整");
assert.match(app, /nextAction\.reason/, "Next Action 未展示统一上下文建议");
assert.doesNotMatch(app, /DATA\.alerts\[1\]/, "行程页仍被固定旧航班提醒覆盖");
assert.match(app, /travelContext\.mode/, "首页缺少 Travel Mode");
assert.match(app, /id="next-action-countdown"/, "首页缺少下一事件倒计时");
assert.match(app, /<h2>旅行时间轴<\/h2>/, "首页缺少旅行时间轴视图");
assert.match(app, /setInterval\(updateTravelCountdown, 30000\)/, "倒计时未定时刷新");
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
