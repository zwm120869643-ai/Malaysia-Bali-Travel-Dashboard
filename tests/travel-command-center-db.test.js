const fs = require("node:fs");
const assert = require("node:assert/strict");

const sql = fs.readFileSync("supabase/travel_command_center.sql", "utf8");
const executableSql = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

function table(name) {
  return sql.match(new RegExp(`create table if not exists public\\.${name} \\(([\\s\\S]*?)\\n\\);`, "i"))?.[1] || "";
}

function policy(name) {
  return sql.match(new RegExp(`create policy "${name}"([\\s\\S]*?);`, "i"))?.[1] || "";
}

const itinerary = table("travel_itinerary_overrides");
const expenses = table("travel_expenses");
assert.ok(itinerary, "travel_itinerary_overrides 表缺失");
assert.ok(expenses, "travel_expenses 表缺失");

for (const field of ["trip_id text not null", "day_id text not null", "base_version text not null", "travel_date date not null", "periods jsonb not null", "notes text[] not null", "maps jsonb not null", "revision bigint not null", "updated_by uuid", "updated_at timestamptz not null"]) {
  assert.ok(itinerary.toLowerCase().includes(field.toLowerCase()), `itinerary schema 缺少 ${field}`);
}
assert.match(itinerary, /primary key \(trip_id, day_id\)/i, "itinerary 主键错误");
assert.match(itinerary, /unique \(trip_id, travel_date\)/i, "itinerary 日期唯一约束缺失");
assert.match(itinerary, /private\.valid_itinerary_periods\(periods\)/i, "periods DB 校验缺失");
assert.match(itinerary, /private\.valid_itinerary_notes\(notes\)/i, "notes DB 校验缺失");
assert.match(itinerary, /private\.valid_itinerary_maps\(maps\)/i, "maps DB 校验缺失");
assert.match(itinerary, /status in \('pending', 'confirmed', 'changed', 'cancelled'\)/i, "itinerary 状态枚举错误");

for (const field of ["id uuid primary key", "trip_id text not null", "client_ref text not null", "title text not null", "category text not null", "amount_minor bigint not null", "currency char(3) not null", "incurred_on date not null", "paid_by_user_id uuid", "split_mode text not null", "payment_status text not null", "revision bigint not null", "created_by uuid", "updated_by uuid", "created_at timestamptz not null", "updated_at timestamptz not null"]) {
  assert.ok(expenses.toLowerCase().includes(field.toLowerCase()), `expense schema 缺少 ${field}`);
}
assert.match(expenses, /unique \(trip_id, client_ref\)/i, "expense 幂等唯一约束缺失");
assert.match(expenses, /amount_minor between 1 and 999999999999/i, "expense 金额边界错误");
assert.match(expenses, /currency in \('CNY', 'MYR', 'IDR', 'USD'\)/i, "expense 币种枚举错误");
assert.match(expenses, /split_mode in \('shared', 'personal'\)/i, "expense 分摊枚举错误");
assert.match(expenses, /payment_status in \('pending', 'paid', 'refunded'\)/i, "expense 支付状态错误");

for (const index of ["travel_itinerary_overrides_trip_updated_idx", "travel_expenses_trip_date_idx", "travel_expenses_trip_currency_status_idx"]) {
  assert.match(sql, new RegExp(`create index if not exists ${index}`, "i"), `索引缺失: ${index}`);
}

