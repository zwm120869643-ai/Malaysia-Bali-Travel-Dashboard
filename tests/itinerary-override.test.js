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
const baseDay = data.itinerary[0];

const publicItinerary = [baseDay];
assert.strictEqual(L.mergeItinerary(publicItinerary, []), publicItinerary, "无 override 时不应改写旧版行程");

const draft = L.itineraryDraft(baseDay, null, data.meta.version);
assert.equal(draft.dayId, baseDay.id);
assert.equal(draft.periods.morning[0].text, baseDay.periods.morning[0]);
assert.equal(draft.status, "changed");

const added = L.addItineraryActivity(draft, "morning", "member-a-new-activity");
assert.equal(draft.periods.morning.length + 1, added.periods.morning.length, "新增活动失败");
assert.equal(added.periods.morning.at(-1).status, "planned");
const edited = L.updateItineraryActivity(added, "morning", "member-a-new-activity", "text", "成员A新增的早餐");
assert.equal(edited.periods.morning.at(-1).text, "成员A新增的早餐", "活动修改失败");
const moved = L.moveItineraryActivity(edited, "morning", "member-a-new-activity", "up");
assert.equal([...moved.periods.morning].sort((a, b) => a.order - b.order)[0].id, "member-a-new-activity", "活动排序失败");
const cancelled = L.cancelItineraryActivity(moved, "morning", "member-a-new-activity");
assert.equal(cancelled.periods.morning.find((item) => item.id === "member-a-new-activity").status, "cancelled", "删除必须标记 cancelled");

const override = {
  ...draft,
  city: "共享城市",
  theme: "共享主题",
  transport: "成员A更新的交通",
  periods: {
    ...draft.periods,
    morning: [
      { id: "later", time: "10:00", text: "第二项", order: 20, status: "planned" },
      { id: "removed", time: null, text: "已删除项", order: 15, status: "cancelled" },
      { id: "first", time: null, text: "第一项", order: 10, status: "planned" }
    ]
  },
  notes: ["成员A更新的注意事项"],
  status: "changed",
  revision: 4,
  updatedBy: "11111111-1111-4111-8111-111111111111"
};
const memberBSnapshot = {
  currentUserId: "22222222-2222-4222-8222-222222222222",
  itineraryOverrides: [override]
};
const merged = L.mergeItinerary([baseDay], memberBSnapshot.itineraryOverrides)[0];
assert.equal(merged.transport, "成员A更新的交通", "override 未覆盖基础交通");
assert.deepEqual(merged.periods.morning, ["第一项", "10:00 第二项"], "override 排序或 cancelled 过滤错误");
assert.deepEqual(merged.notes, ["成员A更新的注意事项"], "override 注意事项未覆盖");
assert.equal(merged.overrideRevision, 4, "override revision 未保留");

const app = fs.readFileSync("js/app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const persisted = app.match(/function persistentState\(value\) \{([\s\S]*?)\n  \}/)?.[1] || "";
const cancelEdit = app.match(/function cancelItineraryEdit\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";
const itineraryView = app.match(/function renderItinerary\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";
const flightPreset = app.match(/function applyItineraryPreset\(name\) \{([\s\S]*?)\n  \}/)?.[1] || "";

assert.ok(index.indexOf("js/shared-data.js") < index.indexOf("js/app.js"), "shared-data 必须先于 app 加载");
assert.match(app, /TravelSharedData\.create\(window\.TRAVEL_SYNC_CONFIG, documentService\)/, "未复用现有 Auth session provider");
assert.match(app, /saveItineraryOverride\(itineraryEdit\.value, itineraryEdit\.revision\)/, "保存未携带 revision");
assert.match(app, /await sharedDataService\.saveItineraryOverride[\s\S]*itineraryEdit = null;[\s\S]*loadSharedSnapshot\(true\)/, "保存成功后未刷新 snapshot");
assert.match(app, /error\?\.code === "CONFLICT"[\s\S]*loadSharedSnapshot\(true\)/, "revision 冲突未提示并刷新 snapshot");
assert.match(app, /if \(!documentService\.authenticated\) return showToast\("登录后才能编辑共享行程"\)/, "未登录写入缺少 UI guard");
assert.match(itineraryView, /data-command-itinerary=/, "行程页头缺少直接编辑入口");
assert.match(itineraryView, /继续编辑[\s\S]*编辑今日行程[\s\S]*编辑首日行程/, "行程编辑入口未反映当前编辑或旅行日期状态");
assert.match(app, /data-itinerary-root-field="theme"/, "行程编辑器缺少 theme 字段");
assert.match(app, /data-itinerary-root-field="status"/, "行程编辑器缺少 status 字段");
assert.match(app, /status === "pending" \? "planned" : status/, "planned 未兼容数据库既有 pending 状态");
assert.match(app, /data-itinerary-preset="od306"/, "缺少 OD306 航班变更快捷输入");
for (const value of ["OD306", "2026-07-22", "09:00", "Kuala Lumpur → Bali", "12:00", "arrival", "酒店入住", "晚餐休息"]) {
  assert.match(flightPreset, new RegExp(value), `OD306 快捷输入缺少 ${value}`);
}
assert.match(flightPreset, /status: "confirmed"/, "OD306 快捷输入未设为 confirmed");
assert.ok(cancelEdit, "缺少取消编辑流程");
assert.doesNotMatch(cancelEdit, /sharedDataService|saveItineraryOverride/, "取消编辑触发了云端写入");
assert.doesNotMatch(persisted, /itinerary|override|snapshot/i, "共享行程进入 localStorage 白名单");
assert.doesNotMatch(persisted, /OD306|theme/i, "行程快捷输入进入 localStorage 白名单");
assert.doesNotMatch(app, /supabase_realtime|\.channel\(/i, "Commit 3 不得开启 Realtime");
assert.match(worker, /url\.origin !== location\.origin\) return;/, "Service Worker 未排除 Supabase 跨域响应");
assert.doesNotMatch(worker, /travel_itinerary_overrides|travel_expenses/, "Service Worker 不得登记共享私有数据路径");
assert.match(css, /\.itinerary-editor \{[^}]*min-width: 0;/, "行程编辑器缺少窄屏收缩边界");
assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.itinerary-activity-fields \{ grid-template-columns: minmax\(0, 1fr\); \}/, "430px 移动布局缺失");

console.log("mobile itinerary overrides: ok");
