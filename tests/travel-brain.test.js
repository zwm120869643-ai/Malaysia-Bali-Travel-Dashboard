const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["js/logic.js", "data/trip-data.js", "js/travel-context.js", "js/timeline-engine.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);
const L = sandbox.window.DashboardLogic;
const TravelContext = sandbox.window.TravelContext;
const Timeline = sandbox.window.TravelTimelineEngine;
const data = JSON.parse(JSON.stringify(sandbox.window.TRIP_DATA));
const coreSource = ["js/travel-context.js", "js/timeline-engine.js"].map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.doesNotMatch(coreSource, /localStorage|sessionStorage|caches\./, "Travel Brain 状态进入持久化存储或 Cache Storage");

function contextAt(watch, now, expenses) {
  return TravelContext.create({
    data,
    logic: L,
    itinerary: data.itinerary,
    flights: data.flights,
    hotels: data.hotels,
    flightWatch: watch,
    now,
    expenses: expenses || [],
    checklistItems: [{ id: "done", title: "已完成", completed: false }, { id: "next", title: "确认随身物品", completed: false }],
    completedTasks: { done: true }
  });
}

function watch(departureTime, departureAt, status) {
  return {
    flightNumber: "OD306",
    date: "2026-07-22",
    status: status || "scheduled",
    departure: { estimatedTime: departureTime, estimatedAt: departureAt },
    arrival: { estimatedTime: "12:00", estimatedAt: "2026-07-22T04:00:00.000Z" }
  };
}

const normal = contextAt(watch("09:00", "2026-07-22T01:00:00.000Z"), new Date(2026, 6, 22, 8, 0));
assert.equal(normal.flight.intelligence.departureTime, "09:00", "正常航班起飞时间错误");
assert.equal(normal.flight.intelligence.arrivalTime, "12:00", "正常航班抵达时间错误");
assert.equal(normal.mode, "Departure Mode", "出发前未进入 Departure Mode");
assert.deepEqual([normal.checklist.completed, normal.checklist.total, normal.checklist.next.id], [1, 2, "next"], "Checklist 未进入 Travel Context");
const normalTimeline = Timeline.build(normal, L, 12);
assert.equal(normalTimeline.find((item) => /OD306/.test(item.text)).timeLabel, "09:00", "正常航班时间轴错误");
assert.equal(Timeline.nextAction(normal, normalTimeline, L).title, "前往机场", "正常航班 Next Action 错误");

const delayed70 = contextAt(watch("10:10", "2026-07-22T02:10:00.000Z", "delayed"), new Date(2026, 6, 22, 8, 30));
assert.equal(delayed70.flight.intelligence.delayMinutes, 70, "延误分钟计算错误");
assert.equal(delayed70.flight.intelligence.arrivalTime, "13:10", "抵达时间未使用起飞时间加计划航程");
assert.equal(delayed70.accommodation.estimatedTime, "15:30", "酒店入住未随航班延误调整");
assert.match(delayed70.activityRisk.detail, /间隔约18小时，可执行/, "佩妮达岛活动间隔计算错误");
const delayedTimeline = Timeline.build(delayed70, L, 12);
assert.equal(delayedTimeline.find((item) => /arrival/i.test(item.text)).timeLabel, "13:10", "抵达时间轴未更新");
assert.equal(delayedTimeline.find((item) => /酒店入住/.test(item.text)).timeLabel, "15:30", "酒店时间轴未更新");
assert.deepEqual(JSON.parse(JSON.stringify(Timeline.nextAction(delayed70, delayedTimeline, L))), { type: "航班", title: "等待新的登机时间", reason: "航班延误", at: Date.parse("2026-07-22T02:10:00.000Z"), timeLabel: "10:10", location: "吉隆坡国际机场" }, "延误后的 Next Action 错误");
assert.equal(contextAt(watch("10:10", "2026-07-22T02:10:00.000Z", "delayed"), new Date(2026, 6, 22, 11, 0)).mode, "Transit Mode", "飞行中未进入 Transit Mode");
assert.equal(contextAt(watch("10:10", "2026-07-22T02:10:00.000Z", "delayed"), new Date(2026, 6, 22, 14, 0)).mode, "Arrival Mode", "抵达后未进入 Arrival Mode");

const delayed180 = contextAt(watch("12:00", "2026-07-22T04:00:00.000Z", "delayed"), new Date(2026, 6, 22, 8, 30));
assert.equal(delayed180.flight.intelligence.arrivalTime, "15:00", "三小时延误抵达时间错误");
assert.equal(delayed180.activityRisk.level, "red", "三小时延误未触发活动冲突");
assert.equal(delayed180.activityRisk.detail, "休息时间不足，建议确认活动安排。", "严重延误风险建议错误");

assert.equal(L.flightIntelligence({ date: "2026-07-22", departureTime: "23:00", arrivalTime: "01:00" }, { departure: { estimatedTime: "23:30", estimatedAt: "2026-07-22T15:30:00.000Z" } }).arrivalTime, "01:30", "跨午夜航班时长计算错误");

console.log("travel brain core: ok");