assert.match(sql, /create trigger travel_itinerary_overrides_metadata[\s\S]*before insert or update[\s\S]*private\.set_itinerary_override_metadata\(\)/i, "itinerary metadata trigger 缺失");
assert.match(sql, /create trigger travel_expenses_metadata[\s\S]*before insert or update[\s\S]*private\.set_expense_metadata\(\)/i, "expense metadata trigger 缺失");
const itineraryTrigger = sql.match(/create or replace function private\.set_itinerary_override_metadata\(\)([\s\S]*?)\$\$;/i)?.[1] || "";
const expenseTrigger = sql.match(/create or replace function private\.set_expense_metadata\(\)([\s\S]*?)\$\$;/i)?.[1] || "";
assert.match(itineraryTrigger, /new\.revision := old\.revision \+ 1/i, "itinerary revision 未自动递增");
assert.match(itineraryTrigger, /new\.updated_by := \(select auth\.uid\(\)\)/i, "itinerary updated_by 未由数据库设置");
assert.match(itineraryTrigger, /new\.updated_at := now\(\)/i, "itinerary updated_at 未由数据库设置");
assert.match(expenseTrigger, /new\.revision := old\.revision \+ 1/i, "expense revision 未自动递增");
assert.match(expenseTrigger, /new\.created_by is distinct from old\.created_by[\s\S]*raise exception/i, "created_by 可以被修改");
assert.match(expenseTrigger, /new\.updated_by := \(select auth\.uid\(\)\)/i, "expense updated_by 未由数据库设置");
assert.match(expenseTrigger, /new\.updated_at := now\(\)/i, "expense updated_at 未由数据库设置");

assert.match(sql, /alter table public\.travel_itinerary_overrides enable row level security/i, "itinerary 未启用 RLS");
assert.match(sql, /alter table public\.travel_expenses enable row level security/i, "expenses 未启用 RLS");
assert.match(sql, /revoke all on table public\.travel_itinerary_overrides from anon, authenticated/i, "itinerary 默认权限未清空");
assert.match(sql, /revoke all on table public\.travel_expenses from anon, authenticated/i, "expenses 默认权限未清空");
assert.doesNotMatch(sql, /grant [^;]+ on table public\.travel_(?:itinerary_overrides|expenses) to anon/i, "anon 获得新表权限");

const itinerarySelect = policy("Itinerary overrides trip member select");
const itineraryInsert = policy("Itinerary overrides trip member insert");
const itineraryUpdate = policy("Itinerary overrides trip member update");
assert.match(itinerarySelect, /for select[\s\S]*to authenticated[\s\S]*private\.is_trip_member\(trip_id\)/i, "itinerary SELECT policy 错误");
assert.match(itineraryInsert, /for insert[\s\S]*to authenticated[\s\S]*private\.is_trip_member\(trip_id\)[\s\S]*updated_by = \(select auth\.uid\(\)\)/i, "itinerary INSERT policy 错误");
assert.match(itineraryUpdate, /for update[\s\S]*using \(private\.is_trip_member\(trip_id\)\)[\s\S]*with check[\s\S]*updated_by = \(select auth\.uid\(\)\)/i, "itinerary UPDATE policy 错误");
assert.doesNotMatch(sql, /on public\.travel_itinerary_overrides for delete/i, "itinerary 不应允许 DELETE");

const expenseSelect = policy("Expenses trip member select");
const expenseInsert = policy("Expenses trip member insert");
const expenseUpdate = policy("Expenses trip member update");
const expenseDelete = policy("Expenses creator or trip owner delete");
assert.match(expenseSelect, /for select[\s\S]*private\.is_trip_member\(trip_id\)/i, "expense SELECT policy 错误");
assert.match(expenseInsert, /for insert[\s\S]*private\.is_trip_member\(trip_id\)[\s\S]*private\.is_trip_member_user\(trip_id, paid_by_user_id\)[\s\S]*created_by = \(select auth\.uid\(\)\)[\s\S]*updated_by = \(select auth\.uid\(\)\)/i, "expense INSERT policy 错误");
assert.match(expenseUpdate, /for update[\s\S]*private\.is_trip_member_user\(trip_id, paid_by_user_id\)[\s\S]*updated_by = \(select auth\.uid\(\)\)/i, "expense UPDATE policy 错误");
assert.match(expenseDelete, /for delete[\s\S]*created_by = \(select auth\.uid\(\)\)[\s\S]*or private\.is_trip_owner\(trip_id\)/i, "expense DELETE policy 错误");

