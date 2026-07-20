const fs = require("node:fs");
const assert = require("node:assert/strict");

const sql = fs.readFileSync("supabase/trip_members.sql", "utf8");
const baseSql = fs.readFileSync("supabase/travel_documents.sql", "utf8");

function policy(name) {
  return sql.match(new RegExp(`create policy "${name}"([\\s\\S]*?);`, "i"))?.[1] || "";
}

const selectPolicy = policy("Travel documents trip member select");
const insertPolicy = policy("Travel documents trip member insert");
const deletePolicy = policy("Travel documents uploader or trip owner delete");
assert.match(selectPolicy, /for select[\s\S]*to authenticated[\s\S]*private\.is_trip_member\(trip_id\)/i, "共享 SELECT policy 错误");
assert.match(insertPolicy, /for insert[\s\S]*to authenticated[\s\S]*trip_id is not null[\s\S]*private\.is_trip_member\(trip_id\)[\s\S]*uploaded_by = \(select auth\.uid\(\)\)/i, "共享 INSERT policy 错误");
assert.match(deletePolicy, /for delete[\s\S]*to authenticated[\s\S]*private\.is_trip_member\(trip_id\)[\s\S]*uploaded_by = \(select auth\.uid\(\)\)[\s\S]*or private\.is_trip_owner\(trip_id\)/i, "共享 DELETE policy 错误");
assert.doesNotMatch(`${baseSql}\n${sql}`, /create policy "Travel documents owner (?:select|insert|delete)"/i, "旧单用户 policy 仍会创建");
assert.doesNotMatch(sql, /on public\.travel_documents for update/i, "不需要的 UPDATE policy 被创建");
assert.match(sql, /revoke update on table public\.travel_documents from authenticated/i, "UPDATE 权限未显式撤销");

const roles = new Map([["owner:trip", "owner"], ["member:trip", "member"]]);
const role = (user, trip) => user && roles.get(`${user}:${trip}`);
const canRead = (user, trip) => Boolean(role(user, trip));
const canInsert = (user, trip, uploadedBy) => Boolean(role(user, trip)) && user === uploadedBy;
const canDelete = (user, trip, uploadedBy) => Boolean(role(user, trip)) && (user === uploadedBy || role(user, trip) === "owner");

assert.equal(canRead("owner", "trip"), true, "Owner 不能读取 Owner 文件");
assert.equal(canRead("member", "trip"), true, "Member 不能读取 Owner 文件");
assert.equal(canRead("outsider", "trip"), false, "非成员可以读取文件");
assert.equal(canRead(null, "trip"), false, "anon 可以读取文件");
assert.equal(canInsert("member", "trip", "member"), true, "Member 不能上传自己的记录");
assert.equal(canInsert("member", "trip", "owner"), false, "uploaded_by 可伪造");
assert.equal(canInsert("member", "other-trip", "member"), false, "用户可指定不属于自己的 trip_id");
assert.equal(canDelete("member", "trip", "member"), true, "Member 不能删除自己的文件");
assert.equal(canDelete("member", "trip", "owner"), false, "Member 可以删除 Owner 文件");
assert.equal(canDelete("owner", "trip", "member"), true, "Owner 不能删除 Member 文件");
assert.equal(canDelete("outsider", "trip", "outsider"), false, "非成员可以删除历史文件");

console.log("shared document rls: ok");
