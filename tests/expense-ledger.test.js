const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

delete globalThis.DashboardLogic;
vm.runInThisContext(fs.readFileSync("js/logic.js", "utf8"));
const L = globalThis.DashboardLogic;

assert.equal(L.parseExpenseAmount("12"), 1200, "整数金额转换错误");
assert.equal(L.parseExpenseAmount("12.3"), 1230, "一位小数转换错误");
assert.equal(L.parseExpenseAmount("0.01"), 1, "最小金额转换错误");
assert.equal(L.parseExpenseAmount("9999999999.99"), 999999999999, "最大金额转换错误");
for (const invalid of ["", "0", "1.001", "1e2", "-1", "10000000000.00"]) {
  assert.equal(L.parseExpenseAmount(invalid), null, `非法金额被接受: ${invalid}`);
}
assert.equal(L.expenseAmountValue(12850), "128.50", "amount_minor 编辑值错误");
assert.equal(L.formatExpenseAmount(12850, "CNY"), "CNY 128.50", "金额展示错误");

const memberA = "11111111-1111-4111-8111-111111111111";
const memberB = "22222222-2222-4222-8222-222222222222";
const expenses = [
  { createdBy: memberA, amountMinor: 1000, currency: "CNY", paymentStatus: "paid" },
  { createdBy: memberB, amountMinor: 2500, currency: "CNY", paymentStatus: "pending" },
  { createdBy: memberA, amountMinor: 300, currency: "CNY", paymentStatus: "refunded" },
  { createdBy: memberB, amountMinor: 4500, currency: "MYR", paymentStatus: "paid" },
  { createdBy: memberA, amountMinor: 500000, currency: "IDR", paymentStatus: "pending" },
  { createdBy: memberB, amountMinor: 9900, currency: "USD", paymentStatus: "refunded" },
  { amountMinor: -1, currency: "USD", paymentStatus: "paid" },
  { amountMinor: 100, currency: "EUR", paymentStatus: "paid" }
];
const totals = L.expenseLedgerTotals(expenses);
assert.deepEqual(totals, {
  CNY: { paid: 1000, pending: 2500, refunded: 300 },
  MYR: { paid: 4500, pending: 0, refunded: 0 },
  IDR: { paid: 0, pending: 500000, refunded: 0 },
  USD: { paid: 0, pending: 0, refunded: 9900 }
}, "多币种或支付状态汇总错误");
assert.equal(totals.CNY.paid, 1000, "成员B读取时错误过滤了成员A的费用");

const members = [
  { userId: memberA, role: "owner" },
  { userId: memberB, role: "member" }
];
const memberBExpense = { createdBy: memberB };
assert.equal(L.canDeleteExpense(memberBExpense, memberB, members), true, "创建者不能删除自己的费用");
assert.equal(L.canDeleteExpense(memberBExpense, memberA, members), true, "Owner 不能删除成员费用");
assert.equal(L.canDeleteExpense({ createdBy: memberA }, memberB, members), false, "普通成员可以删除他人费用");
assert.equal(L.canDeleteExpense(memberBExpense, "33333333-3333-4333-8333-333333333333", members), false, "非成员可以删除费用");

const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const persisted = app.match(/function persistentState\(value\) \{([\s\S]*?)\n  \}/)?.[1] || "";
const budgetView = app.match(/function renderBudget\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";

assert.match(app, /function renderExpenseLedger\(\) \{[\s\S]*if \(!documentService\.authenticated \|\| !sharedDataService\.configured\) return "";/, "未登录时未保持公共预算模式");
assert.match(app, /createExpense\(\{ clientRef: expenseEdit\.clientRef, \.\.\.payload \}\)/, "新增未复用稳定 client_ref");
assert.match(app, /updateExpense\(expenseEdit\.id, payload, expenseEdit\.revision\)/, "编辑未携带 revision");
assert.match(app, /deleteExpense\(expense\.id, expense\.revision\)/, "删除未携带 revision");
assert.match(app, /canDeleteExpense\(expense, sharedSnapshot\.currentUserId, sharedSnapshot\.members\)/, "删除 UI 未检查创建者或 Owner");
assert.match(app, /\["CONFLICT", "IDEMPOTENCY_CONFLICT"\]/, "费用冲突提示流程缺失");
for (const category of ["flight", "hotel", "transport", "food", "sea", "attractions", "other"]) {
  assert.match(app, new RegExp(`data-expense-category="\\$\\{category\\}"`), `快速分类缺少 ${category}`);
}
for (const name of ["title", "category", "amount", "currency", "incurredOn", "paidByUserId", "splitMode", "paymentStatus", "note"]) {
  assert.match(app, new RegExp(`name="${name}"`), `费用表单缺少字段 ${name}`);
}
assert.doesNotMatch(persisted, /expense|ledger|snapshot|member/i, "共享费用进入 localStorage 白名单");
assert.doesNotMatch(app, /supabase_realtime|\.channel\(/i, "Expense Ledger 提前启用了 Realtime");
assert.match(app, /不自动换汇/, "费用账本未声明禁止自动换汇");
assert.match(budgetView, /<h1>Budget Center<\/h1>/, "预算页未提供清晰的 Budget Center 入口");
assert.ok(budgetView.indexOf("renderExpenseLedger()") < budgetView.indexOf("<h2>预算计划</h2>"), "共享费用账本未置于预算计划之前");
assert.match(worker, /\.\/js\/shared-data\.js/, "共享数据客户端未加入应用壳缓存");
assert.match(worker, /privateRequest[\s\S]*\/rest\/v1\//, "Service Worker 未排除共享费用 API");
assert.match(css, /\.expense-ledger \{[^}]*min-width: 0;/, "费用账本缺少窄屏收缩边界");
assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.expense-form \.field-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/, "430px 费用表单未切换单列");

console.log("shared expense ledger: ok");
