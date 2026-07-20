const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = { window: { atob: (value) => Buffer.from(value, "base64").toString("utf8") }, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/documents.js", "utf8"), context);
const Documents = context.window.TravelDocuments;
const config = {
  enabled: true,
  supabaseUrl: "https://travel-test.supabase.co",
  publishableKey: `sb_publishable_${"x".repeat(24)}`,
  tripId: "malaysia-bali-2026"
};
const login = {
  access_token: "user-access-token",
  refresh_token: "user-refresh-token",
  expires_in: 3600,
  user: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", email: "test@example.com" }
};

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async json() { return data; } };
}

async function scenario({ objectExists = true, storageStatus = 200, networkError = false, metadataFailures = 0 } = {}) {
  const record = { id: "11111111-2222-4333-8444-555555555555", storage_path: `malaysia-bali-2026/${login.user.id}/test.pdf` };
  let metadata = { ...record };
  let object = objectExists;
  let deleteAttempts = 0;
  const service = Documents.create(config, async (url, options) => {
    if (url.includes("grant_type=password")) return response(200, login);
    if (url.includes("/rest/v1/trip_members") && options.method === "GET") return response(200, [{ role: "owner" }]);
    if (url.includes("/rest/v1/travel_documents") && options.method === "GET") return response(200, metadata ? [metadata] : []);
    if (url.endsWith("/storage/v1/object/travel-documents") && options.method === "DELETE") {
      if (networkError) throw new Error("network offline");
      if (storageStatus !== 200) return response(storageStatus, { message: storageStatus === 404 ? "Object not found" : "permission denied" });
      if (!object) return response(404, { message: "Object not found" });
      object = false;
      return response(200, []);
    }
    if (url.includes("/rest/v1/travel_documents") && options.method === "DELETE") {
      deleteAttempts += 1;
      if (deleteAttempts <= metadataFailures) return response(500, { message: "database unavailable" });
      metadata = null;
      return response(204, null);
    }
    return response(404, { message: "unknown endpoint" });
  }, null, { auth: { async signOut() {} } });
  await service.signIn("test@example.com", "test-password");
  return { service, record, state: () => ({ metadata, object, deleteAttempts }) };
}

(async () => {
  const both = await scenario();
  await both.service.remove(both.record);
  assert.deepEqual(both.state(), { metadata: null, object: false, deleteAttempts: 1 }, "A: Storage 与元数据未同时删除");

  const missingObject = await scenario({ objectExists: false });
  await missingObject.service.remove(missingObject.record);
  assert.equal(missingObject.state().metadata, null, "B: Storage 404 时元数据未清理");

  const retry = await scenario({ metadataFailures: 1 });
  await assert.rejects(() => retry.service.remove(retry.record), (error) => error.message === "删除未完成，可重试" && error.storageRemoved, "C: 数据库失败未返回可重试状态");
  assert.equal(retry.state().object, false, "C: 第一次未删除 Storage");
  await retry.service.remove(retry.record);
  assert.equal(retry.state().metadata, null, "C: 第二次未清理元数据");

  const forbidden = await scenario({ storageStatus: 403 });
  await assert.rejects(() => forbidden.service.remove(forbidden.record), /permission denied/, "D: 无删除权限未中止");
  assert.notEqual(forbidden.state().metadata, null, "D: 无权限时错误删除元数据");

  const offline = await scenario({ networkError: true });
  await assert.rejects(() => offline.service.remove(offline.record), /network offline/, "E: 网络中断未中止");
  assert.notEqual(offline.state().metadata, null, "E: 网络中断时错误删除元数据");

  const source = fs.readFileSync("js/documents.js", "utf8");
  assert.doesNotMatch(source, /delete\s+from\s+storage\.objects/i, "不得直接修改 storage.objects");
  console.log("document delete recovery: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
