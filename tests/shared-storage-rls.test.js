const fs = require("node:fs");
const assert = require("node:assert/strict");

const sql = fs.readFileSync("supabase/trip_members.sql", "utf8");
const baseSql = fs.readFileSync("supabase/travel_documents.sql", "utf8");
const documents = fs.readFileSync("js/documents.js", "utf8");

function policy(name) {
  return sql.match(new RegExp(`create policy "${name}"([\\s\\S]*?);`, "i"))?.[1] || "";
}

const selectPolicy = policy("Travel documents trip member object select");
const insertPolicy = policy("Travel documents trip member object insert");
const deletePolicy = policy("Travel documents uploader or trip owner object delete");
assert.match(baseSql, /'travel-documents'[\s\S]*false[\s\S]*10485760/i, "Bucket 不是 Private 10MB");
assert.match(selectPolicy, /for select[\s\S]*to authenticated[\s\S]*bucket_id = 'travel-documents'[\s\S]*is_trip_member\(\(storage\.foldername\(name\)\)\[1\]\)/i, "Storage SELECT policy 错误");
assert.match(insertPolicy, /for insert[\s\S]*to authenticated[\s\S]*is_trip_member\(\(storage\.foldername\(name\)\)\[1\]\)[\s\S]*foldername\(name\)\)\[2\] = \(select auth\.uid\(\)\)::text[\s\S]*\('pdf', 'png', 'jpg', 'jpeg'\)/i, "Storage INSERT policy 错误");
assert.match(deletePolicy, /for delete[\s\S]*to authenticated[\s\S]*private\.is_trip_member\(\(storage\.foldername\(name\)\)\[1\]\)[\s\S]*owner_id = \(select auth\.uid\(\)\)::text[\s\S]*or private\.is_trip_owner\(\(storage\.foldername\(name\)\)\[1\]\)/i, "Storage DELETE policy 错误");
assert.doesNotMatch(sql, /on storage\.objects for update/i, "Storage UPDATE policy 不应存在");
assert.doesNotMatch(sql, /(?:insert into|update|delete from) storage\.objects/i, "不得直接修改 storage.objects");
assert.match(documents, /`\$\{config\.tripId\}\/\$\{session\.user\.id\}\/\$\{id\}\.\$\{MIME_EXTENSIONS\[value\.file\.type\]\}`/, "Storage 路径不是 trip/user/random UUID");
assert.doesNotMatch(documents, /doc-\$\{Date\.now\(\)\}/, "文件名不得退化为可猜测时间戳");
assert.match(documents, /"x-upsert": "false"/, "上传仍可能 upsert");

const roles = new Map([["owner:trip", "owner"], ["member:trip", "member"]]);
const role = (user, trip) => user && roles.get(`${user}:${trip}`);
const canRead = (user, trip) => Boolean(role(user, trip));
const canInsert = (user, trip, uploader, extension) => Boolean(role(user, trip)) && user === uploader && ["pdf", "png", "jpg", "jpeg"].includes(extension);
const canDelete = (user, trip, objectOwner) => Boolean(role(user, trip)) && (user === objectOwner || role(user, trip) === "owner");

assert.equal(canRead("member", "trip"), true, "Member 不能生成 Owner 文件 signed URL");
assert.equal(canRead("outsider", "trip"), false, "非成员可读取 Storage");
assert.equal(canRead(null, "trip"), false, "anon 可读取 Storage");
assert.equal(canInsert("member", "trip", "member", "pdf"), true, "Member 不能上传到自己的目录");
assert.equal(canInsert("member", "trip", "owner", "pdf"), false, "Member 可以上传到 Owner 目录");
assert.equal(canInsert("member", "other-trip", "member", "pdf"), false, "Member 可以上传到其他 trip");
assert.equal(canDelete("member", "trip", "member"), true, "Member 不能删除自己的对象");
assert.equal(canDelete("member", "trip", "owner"), false, "Member 可以删除 Owner 对象");
assert.equal(canDelete("owner", "trip", "member"), true, "Owner 不能删除 Member 对象");
assert.equal(canDelete("outsider", "trip", "outsider"), false, "非成员可以删除历史对象");

console.log("shared storage rls: ok");
