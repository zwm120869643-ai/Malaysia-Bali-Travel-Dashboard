const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = { window: { atob: (value) => Buffer.from(value, "base64").toString("utf8") }, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/documents.js", "utf8"), context);
const Documents = context.window.TravelDocuments;
const SESSION_KEY = "malaysia-bali-document-session-v1";
const config = {
  enabled: true,
  supabaseUrl: "https://travel-test.supabase.co",
  publishableKey: `sb_publishable_${"x".repeat(24)}`,
  tripId: "malaysia-bali-2026"
};

function memoryStore(seed) {
  const values = new Map(Object.entries(seed || {}));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async json() { return data; } };
}

const login = {
  access_token: "valid-access-token",
  refresh_token: "valid-refresh-token",
  expires_in: 3600,
  user: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", email: "test@example.com" }
};

(async () => {
  let localSignOuts = 0;
  const supabase = { auth: { async signOut(options) { assert.equal(options.scope, "local"); localSignOuts += 1; } } };
  const expiredStore = memoryStore({
    [SESSION_KEY]: JSON.stringify({ ...login, expires_at: 1 })
  });
  const invalidRefresh = Documents.create(config, async (url) => {
    if (url.includes("grant_type=refresh_token")) return response(400, { message: "Invalid Refresh Token" });
    return response(404, {});
  }, expiredStore, supabase);
  let invalidReason = "";
  invalidRefresh.onInvalid((reason) => { invalidReason = reason; return invalidRefresh.reset(reason); });
  await assert.rejects(() => invalidRefresh.getSession(), /登录已失效，请重新登录/, "无效 refresh token 未失效会话");
  assert.equal(invalidRefresh.authenticated, false, "refresh 失败后仍为 authenticated");
  assert.equal(expiredStore.getItem(SESSION_KEY), null, "refresh 失败后 sessionStorage 未清空");
  assert.equal(invalidReason, "登录已失效，请重新登录", "refresh 失败原因错误");
  assert.equal(localSignOuts, 1, "未调用 local signOut");

  let privateRows = [{ id: "private-document" }];
  let rejectPrivateList = true;
  const store = memoryStore();
  const service = Documents.create(config, async (url) => {
    if (url.includes("grant_type=password")) return response(200, login);
    if (url.endsWith("/auth/v1/user")) return response(200, login.user);
    if (url.includes("/rest/v1/trip_members")) return response(200, [{ role: "member" }]);
    if (url.includes("/rest/v1/travel_documents")) return rejectPrivateList ? response(401, { message: "JWT expired" }) : response(200, privateRows);
    return response(404, {});
  }, store, supabase);
  service.onInvalid((reason) => {
    privateRows = [];
    return service.reset(reason);
  });
  await service.signIn("test@example.com", "test-password");
  await assert.rejects(() => service.list(), /JWT expired/, "401 私人接口未返回错误");
  assert.equal(service.authenticated, false, "401 后仍为 authenticated");
  assert.deepEqual(privateRows, [], "401 后私人列表未立即清空");

  const empty = Documents.create(config, async () => response(500, {}), memoryStore(), supabase);
  assert.equal(await empty.getSession(), null, "session=null 应返回 null");
  assert.equal(empty.authenticated, false, "session=null 不应认证");

  rejectPrivateList = false;
  await service.signIn("test@example.com", "test-password");
  privateRows = [{ id: "restored-document" }];
  assert.equal((await service.list())[0].id, "restored-document", "重新登录后未恢复读取");

  const signOutRun = service.signOut();
  assert.deepEqual(privateRows, [], "退出后私人列表未同步清空");
  await signOutRun;
  assert.equal(service.authenticated, false, "退出后仍为 authenticated");

  console.log("auth session recovery: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
