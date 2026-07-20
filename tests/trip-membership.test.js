const fs = require("node:fs");
const assert = require("node:assert/strict");

const sql = fs.readFileSync("supabase/trip_members.sql", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const documents = fs.readFileSync("js/documents.js", "utf8");

["trip_id text not null", "user_id uuid not null", "role text not null", "created_at timestamptz not null", "primary key (trip_id, user_id)"].forEach((field) => {
  assert.match(sql, new RegExp(field.replace(/[()]/g, "\\$&"), "i"), `trip_members 缺少: ${field}`);
});
assert.match(sql, /role in \('owner', 'member'\)/i, "membership role 未限制");
assert.match(sql, /references auth\.users\(id\) on delete cascade/i, "membership 未关联 Auth 用户");
assert.match(sql, /trip_members_user_trip_idx[\s\S]*\(user_id, trip_id\)/i, "membership 查询索引缺失");
assert.match(sql, /alter table public\.trip_members enable row level security/i, "trip_members 未启用 RLS");
assert.match(sql, /revoke all on table public\.trip_members from anon/i, "anon 权限未撤销");
assert.match(sql, /revoke insert, update, delete on table public\.trip_members from authenticated/i, "浏览器 membership 写权限未撤销");
assert.match(sql, /create policy "Trip members own membership select"[\s\S]*to authenticated[\s\S]*user_id = \(select auth\.uid\(\)\)/i, "用户不能仅查看自己的 membership");

for (const name of ["is_trip_member", "is_trip_owner"]) {
  const fn = sql.match(new RegExp(`create or replace function private\\.${name}\\(target_trip_id text\\)([\\s\\S]*?)\\$\\$;`, "i"))?.[1] || "";
  assert.ok(fn, `${name} 缺失`);
  assert.match(fn, /stable/i, `${name} 不是 stable`);
  assert.match(fn, /security definer/i, `${name} 不是 security definer`);
  assert.match(fn, /set search_path = pg_catalog/i, `${name} 未固定 search_path`);
  assert.match(fn, /from public\.trip_members/i, `${name} 未使用 fully-qualified 表名`);
  assert.match(fn, /auth\.uid\(\)/i, `${name} 未使用当前 Auth 用户`);
  assert.doesNotMatch(fn, /user_metadata/i, `${name} 依赖 user_metadata`);
}
assert.doesNotMatch(sql, /private\.is_trip_(?:member|owner)\([^)]*user_id/i, "membership 函数接受了 user_id");
assert.match(sql, /revoke all on schema private from public, anon/i, "private schema 未收紧");
assert.doesNotMatch(sql, /insert into public\.trip_members/i, "migration 不得包含真实 membership");
assert.doesNotMatch(sql, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i, "migration 包含用户 UUID");

const persisted = app.match(/function persistentState\(value\) \{([\s\S]*?)\n  \}/)?.[1] || "";
assert.doesNotMatch(persisted, /membership|role|user_id|uuid/i, "membership 进入 localStorage");
assert.doesNotMatch(app, /uploaded_by|user\?*\.id/, "UI 暴露用户 UUID 字段");
assert.match(documents, /rest\/v1\/trip_members/, "前端未查询 trip_members");
assert.match(documents, /select=role&limit=1/, "前端未读取自己的 membership role");

console.log("trip membership: ok");
