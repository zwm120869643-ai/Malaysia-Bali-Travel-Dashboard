const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["js/logic.js", "data/trip-data.js", "js/travel-context.js", "js/timeline-engine.js", "js/preparation-engine.js", "js/location-context.js", "js/intelligence-engine.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);
const { DashboardLogic: L, TRIP_DATA: sourceData, TravelContext, TravelTimelineEngine: Timeline, TravelPreparationEngine: Preparation, TravelLocationContext: Location, TravelIntelligence: Intelligence } = sandbox.window;
const data = JSON.parse(JSON.stringify(sourceData));

function contextAt(departureTime, status, now, completed) {
  return TravelContext.create({
    data,
    logic: L,
    now,
    itinerary: data.itinerary,
    flights: data.flights,
    hotels: data.hotels,
    flightWatch: { flightNumber: "OD306", date: "2026-07-22", status, departure: { estimatedTime: departureTime, estimatedAt: `2026-07-22T${departureTime === "09:00" ? "01:00" : "02:10"}:00.000Z` } },
    checklistItems: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    completedTasks: completed || { a: true, b: true, c: true }
  });
}

function evaluate(context, weather, expenses) {
  const timeline = Timeline.build(context, L, 8);
  const preparation = Preparation.generate(context, weather);
  const location = Location.generate(context, timeline, weather);
  return Intelligence.evaluate({ context, timeline, memory: Timeline.memory(context, L), weather, location, preparation, expenses: expenses || [] });
}

const bali = contextAt("09:00", "arrived", new Date(2026, 6, 22, 13, 15));
const good = evaluate(bali, { rainProbability: 20, seaCondition: "calm" });
assert.equal(good.weather.label, "适合进行", "佩妮达岛好天气适合度错误");
assert.match(good.weather.reason, /佩妮达岛西线 \+ 浮潜.*20%/, "天气未与活动结合");
assert.equal(good.recommendation.title, "先完成抵达流程", "当前巴厘岛抵达建议错误");
assert.ok(good.health.reasons.length && good.health.advice.length, "Travel Health Score 缺少原因或建议");

const seaRisk = Intelligence.weather(bali, { rainProbability: 80, seaCondition: "rough" });
assert.equal(seaRisk.level, "red", "佩妮达岛高降雨未降低适合度");
assert.match(seaRisk.advice, /海况.*船班/, "出海天气建议不完整");

const normal = contextAt("09:00", "scheduled", new Date(2026, 6, 22, 8, 0));
const delayed = contextAt("10:10", "delayed", new Date(2026, 6, 22, 8, 0));
const normalResult = evaluate(normal, { rainProbability: 20, seaCondition: "calm" });
const delayedResult = evaluate(delayed, { rainProbability: 20, seaCondition: "calm" });
assert.ok(delayedResult.health.score < normalResult.health.score, "航班延误未降低旅行健康分");
assert.match(delayedResult.health.reasons.join(" "), /航班延误70分钟/, "健康分未输出延误原因");
assert.equal(delayedResult.recommendation.title, "保持后续安排弹性", "航班延误建议错误");

const expenses = Intelligence.expenseInsight([
  { incurredOn: "2026-07-22", currency: "IDR", amountMinor: 50000, category: "food", paymentStatus: "paid" },
  { incurredOn: "2026-07-21", currency: "IDR", amountMinor: 30000, category: "food", paymentStatus: "paid" },
  { incurredOn: "2026-07-21", currency: "CNY", amountMinor: 1000, category: "transport", paymentStatus: "paid" }
], "2026-07-22");
assert.deepEqual(JSON.parse(JSON.stringify(expenses.byCurrency)), [
  { currency: "IDR", today: 50000, previous: 30000, direction: "up" },
  { currency: "CNY", today: 0, previous: 1000, direction: "down" }
], "费用趋势跨币种混算或方向错误");
assert.equal(expenses.topCategory, "food", "高频费用分类错误");
assert.match(good.memory.summary, /旅行状态\d+分/, "Travel Memory 2.0 缺少每日状态总结");

const source = fs.readFileSync("js/intelligence-engine.js", "utf8");
assert.doesNotMatch(source, /localStorage|sessionStorage|caches\.|fetch\(/, "Travel Intelligence 引入持久化或额外网络请求");
console.log("travel intelligence layer: ok");
