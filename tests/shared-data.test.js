const fs = require("node:fs");
const assert = require("node:assert/strict");

delete globalThis.TravelSharedData;
require("../js/shared-data.js");

const Shared = globalThis.TravelSharedData;
const source = fs.readFileSync("js/shared-data.js", "utf8");
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const EXPENSE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONFIG = {
  enabled: true,
  supabaseUrl: "https://travel-test.supabase.co",
  publishableKey: "sb_publishable_12345678901234567890",
  tripId: "malaysia-bali-2026"
};
const SESSION = { access_token: "verified-access-token", user: { id: USER_A, email: "member-a@example.com" } };

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async json() { return data; } };
}

function periods(label) {
  return {
    morning: [{ id: `${label}-morning`, time: "09:30", text: "早餐", order: 10, status: "planned" }],
    noon: [],
    afternoon: [],
    evening: []
  };
}

function itineraryRow(overrides) {
  return {
    trip_id: CONFIG.tripId,
    day_id: "day-1",
    base_version: "1.5.1",
    travel_date: "2026-07-20",
    city: "成都 → 吉隆坡",
    theme: "抵达",
    transport: "3U3995",
    periods: periods("day-1"),
    notes: ["保留体力"],
    maps: [{ label: "酒店", query: "Kuala Lumpur hotel" }],
    status: "changed",
    revision: 1,
    updated_by: USER_A,
    updated_at: "2026-07-20T02:00:00Z",
    ...overrides
  };
}

function expenseRow(overrides) {
  return {
    id: EXPENSE_ID,
    trip_id: CONFIG.tripId,
    client_ref: "client-expense-1",
    title: "机场交通",
    category: "transport",
    amount_minor: 12850,
    currency: "CNY",
    incurred_on: "2026-07-20",
    paid_by_user_id: USER_A,
    split_mode: "shared",
    payment_status: "paid",
    note: null,
    revision: 1,
    created_by: USER_A,
    updated_by: USER_A,
    created_at: "2026-07-20T02:00:00Z",
    updated_at: "2026-07-20T03:00:00Z",
    ...overrides
  };
}

function itineraryInput(overrides) {
  return {
    dayId: "day-1",
    baseVersion: "1.5.1",
    travelDate: "2026-07-20",
    city: "成都 → 吉隆坡",
    theme: "抵达",
    transport: "3U3995",
    periods: periods("day-1"),
    notes: ["保留体力"],
    maps: [{ label: "酒店", query: "Kuala Lumpur hotel" }],
    status: "changed",
    ...overrides
  };
}

function expenseInput(overrides) {
  return {
    clientRef: "client-expense-1",
    title: "机场交通",
    category: "transport",
    amountMinor: 12850,
    currency: "CNY",
    incurredOn: "2026-07-20",
    paidByUserId: USER_A,
    splitMode: "shared",
    paymentStatus: "paid",
    note: null,
    ...overrides
  };
}

async function rejectsCode(run, code) {
  await assert.rejects(run, (error) => error?.code === code, `预期错误码 ${code}`);
}

function ownMembership() {
  return [{ trip_id: CONFIG.tripId, user_id: USER_A, role: "owner" }];
}

function clientWith(handler, sessionProvider) {
  const calls = [];
  const request = async (url, options) => {
    const call = { url, options, body: options?.body ? JSON.parse(options.body) : null };
    calls.push(call);
    return handler(call);
  };
  return { client: Shared.create(CONFIG, sessionProvider || (async () => SESSION), request), calls };
}

