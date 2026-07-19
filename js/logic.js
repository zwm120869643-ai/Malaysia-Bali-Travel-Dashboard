(function (root) {
  "use strict";

  const DAY_MS = 86400000;
  const priorityWeight = { high: 0, medium: 1, low: 2 };

  function parseISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function daysBetween(from, to) {
    const a = typeof from === "string" ? parseISODate(from) : from;
    const b = typeof to === "string" ? parseISODate(to) : to;
    if (!a || !b) return null;
    const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((bUtc - aUtc) / DAY_MS);
  }

  function formatDate(value, options) {
    const date = parseISODate(value);
    if (!date) return "TBD";
    return new Intl.DateTimeFormat("zh-CN", options || { month: "long", day: "numeric", weekday: "short" }).format(date);
  }

  function tripMoment(meta, now) {
    const today = dateKey(now || new Date());
    const before = daysBetween(today, meta.startDate);
    const after = daysBetween(meta.endDate, today);
    if (before > 0) return { phase: "upcoming", value: before, label: `距出发还有 ${before} 天` };
    if (after > 0) return { phase: "finished", value: after, label: `旅行结束 ${after} 天` };
    const day = daysBetween(meta.startDate, today) + 1;
    return { phase: "traveling", value: day, label: `旅行第 ${day} 天` };
  }

  function currentItinerary(itinerary, now) {
    const today = dateKey(now || new Date());
    return itinerary.find((day) => day.date === today) || null;
  }

  function urgentTasks(tasks, completionMap, limit) {
    return tasks
      .filter((task) => !(completionMap[task.id] ?? task.completed))
      .sort((a, b) => {
        const dueA = parseISODate(a.dueAt)?.getTime() ?? Infinity;
        const dueB = parseISODate(b.dueAt)?.getTime() ?? Infinity;
        return dueA - dueB || (priorityWeight[a.priority] ?? 9) - (priorityWeight[b.priority] ?? 9);
      })
      .slice(0, limit || 3);
  }

  function transferBuffer(arrivalDate, arrivalTime, departureDate, departureTime) {
    if (![arrivalDate, departureDate].every((v) => parseISODate(v)) || !/^\d{2}:\d{2}$/.test(arrivalTime || "") || !/^\d{2}:\d{2}$/.test(departureTime || "")) return null;
    const start = parseISODate(arrivalDate);
    const end = parseISODate(departureDate);
    const [ah, am] = arrivalTime.split(":").map(Number);
    const [dh, dm] = departureTime.split(":").map(Number);
    start.setHours(ah, am, 0, 0);
    end.setHours(dh, dm, 0, 0);
    return Math.round((end - start) / 60000);
  }

  function checklistProgress(items, completionMap) {
    if (!items.length) return { completed: 0, total: 0, percent: 0 };
    const completed = items.filter((item) => completionMap[item.id] ?? item.completed).length;
    return { completed, total: items.length, percent: Math.round((completed / items.length) * 100) };
  }

  function budgetTotals(items, overrides) {
    return items.reduce((totals, item) => {
      const local = overrides[item.id] || {};
      const planned = Number(local.plannedAmount ?? item.plannedAmount);
      const actual = Number(local.actualAmount ?? item.actualAmount);
      const paid = local.paid ?? item.paid;
      if (Number.isFinite(planned)) totals.planned += planned;
      if (Number.isFinite(actual)) totals.actual += actual;
      if (paid && Number.isFinite(actual)) totals.paid += actual;
      if (!paid && Number.isFinite(planned)) totals.unpaid += planned;
      const payer = local.payer ?? item.payer;
      if (payer === "我" && Number.isFinite(actual)) totals.me += actual;
      if (payer === "女朋友" && Number.isFinite(actual)) totals.partner += actual;
      return totals;
    }, { planned: 0, actual: 0, paid: 0, unpaid: 0, me: 0, partner: 0 });
  }

  root.DashboardLogic = { parseISODate, dateKey, daysBetween, formatDate, tripMoment, currentItinerary, urgentTasks, transferBuffer, checklistProgress, budgetTotals };
})(typeof window !== "undefined" ? window : globalThis);
