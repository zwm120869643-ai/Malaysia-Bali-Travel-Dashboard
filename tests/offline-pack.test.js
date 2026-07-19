const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("data/trip-data.js", "utf8"), context);
vm.runInContext(fs.readFileSync("data/offline-pack.js", "utf8"), context);

const pack = context.window.OFFLINE_PACK;
["flights", "hotels", "emergency", "itinerary", "checklistSummary"].forEach((key) => assert.ok(pack[key], `Offline Pack缺少 ${key}`));
assert.equal(pack.version, "1.4.3", "Offline Pack版本错误");
assert.equal(pack.offlineReady, true, "Offline Pack未标记为离线可用");
assert.ok(pack.flights.length > 0 && pack.hotels.length > 0 && pack.itinerary.length > 0, "Offline Pack公开数据为空");
assert.deepEqual(Object.keys(pack.checklistSummary).sort(), ["completed", "highPriorityPending", "pending", "total"], "Checklist摘要字段错误");
assert.doesNotMatch(JSON.stringify(pack), /(护照|身份证|银行卡|订单号|支付信息|CVV|密码)/i, "Offline Pack包含敏感数据");
console.log("offline pack: ok");