(async () => {
  assert.ok(Shared, "TravelSharedData 未导出");
  assert.deepEqual(Object.values(Shared.errorCodes).sort(), [
    "AUTH_REQUIRED", "CONFLICT", "FORBIDDEN", "IDEMPOTENCY_CONFLICT", "MEMBERSHIP_REQUIRED", "NETWORK_ERROR", "NOT_FOUND", "SESSION_EXPIRED", "VALIDATION_FAILED"
  ].sort(), "错误码契约不完整");
  assert.doesNotMatch(source, /sessionStorage|localStorage/, "shared-data 读取或保存了浏览器存储");
  assert.doesNotMatch(source, /select=\*/, "shared-data 使用 select=*");
  assert.doesNotMatch(source, /supabase_realtime|\.channel\(/i, "Commit 2 提前启用了 Realtime");

  let sessionCalls = 0;
  let happyHandler = (call) => {
    if (call.url.includes("/trip_members?")) return response(200, [
      { trip_id: CONFIG.tripId, user_id: USER_A, role: "owner" },
      { trip_id: CONFIG.tripId, user_id: USER_B, role: "member" }
    ]);
    if (call.url.includes("/travel_itinerary_overrides?")) return response(200, [itineraryRow()]);
    if (call.url.includes("/travel_expenses?")) return response(200, [expenseRow()]);
    throw new Error(`unexpected request: ${call.url}`);
  };
  const happy = clientWith((call) => happyHandler(call), async () => { sessionCalls += 1; return SESSION; });
  const expectedMethods = ["configured", "createExpense", "deleteExpense", "dispose", "loadSnapshot", "refresh", "saveItineraryOverride", "updateExpense"];
  assert.deepEqual(Object.keys(happy.client).sort(), expectedMethods.sort(), "公开 API 包含未冻结方法");
  assert.equal(happy.client.save, undefined, "存在通用 save(table,payload)");

  const snapshot = await happy.client.loadSnapshot();
  assert.equal(sessionCalls, 1, "loadSnapshot 未复用单次已验证 session");
  assert.equal(snapshot.currentUserId, USER_A);
  assert.deepEqual(snapshot.members.map((member) => member.relativeLabel), ["我", "对方"]);
  assert.equal(snapshot.itineraryOverrides[0].dayId, "day-1");
  assert.equal(snapshot.expenses[0].amountMinor, 12850);
  assert.equal(snapshot.lastRemoteUpdatedAt, "2026-07-20T03:00:00Z");
  assert.doesNotMatch(JSON.stringify(snapshot), /verified-access-token|member-a@example\.com/, "snapshot 暴露 session 数据");
  assert.equal(happy.calls.length, 3, "loadSnapshot 请求数不正确");
  happy.calls.forEach((call) => {
    assert.match(call.url, /trip_id=eq\.malaysia-bali-2026/, "读取未限定 trip_id");
    assert.match(call.url, /select=[a-z_,]+/, "读取未使用显式字段白名单");
    assert.doesNotMatch(call.url, /select=\*/, "读取使用 select=*");
    assert.equal(call.options.headers.Authorization, "Bearer verified-access-token", "未复用 Auth access token");
  });

  const memberB = clientWith((call) => {
    if (call.url.includes("/trip_members?")) return response(200, [
      { trip_id: CONFIG.tripId, user_id: USER_A, role: "owner" },
      { trip_id: CONFIG.tripId, user_id: USER_B, role: "member" }
    ]);
    if (call.url.includes("/travel_itinerary_overrides?")) return response(200, []);
    if (call.url.includes("/travel_expenses?")) return response(200, [expenseRow({ created_by: USER_A })]);
    throw new Error(`unexpected request: ${call.url}`);
  }, async () => ({ access_token: "member-b-access-token", user: { id: USER_B } })).client;
  const memberBSnapshot = await memberB.loadSnapshot();
  assert.equal(memberBSnapshot.currentUserId, USER_B, "成员B session 未生效");
  assert.equal(memberBSnapshot.expenses[0].createdBy, USER_A, "成员B无法读取成员A新增的费用");

  const deletedPayer = clientWith((call) => {
    if (call.url.includes("/trip_members?")) return response(200, ownMembership());
    if (call.url.includes("/travel_itinerary_overrides?")) return response(200, []);
    if (call.url.includes("/travel_expenses?")) return response(200, [expenseRow({ paid_by_user_id: null })]);
    throw new Error(`unexpected request: ${call.url}`);
  }, { getSession: async () => SESSION }).client;
  const deletedPayerSnapshot = await deletedPayer.loadSnapshot();
  assert.equal(deletedPayerSnapshot.expenses[0].paidByUserId, null, "已删除付款用户未按 nullable 外键读取");

  await happy.client.refresh();
  assert.equal(happy.calls.length, 6, "refresh 未重新读取完整快照");

  const writeCalls = [];
  happyHandler = (call) => {
    writeCalls.push(call);
    if (call.options.method === "POST" && call.url.includes("travel_itinerary_overrides")) return response(201, [itineraryRow()]);
    if (call.options.method === "PATCH" && call.url.includes("travel_itinerary_overrides")) return response(200, [itineraryRow({ revision: 2, updated_at: "2026-07-20T04:00:00Z" })]);
    if (call.options.method === "POST" && call.url.includes("travel_expenses")) return response(201, [expenseRow()]);
    if (call.options.method === "PATCH" && call.url.includes("travel_expenses")) return response(200, [expenseRow({ amount_minor: 15000, revision: 2 })]);
    if (call.options.method === "DELETE" && call.url.includes("travel_expenses")) return response(200, [{ id: EXPENSE_ID }]);
    throw new Error(`unexpected write request: ${call.url}`);
  };

  assert.equal((await happy.client.saveItineraryOverride(itineraryInput(), null)).revision, 1);
  assert.equal((await happy.client.saveItineraryOverride(itineraryInput(), 1)).revision, 2);
  assert.equal((await happy.client.createExpense(expenseInput())).id, EXPENSE_ID);
  assert.equal((await happy.client.updateExpense(EXPENSE_ID, { amountMinor: 15000 }, 1)).revision, 2);
  assert.equal(await happy.client.deleteExpense(EXPENSE_ID, 2), true);
  assert.equal(writeCalls.length, 5, "写操作产生了额外请求");
  writeCalls.forEach((call) => {
    assert.notEqual(call.url.includes("select=*"), true, "写入使用 select=*");
    if (["POST", "PATCH"].includes(call.options.method)) assert.equal(call.body.trip_id, CONFIG.tripId, "写入 body 缺少 trip_id");
    if (["PATCH", "DELETE"].includes(call.options.method)) {
      assert.match(call.url, /trip_id=eq\.malaysia-bali-2026/, "更新或删除未限定 trip_id");
      assert.match(call.url, /revision=eq\.\d+/, "更新或删除未携带 revision");
    }
  });
  assert.deepEqual(Object.keys(writeCalls[0].body).sort(), ["base_version", "city", "day_id", "maps", "notes", "periods", "status", "theme", "transport", "travel_date", "trip_id"].sort(), "行程写入字段越界");
  assert.deepEqual(Object.keys(writeCalls[2].body).sort(), ["amount_minor", "category", "client_ref", "currency", "incurred_on", "note", "paid_by_user_id", "payment_status", "split_mode", "title", "trip_id"].sort(), "费用写入字段越界");
  assert.deepEqual(Object.keys(writeCalls[3].body).sort(), ["amount_minor", "trip_id"], "费用更新字段越界");
  await rejectsCode(() => happy.client.createExpense({ ...expenseInput(), storagePath: "forbidden" }), Shared.errorCodes.VALIDATION_FAILED);
  await rejectsCode(() => happy.client.updateExpense(EXPENSE_ID, { clientRef: "forbidden" }, 1), Shared.errorCodes.VALIDATION_FAILED);

  const authMissing = clientWith(() => { throw new Error("request should not run"); }, async () => null).client;
  await rejectsCode(() => authMissing.loadSnapshot(), Shared.errorCodes.AUTH_REQUIRED);

  const expiredError = new Error("session expired");
  expiredError.status = 401;
  const expired = clientWith(() => { throw new Error("request should not run"); }, async () => { throw expiredError; }).client;
  await rejectsCode(() => expired.loadSnapshot(), Shared.errorCodes.SESSION_EXPIRED);

  const noMember = clientWith((call) => {
    if (call.url.includes("trip_members")) return response(200, []);
    return response(200, []);
  }, async () => ({ access_token: "outsider-access-token", user: { id: OUTSIDER } })).client;
  await rejectsCode(() => noMember.loadSnapshot(), Shared.errorCodes.MEMBERSHIP_REQUIRED);
  await rejectsCode(() => noMember.createExpense(expenseInput()), Shared.errorCodes.MEMBERSHIP_REQUIRED);

  const invalid = clientWith(() => { throw new Error("request should not run"); }).client;
  await rejectsCode(() => invalid.saveItineraryOverride({ ...itineraryInput(), storagePath: "forbidden" }, null), Shared.errorCodes.VALIDATION_FAILED);

  const stale = clientWith((call) => {
    if (call.url.includes("trip_members")) return response(200, ownMembership());
    if (call.options.method === "PATCH") return response(200, []);
    if (call.url.includes(`id=eq.${EXPENSE_ID}`)) return response(200, [expenseRow({ revision: 2 })]);
    throw new Error(`unexpected request: ${call.url}`);
  }).client;
  await rejectsCode(() => stale.updateExpense(EXPENSE_ID, { amountMinor: 15000 }, 1), Shared.errorCodes.CONFLICT);

  const missing = clientWith((call) => {
    if (call.url.includes("trip_members")) return response(200, ownMembership());
    return response(200, []);
  }).client;
  await rejectsCode(() => missing.deleteExpense(EXPENSE_ID, 1), Shared.errorCodes.NOT_FOUND);

  const duplicate = clientWith((call) => {
    if (call.url.includes("trip_members")) return response(200, ownMembership());
    if (call.options.method === "POST") return response(409, { message: "duplicate key" });
    if (call.url.includes("client_ref=eq.client-expense-1")) return response(200, [expenseRow({ amount_minor: 999 })]);
    throw new Error(`unexpected request: ${call.url}`);
  }).client;
  await rejectsCode(() => duplicate.createExpense(expenseInput()), Shared.errorCodes.IDEMPOTENCY_CONFLICT);

  const idempotentRetry = clientWith((call) => {
    if (call.url.includes("trip_members")) return response(200, ownMembership());
    if (call.options.method === "POST") return response(409, { message: "duplicate key" });
    if (call.url.includes("client_ref=eq.client-expense-1")) return response(200, [expenseRow()]);
    throw new Error(`unexpected request: ${call.url}`);
  }).client;
  assert.equal((await idempotentRetry.createExpense(expenseInput())).id, EXPENSE_ID, "相同 client_ref 与内容未幂等返回原记录");

  const forbidden = clientWith(() => response(403, { message: "forbidden" })).client;
  await rejectsCode(() => forbidden.loadSnapshot(), Shared.errorCodes.FORBIDDEN);

  const network = clientWith(() => { throw new Error("network down"); }).client;
  await rejectsCode(() => network.loadSnapshot(), Shared.errorCodes.NETWORK_ERROR);

  happy.client.dispose();
  await rejectsCode(() => happy.client.loadSnapshot(), Shared.errorCodes.NETWORK_ERROR);

  console.log("authenticated shared travel data client: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
