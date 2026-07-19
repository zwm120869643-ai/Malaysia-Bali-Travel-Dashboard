const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

vm.runInThisContext(fs.readFileSync("js/logic.js", "utf8"));
const L = globalThis.DashboardLogic;

// ponytail: one dependency-free check covers the date, sorting, transfer and totals logic.
assert.equal(L.daysBetween("2026-07-20", "2026-07-26"), 6, "跨天计算错误");
assert.equal(L.tripMoment({ startDate: "2026-07-20", endDate: "2026-07-26" }, new Date(2026, 6, 22)).value, 3, "旅行天数错误");
assert.equal(L.urgentTasks([
  { id: "later", dueAt: "2026-07-21", priority: "high", completed: false },
  { id: "first", dueAt: "2026-07-20", priority: "low", completed: false }
], {}, 1)[0].id, "first", "任务排序错误");
assert.equal(L.transferBuffer("2026-07-25", "20:00", "2026-07-26", "00:40"), 280, "转机缓冲计算错误");
assert.equal(L.transferBuffer("2026-07-25", "16:00", "2026-07-26", "00:20"), 500, "返程转机缓冲计算错误");
assert.equal(L.budgetTotals([{ id: "a", plannedAmount: 100, actualAmount: 80, paid: true, payer: "我" }], {}).actual, 80, "预算汇总错误");

const dataContext = { window: {} };
vm.createContext(dataContext);
vm.runInContext(fs.readFileSync("data/trip-data.js", "utf8"), dataContext);
const data = dataContext.window.TRIP_DATA;
const requiredSections = ["meta", "travelers", "route", "flights", "hotels", "weatherLocations", "hotelRegistry", "flightRegistry", "travelInbox", "itinerary", "transportPlan", "foodRecommendations", "travelTips", "departureChecklist", "finalDepartureChecklist", "departureCountdown", "riskAlerts", "coupleMoments", "tasks", "packing", "documents", "budget", "emergency", "gallery", "alerts", "changeLog"];
requiredSections.forEach((key) => assert.ok(data[key], `缺少数据区块: ${key}`));
assert.equal(data.meta.version, "1.4.1", "版本未更新");
assert.equal(data.meta.versionName, "Offline Pack + Travel Inbox Foundation", "版本名称未更新");
data.weatherLocations.forEach((item) => ["id", "name", "latitude", "longitude", "timezone", "sea_condition"].forEach((key) => assert.ok(key in item, `天气地点缺少 ${key}`)));
data.hotelRegistry.forEach((item) => ["hotel_name", "check_in", "check_out", "address", "check_time", "breakfast", "map_link", "status"].forEach((key) => assert.ok(key in item, `酒店Registry缺少 ${key}`)));
data.flightRegistry.forEach((item) => ["flight_number", "departure", "arrival", "status"].forEach((key) => assert.ok(key in item, `航班Registry缺少 ${key}`)));
assert.deepEqual([...data.travelInbox.items], [], "Travel Inbox不得包含真实文件");
assert.equal(data.travelInbox.visibility, "private-only", "Travel Inbox边界错误");
assert.deepEqual([...data.travelInbox.entryFields], ["documentId", "type", "title", "status", "source", "createdAt"], "Travel Inbox索引字段错误");
assert.deepEqual([...data.travelInbox.supportedTypes], ["pdf", "image"], "Travel Inbox文件类型错误");
data.finalDepartureChecklist.forEach((item) => ["phase", "time", "task", "description", "priority", "completed"].forEach((key) => assert.ok(key in item, `最终检查项缺少 ${key}`)));
assert.equal(data.departureCountdown.daysRemaining, 1, "出发倒计时错误");
assert.equal(data.departureCountdown.todayFocusTasks.length, 4, "今日重点任务数量错误");
assert.equal(data.itinerary.length, 6, "每日行程数量错误");
data.itinerary.forEach((day) => ["date", "city", "theme", "keywords", "transport", "periods", "notes", "maps"].forEach((key) => assert.ok(key in day, `${day.id} 缺少 ${key}`)));
data.flights.concat(data.hotels).forEach((item) => assert.ok(["pending", "confirmed", "changed", "cancelled"].includes(item.status), `非法状态: ${item.id}`));
assert.equal(data.flights.find((flight) => flight.id === "flight-3u3995").departureTime, "09:40", "3U3995时间错误");
assert.equal(data.flights.find((flight) => flight.id === "flight-kl-bali").flightNumber, "OD157", "OD157缺失");
assert.equal(data.flights.find((flight) => flight.id === "flight-bali-kl").flightNumber, "OD307", "OD307缺失");
assert.equal(data.flights.find((flight) => flight.id === "flight-3u3994").departureTime, "00:20", "3U3994时间错误");
data.transportPlan.flatMap((plan) => plan.legs).forEach((leg) => ["recommendedMode", "estimatedDuration", "reservationRequired", "budget"].forEach((key) => assert.ok(key in leg, `交通段缺少 ${key}`)));
data.foodRecommendations.forEach((item) => ["type", "reason", "budgetRange", "suitableTime"].forEach((key) => assert.ok(key in item, `餐饮推荐缺少 ${key}`)));
assert.equal(data.riskAlerts.length, 5, "旅行风险提醒数量错误");
assert.equal(data.coupleMoments.length, 6, "情侣拍照地点数量错误");
data.tasks.forEach((task) => ["id", "title", "category", "assignee", "priority", "dueAt", "completed", "notes"].forEach((key) => assert.ok(key in task, `任务 ${task.id} 缺少 ${key}`)));
data.budget.forEach((item) => ["category", "item", "currency", "plannedAmount", "actualAmount", "paid", "payer", "notes"].forEach((key) => assert.ok(key in item, `预算项缺少 ${key}`)));
const index = fs.readFileSync("index.html", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
assert.ok(index.indexOf("config/sync-config.js") < index.indexOf("js/sync.js") && index.indexOf("js/sync.js") < index.indexOf("js/app.js"), "同步脚本加载顺序错误");
assert.ok(index.indexOf("data/trip-data.js") < index.indexOf("data/offline-pack.js") && index.indexOf("data/offline-pack.js") < index.indexOf("js/app.js"), "Offline Pack脚本加载顺序错误");
assert.ok(index.indexOf("js/weather.js") < index.indexOf("js/app.js"), "天气脚本加载顺序错误");
assert.match(serviceWorker, /v1\.4\.1/, "Service Worker缓存版本未更新");
assert.match(serviceWorker, /config\/sync-config\.js/, "同步配置未加入离线缓存");
assert.match(serviceWorker, /js\/sync\.js/, "同步逻辑未加入离线缓存");
assert.match(serviceWorker, /js\/weather\.js/, "天气逻辑未加入离线缓存");
assert.match(serviceWorker, /data\/offline-pack\.js/, "Offline Pack未加入离线缓存");
assert.ok(appSource.indexOf("await checklistSync.push(change)") < appSource.indexOf("commitChecklistChanges([change], synced)"), "清单更新不是云端优先");
assert.match(appSource, /pendingChecklistSync/, "缺少离线同步队列");
assert.match(appSource, /syncUserName/, "缺少共享用户身份");
assert.match(appSource, /lastSyncedAt/, "缺少最后同步时间");
assert.match(appSource, /TravelWeather/, "天气模块未接入首页");
assert.match(appSource, /readinessBoard/, "Readiness Board未接入首页");
assert.match(appSource, /OFFLINE_PACK/, "Offline Pack状态卡未接入首页");
assert.ok(fs.existsSync("config/sync-config.example.js"), "缺少同步配置模板");
console.log("dashboard logic: ok");
