const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = {
  window: {
    atob: (value) => Buffer.from(value, "base64").toString("utf8"),
    crypto: { randomUUID: () => "11111111-2222-4333-8444-555555555555" }
  },
  URL,
  console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/documents.js", "utf8"), context);
const Documents = context.window.TravelDocuments;

const config = {
  enabled: true,
  supabaseUrl: "https://travel-test.supabase.co/rest/v1/",
  publishableKey: `sb_publishable_${"x".repeat(24)}`,
  tripId: "malaysia-bali-2026"
};

function memoryStore() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async json() { return data; } };
}

const records = [];
const objects = new Set();
let objectDeleteAuthorized = false;

async function mockRequest(url, options) {
  const headers = options.headers || {};
  if (url.includes("/auth/v1/token?grant_type=password")) {
    return response(200, {
      access_token: "user-access-token",
      refresh_token: "user-refresh-token",
      expires_in: 3600,
      user: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", email: "traveler@example.com" }
    });
  }
  if (headers.Authorization !== "Bearer user-access-token") return response(401, { message: "not authenticated" });

  if (url.includes("/rest/v1/trip_members") && options.method === "GET") return response(200, [{ role: "owner" }]);
  if (url.includes("/storage/v1/object/sign/")) {
    return response(200, { signedURL: "/object/sign/travel-documents/private.pdf?token=short-lived" });
  }
  if (url.endsWith("/storage/v1/object/travel-documents") && options.method === "DELETE") {
    objectDeleteAuthorized = true;
    JSON.parse(options.body).prefixes.forEach((path) => objects.delete(path));
    return response(200, []);
  }
  if (url.includes("/storage/v1/object/travel-documents/") && options.method === "POST") {
    const path = decodeURIComponent(url.split("/travel-documents/")[1]);
    objects.add(path);
    return response(200, { Key: `travel-documents/${path}`, Id: "storage-object" });
  }
  if (url.includes("/rest/v1/travel_documents") && options.method === "POST") {
    const record = { ...JSON.parse(options.body), created_at: "2026-07-20T01:50:00Z" };
    records.unshift(record);
    return response(201, [record]);
  }
  if (url.includes("/rest/v1/travel_documents") && options.method === "DELETE") {
    const id = new URL(url).searchParams.get("id").replace(/^eq\./, "");
    const index = records.findIndex((item) => item.id === id);
    if (index >= 0) records.splice(index, 1);
    return response(204, null);
  }
  if (url.includes("/rest/v1/travel_documents") && options.method === "GET") return response(200, records);
  return response(404, { message: "unknown endpoint" });
}

(async () => {
  assert.equal(Documents.normalizeConfig(config).configured, true, "有效配置未启用");
  assert.equal(Documents.normalizeConfig({ ...config, publishableKey: "sb_secret_forbidden_key_123456789" }).configured, false, "secret key未拦截");
  const rolePayload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  assert.equal(Documents.normalizeConfig({ ...config, publishableKey: `eyJhbGciOiJIUzI1NiJ9.${rolePayload}.signature` }).configured, false, "service_role JWT未拦截");

  const unauthenticated = Documents.create(config, mockRequest, memoryStore());
  await assert.rejects(() => unauthenticated.upload({}), /请先登录/, "未登录用户不应上传");

  const service = Documents.create(config, mockRequest, memoryStore());
  await service.signIn("traveler@example.com", "test-password");
  assert.equal(service.authenticated, true, "登录状态错误");

  const testPdf = new Blob(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"], { type: "application/pdf" });
  const uploaded = await service.upload({ file: testPdf, category: "flights", title: "3U3995 航班资料", relatedItemId: "flight-3u3995" });
  assert.equal(uploaded.category, "flights", "PDF分类错误");
  assert.equal(uploaded.related_item_id, "flight-3u3995", "航班关联错误");
  assert.equal(uploaded.uploaded_by, service.user.id, "上传者身份错误");
  assert.match(uploaded.storage_path, /^malaysia-bali-2026\/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee\/.+\.pdf$/, "共享对象路径错误");
  assert.equal((await service.list()).length, 1, "Document Registry读取错误");

  const signedUrl = await service.signedUrl(uploaded, 300);
  assert.match(signedUrl, /^https:\/\/travel-test\.supabase\.co\/storage\/v1\/object\/sign\//, "未生成私有signed URL");
  assert.match(signedUrl, /token=short-lived/, "signed URL缺少临时token");

  await service.remove(uploaded);
  assert.equal(objectDeleteAuthorized, true, "删除未通过已认证Storage API");
  assert.equal((await service.list()).length, 0, "删除后Registry仍有记录");
  service.signOut();
  assert.equal(service.authenticated, false, "退出登录失败");

  const sql = fs.readFileSync("supabase/travel_documents.sql", "utf8");
  const membershipSql = fs.readFileSync("supabase/trip_members.sql", "utf8");
  ["id", "trip_id", "category", "title", "storage_path", "status", "uploaded_by", "created_at"].forEach((field) => assert.match(sql, new RegExp(`\\b${field}\\b`), `travel_documents缺少字段: ${field}`));
  assert.match(sql, /enable row level security/i, "travel_documents未启用RLS");
  assert.match(sql, /revoke all on table public\.travel_documents from anon/i, "匿名表权限未撤销");
  assert.match(membershipSql, /to authenticated/gi, "共享策略未限制authenticated用户");
  assert.match(membershipSql, /auth\.uid\(\)/i, "共享策略未绑定Supabase Auth用户");
  assert.match(sql, /'travel-documents'[\s\S]*false/i, "Storage Bucket未设置private");
  assert.doesNotMatch(fs.readFileSync("js/documents.js", "utf8"), /object\/public/, "私人资料代码不应生成公开URL");

  console.log("private document center: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
