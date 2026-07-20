(function (root) {
  "use strict";

  const DAY_MS = 86400000;
  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const itineraryPeriods = ["morning", "noon", "afternoon", "evening"];
  const expenseCurrencies = ["CNY", "MYR", "IDR", "USD"];
  const expenseStatuses = ["paid", "pending", "refunded"];

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

  function inboxCounts(items) {
    return {
      pending: items.filter((item) => item.status === "incoming" || item.status === "processing").length,
      verified: items.filter((item) => item.status === "verified" || item.status === "archived").length
    };
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

  function itineraryDraft(baseDay, override, baseVersion) {
    const source = override || {};
    const periods = {};
    itineraryPeriods.forEach((period) => {
      const items = override
        ? source.periods?.[period] || []
        : (baseDay.periods?.[period] || []).map((text, index) => ({
          id: `base-${baseDay.id}-${period}-${index + 1}`,
          time: null,
          text,
          order: (index + 1) * 10,
          status: "planned"
        }));
      periods[period] = items.map((item) => ({ ...item }));
    });
    return {
      dayId: source.dayId || baseDay.id,
      baseVersion: source.baseVersion || baseVersion,
      travelDate: source.travelDate || baseDay.date,
      city: source.city || baseDay.city,
      theme: source.theme || baseDay.theme,
      transport: source.transport ?? baseDay.transport,
      periods,
      notes: [...(source.notes || baseDay.notes || [])],
      maps: (source.maps || baseDay.maps || []).map((item) => ({ ...item })),
      status: source.status || "changed"
    };
  }

  function mergeItineraryDay(baseDay, override) {
    if (!override) return baseDay;
    const periods = {};
    itineraryPeriods.forEach((period) => {
      periods[period] = [...(override.periods?.[period] || [])]
        .sort((a, b) => a.order - b.order)
        .filter((item) => item.status !== "cancelled")
        .map((item) => item.time ? `${item.time} ${item.text}` : item.text);
    });
    return {
      ...baseDay,
      date: override.travelDate,
      city: override.city,
      theme: override.theme,
      transport: override.transport,
      periods,
      notes: [...override.notes],
      maps: override.maps.map((item) => ({ ...item })),
      status: override.status,
      overrideRevision: override.revision
    };
  }

  function mergeItinerary(baseItinerary, overrides) {
    if (!Array.isArray(overrides) || !overrides.length) return baseItinerary;
    const byDay = new Map(overrides.map((override) => [override.dayId, override]));
    return baseItinerary.map((day) => mergeItineraryDay(day, byDay.get(day.id)));
  }

  function withItineraryPeriod(draft, period, change) {
    if (!itineraryPeriods.includes(period)) return draft;
    return { ...draft, periods: { ...draft.periods, [period]: change(draft.periods[period] || []) } };
  }

  function addItineraryActivity(draft, period, id) {
    return withItineraryPeriod(draft, period, (items) => {
      const order = Math.min(9990, Math.max(0, ...items.map((item) => item.order || 0)) + 10);
      return [...items, { id, time: null, text: "", order, status: "planned" }];
    });
  }

  function updateItineraryActivity(draft, period, id, field, value) {
    if (!["time", "text"].includes(field)) return draft;
    return withItineraryPeriod(draft, period, (items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function cancelItineraryActivity(draft, period, id) {
    return withItineraryPeriod(draft, period, (items) => items.map((item) => item.id === id ? { ...item, status: "cancelled" } : item));
  }

  function moveItineraryActivity(draft, period, id, direction) {
    return withItineraryPeriod(draft, period, (items) => {
      const active = items.filter((item) => item.status !== "cancelled").sort((a, b) => a.order - b.order);
      const from = active.findIndex((item) => item.id === id);
      const to = from + (direction === "up" ? -1 : direction === "down" ? 1 : 0);
      if (from < 0 || to < 0 || to >= active.length || to === from) return items;
      [active[from], active[to]] = [active[to], active[from]];
      const orderById = new Map(active.map((item, index) => [item.id, (index + 1) * 10]));
      return items.map((item) => orderById.has(item.id) ? { ...item, order: orderById.get(item.id) } : item);
    });
  }

  function itineraryTimeline(day) {
    return itineraryPeriods.flatMap((period) => (day?.periods?.[period] || []).map((value, index) => {
      const raw = String(value || "").trim();
      const match = raw.match(/^(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?\s+/);
      return {
        id: `${period}-${index}`,
        period,
        time: match?.[1] || null,
        timeLabel: match ? `${match[1]}${match[2] ? `-${match[2]}` : ""}` : null,
        text: match ? raw.slice(match[0].length) : raw
      };
    })).filter((item) => item.text);
  }

  function nextItineraryEvent(day, now) {
    const items = itineraryTimeline(day);
    if (!items.length) return null;
    const reference = now || new Date();
    if (dateKey(reference) !== day?.date) return items[0];
    const timed = items.filter((item) => item.time);
    if (!timed.length) return items[0];
    const currentMinutes = reference.getHours() * 60 + reference.getMinutes();
    return timed.find((item) => {
      const [hour, minute] = item.time.split(":").map(Number);
      return hour * 60 + minute >= currentMinutes;
    }) || null;
  }

  function parseExpenseAmount(value) {
    const text = String(value ?? "").trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) return null;
    const [whole, fraction = ""] = text.split(".");
    const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return Number.isSafeInteger(amount) && amount >= 1 && amount <= 999999999999 ? amount : null;
  }

  function expenseAmountValue(amountMinor) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return "";
    return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`;
  }

  function formatExpenseAmount(amountMinor, currency) {
    const value = expenseAmountValue(amountMinor);
    if (!value || !expenseCurrencies.includes(currency)) return "TBD";
    return `${currency} ${new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`;
  }

  function expenseLedgerTotals(expenses) {
    const totals = Object.fromEntries(expenseCurrencies.map((currency) => [currency, { paid: 0, pending: 0, refunded: 0 }]));
    (expenses || []).forEach((expense) => {
      if (!expenseCurrencies.includes(expense.currency) || !expenseStatuses.includes(expense.paymentStatus) || !Number.isSafeInteger(expense.amountMinor) || expense.amountMinor < 1 || expense.amountMinor > 999999999999) return;
      totals[expense.currency][expense.paymentStatus] += expense.amountMinor;
    });
    return totals;
  }

  function canDeleteExpense(expense, currentUserId, members) {
    const role = (members || []).find((member) => member.userId === currentUserId)?.role;
    return Boolean(role && (expense?.createdBy === currentUserId || role === "owner"));
  }

  root.DashboardLogic = { parseISODate, dateKey, daysBetween, formatDate, tripMoment, currentItinerary, urgentTasks, transferBuffer, checklistProgress, inboxCounts, budgetTotals, itineraryDraft, mergeItineraryDay, mergeItinerary, addItineraryActivity, updateItineraryActivity, cancelItineraryActivity, moveItineraryActivity, itineraryTimeline, nextItineraryEvent, parseExpenseAmount, expenseAmountValue, formatExpenseAmount, expenseLedgerTotals, canDeleteExpense };
})(typeof window !== "undefined" ? window : globalThis);