assert.match(sql, /drop policy if exists "Trip members own membership select"/i, "旧 membership SELECT policy 未移除");
assert.match(policy("Trip members same trip select"), /private\.is_trip_member\(trip_id\)/i, "同行程 membership 不可见");
assert.match(sql, /Realtime switch: OFF for Commit 1/i, "Realtime OFF 开关说明缺失");
assert.doesNotMatch(executableSql, /alter publication supabase_realtime add table/i, "Realtime 被提前启用");

const memberships = new Map([
  ["trip:member-a", "owner"],
  ["trip:member-b", "member"],
  ["other:outsider", "owner"]
]);
const role = (tripId, userId) => userId ? memberships.get(`${tripId}:${userId}`) : undefined;
const isMember = (tripId, userId) => Boolean(role(tripId, userId));
const canRead = (tripId, userId) => isMember(tripId, userId);
const canWriteItinerary = (tripId, userId) => isMember(tripId, userId);
const canInsertExpense = (tripId, userId, paidBy) => isMember(tripId, userId) && isMember(tripId, paidBy);
const canUpdateExpense = (tripId, userId, paidBy) => isMember(tripId, userId) && isMember(tripId, paidBy);
const canDeleteExpense = (row, userId) => isMember(row.tripId, userId) && (row.createdBy === userId || role(row.tripId, userId) === "owner");

for (const userId of [null, "outsider"]) {
  assert.equal(canRead("trip", userId), false, `${userId || "anon"} 可以读取共享数据`);
  assert.equal(canWriteItinerary("trip", userId), false, `${userId || "anon"} 可以写行程`);
  assert.equal(canInsertExpense("trip", userId, "member-a"), false, `${userId || "anon"} 可以写费用`);
}
for (const userId of ["member-a", "member-b"]) {
  assert.equal(canRead("trip", userId), true, `${userId} 不能读取共享数据`);
  assert.equal(canWriteItinerary("trip", userId), true, `${userId} 不能写行程`);
  assert.equal(canInsertExpense("trip", userId, "member-b"), true, `${userId} 不能为同行成员记录费用`);
  assert.equal(canUpdateExpense("trip", userId, "member-a"), true, `${userId} 不能更新共享费用`);
}
assert.equal(canInsertExpense("trip", "member-a", "outsider"), false, "付款人可伪造成非成员");

const originalExpense = { id: "expense-1", tripId: "trip", clientRef: "client-1", createdBy: "member-b", revision: 1, amountMinor: 1000 };
assert.equal(canDeleteExpense(originalExpense, "member-b"), true, "创建者不能删除费用");
assert.equal(canDeleteExpense(originalExpense, "member-a"), true, "Owner 不能删除成员费用");
assert.equal(canDeleteExpense({ ...originalExpense, createdBy: "member-a" }, "member-b"), false, "普通成员可以删除他人费用");

function updateExpense(row, actor, patch, expectedRevision) {
  if (!canUpdateExpense(row.tripId, actor, patch.paidBy || actor)) throw new Error("forbidden");
  if (row.revision !== expectedRevision) throw new Error("conflict");
  if (patch.createdBy && patch.createdBy !== row.createdBy) throw new Error("created_by immutable");
  return { ...row, ...patch, createdBy: row.createdBy, revision: row.revision + 1, updatedBy: actor };
}

assert.throws(() => updateExpense(originalExpense, "member-b", { createdBy: "member-a" }, 1), /created_by immutable/, "created_by 修改未拒绝");
const revisionTwo = updateExpense(originalExpense, "member-a", { paidBy: "member-a", amountMinor: 1200 }, 1);
assert.equal(revisionTwo.revision, 2, "revision 未递增到 2");
assert.throws(() => updateExpense(revisionTwo, "member-b", { paidBy: "member-b", amountMinor: 1300 }, 1), /conflict/, "旧 revision 未产生冲突");
const revisionThree = updateExpense(revisionTwo, "member-b", { paidBy: "member-b", amountMinor: 1300 }, 2);
assert.equal(revisionThree.revision, 3, "最新 revision 更新失败");

console.log("travel command center database contract: ok");
