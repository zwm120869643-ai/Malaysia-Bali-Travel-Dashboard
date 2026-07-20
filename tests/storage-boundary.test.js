const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("js/app.js", "utf8");
const documents = fs.readFileSync("js/documents.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const offlinePack = fs.readFileSync("data/offline-pack.js", "utf8");

const persisted = app.match(/function persistentState\(value\) \{([\s\S]*?)\n  \}/)?.[1] || "";
assert.ok(persisted, "缺少 localStorage 显式持久化白名单");
assert.doesNotMatch(persisted, /notes|document|signed|storage_path|token/i, "localStorage 白名单包含私人字段");
assert.doesNotMatch(app, /raw\.notes/, "legacy 自由备注仍会从 localStorage 恢复");
assert.match(app, /LOCAL_STORAGE_ALLOWLIST/, "缺少 localStorage key 白名单");
assert.match(app, /startsWith\("malaysia-bali-"\)[\s\S]*LOCAL_STORAGE_ALLOWLIST\.has\(key\)[\s\S]*removeItem\(key\)/, "legacy note key 未清理");
assert.match(app, /const clean = normalizeState[\s\S]*setItem\(STORAGE_KEY, JSON\.stringify\(persistentState\(clean\)\)\)/, "旧状态未按白名单重写");
assert.match(app, /备注仅保留在当前页面/, "备注仍宣称持久化");
assert.doesNotMatch(offlinePack, /state\.notes|temporary-note|today-note/, "自由备注进入 Offline Pack");

assert.equal((documents.match(/sessionStore\?\.setItem/g) || []).length, 1, "Auth 会话存在额外持久化路径");
assert.doesNotMatch(documents, /(localStorage|setItem\([^\n]*(signed|storage_path))/i, "私人文档或 signed URL 进入持久化存储");
assert.match(documents, /const SIGNED_URL_SECONDS = 60;/, "signed URL 不是 60 秒");
assert.match(documents, /JSON\.stringify\(\{ expiresIn: SIGNED_URL_SECONDS \}\)/, "signed URL 请求未固定为 60 秒");
assert.match(app, /documentService\.signedUrl\(item\)/, "查看操作没有每次重新签发 URL");
assert.match(app, /visibilitychange[\s\S]*clearSignedUrls/, "页面隐藏时未清理 signed URL 引用");
assert.match(worker, /privateRequest[\s\S]*travel_documents[\s\S]*storage\/v1/, "Service Worker 未显式排除私人请求");

console.log("storage boundary: ok");
