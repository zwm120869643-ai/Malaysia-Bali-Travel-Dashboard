const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["js/logic.js", "data/trip-data.js", "js/travel-context.js", "js/timeline-engine.js", "js/preparation-engine.js", "js/location-context.js", "js/briefing-engine.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);
const { DashboardLogic: L, TRIP_DATA: sourceData, TravelContext, TravelTimelineEngine: Timeline, TravelPreparationEngine: Preparation, TravelLocationContext: Location, TravelBriefingEngine: Briefing } = sandbox.window;
const data = JSON.parse(JSON.stringify(sourceData));

function contextAt(now, status) {
  return TravelContext.create({
    data,
    logic: L,
    now,
    itinerary: data.itinerary,
    flights: data.flights,
    hotels: data.hotels,
    flightWatch: { flightNumber: "OD306", date: "2026-07-22", status, departure: { estimatedTime: "10:10", estimatedAt: "2026-07-22T02:10:00.000Z" } },
    checklistItems: [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }, { id: "d", title: "D" }, { id: "e", title: "E" }],
    completedTasks: { a: true, b: true, c: true, d: true }
  });
}

const landed = contextAt(new Date(2026, 6, 22, 13, 15), "arrived");
assert.equal(landed.mode, "Arrival Mode", "OD306 落地后未进入 Arrival Mode");
assert.equal(landed.arrival.active, true, "Arrival Assistant 未启用");
assert.equal(landed.arrival.title, "欢迎来到巴厘岛", "抵达欢迎语错误");
assert.deepEqual(JSON.parse(JSON.stringify(landed.arrival.steps)), ["完成入境", "领取行李", "前往住宿", "办理入住"], "抵达步骤不完整");
assert.equal(landed.arrival.estimatedAccommodationTime, "15:00", "住宿到达时间未合并机场手续与区域车程");
const landedTimeline = Timeline.build(landed, L, 8);
assert.equal(Timeline.nextAction(landed, landedTimeline, L).title, "前往住宿", "落地后的 Next Action 错误");
assert.deepEqual(JSON.parse(JSON.stringify(Location.generate(landed, landedTimeline).today)), ["附近晚餐", "附近散步", "休息"], "抵达后仍推荐远距离行程");

const evening = contextAt(new Date(2026, 6, 22, 20, 0), "arrived");
const preparation = Preparation.generate(evening);
assert.equal(preparation.activity.title, "佩妮达岛西线 + 浮潜", "未识别佩妮达岛活动");
for (const item of ["泳衣", "防晒", "防水手机袋", "晕船药", "小额现金"]) assert.ok(preparation.preparation.includes(item), `准备事项缺少 ${item}`);
assert.ok(preparation.reminders.includes("22:30 前休息"), "早间集合缺少休息提醒");
const briefing = Briefing.generate(evening, 3, preparation, Location.generate(evening, Timeline.build(evening, L, 8)));
assert.equal(briefing.title, "晚上好 Day 3", "晚间 Daily Briefing 标题错误");
assert.ok(briefing.advice.includes("晚上准备浮潜装备"), "晚间简报缺少浮潜准备建议");
assert.equal(Preparation.generate(contextAt(new Date(2026, 6, 23, 21, 0), "arrived")), null, "活动结束后仍显示准备事项");

const checkedIn = contextAt(new Date(2026, 6, 22, 16, 0), "arrived");
assert.deepEqual(JSON.parse(JSON.stringify(Timeline.memory(checkedIn, L).slice(0, 2).map((item) => item.type).sort())), ["flight", "hotel"], "旅行事件日志缺少航班或入住");

const app = fs.readFileSync("js/app.js", "utf8");
const coreSource = ["js/preparation-engine.js", "js/location-context.js", "js/briefing-engine.js"].map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.match(app, /id="quick-expense-form"[\s\S]*name="amount"[\s\S]*name="currency"[\s\S]*name="category"/, "首页快速记账不是三字段流程");
assert.match(app, /saveQuickExpense[\s\S]*createExpense\(\{ clientRef: form\.dataset\.clientRef/, "快速记账未复用幂等 Expense 创建");
assert.match(app, /HOME_EXPENSE_CATEGORIES = \["transport", "food", "hotel", "attractions", "shopping"\]/, "快速记账分类错误");
assert.equal(L.parseExpenseAmount("12.50"), 1250, "快速记账金额未转换为 amount_minor");
assert.doesNotMatch(coreSource, /localStorage|sessionStorage|caches\./, "Travel Assistant 引擎写入持久化存储");

console.log("travel assistant experience: ok");
