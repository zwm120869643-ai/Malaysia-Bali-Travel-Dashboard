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

  function travelDateTime(date, time) {
    const value = parseISODate(date);
    if (!value || !/^\d{2}:\d{2}$/.test(time || "")) return null;
    const [hour, minute] = time.split(":").map(Number);
    value.setHours(hour, minute, 0, 0);
    return value;
  }

  function activeFlights(flights, now) {
    const reference = now || new Date();
    return (flights || [])
      .filter((flight) => flight.status !== "cancelled" && !["取消", "已完成"].includes(flight.actualStatus))
      .map((flight) => ({ flight, departure: travelDateTime(flight.date, flight.departureTime), arrival: travelDateTime(flight.date, flight.arrivalTime) }))
      .filter((item) => item.departure && item.arrival && item.arrival >= reference)
      .sort((a, b) => a.departure - b.departure)
      .map((item) => item.flight);
  }

  function nextActiveFlight(flights, now) {
    return activeFlights(flights, now)[0] || null;
  }

  function flightStatusLabel(watch, flight) {
    if (/boarding/i.test(watch?.statusDetail || "")) return "Boarding";
    if (watch?.status === "cancelled" || flight?.status === "cancelled" || flight?.actualStatus === "取消") return "Cancelled";
    if (watch?.status === "arrived" || ["已抵达", "已完成"].includes(flight?.actualStatus)) return "Landed";
    if (watch?.status === "en_route" || ["已起飞", "飞行中"].includes(flight?.actualStatus)) return "Departed";
    if (watch?.status === "delayed" || flight?.actualStatus === "延误") return "Delayed";
    return "Scheduled";
  }

  function nextTravelAction(day, flights, hotels, now, expenses) {
    const reference = now || new Date();
    const flight = nextActiveFlight(flights, reference);
    if (flight && daysBetween(dateKey(reference), flight.date) <= 1) {
      const departure = travelDateTime(flight.date, flight.departureTime);
      return {
        type: "航班",
        id: flight.id,
        at: departure?.getTime() ?? null,
        timeLabel: `${formatDate(flight.date, { month: "numeric", day: "numeric" })} ${flight.departureTime}`,
        title: `${flight.flightNumber} · ${flight.departureTime} → ${flight.arrivalTime}`,
        location: `${flight.departureAirport} → ${flight.arrivalAirport}`
      };
    }
    const hotelAction = (hotels || []).filter((hotel) => hotel.status !== "cancelled").flatMap((hotel) => {
      const noteTime = String(hotel.notes || "").match(/(?:退房[^。；]*?(\d{2}:\d{2})|(\d{2}:\d{2})\s*退房)/)?.slice(1).find(Boolean);
      return [
        { type: "退房", date: hotel.checkOut, time: noteTime || "11:00", title: `退房 · ${hotel.nameZh || hotel.name}` },
        { type: "入住", date: hotel.checkIn, time: "15:00", title: `入住 · ${hotel.nameZh || hotel.name}` }
      ].map((action) => ({ ...action, id: `${hotel.id}-${action.type}`, at: travelDateTime(action.date, action.time), location: hotel.address || day?.city }));
    }).filter((action) => action.at && action.at >= reference).sort((a, b) => a.at - b.at)[0];
    if (hotelAction && daysBetween(dateKey(reference), hotelAction.date) <= 1) return { ...hotelAction, at: hotelAction.at.getTime(), timeLabel: `${formatDate(hotelAction.date, { month: "numeric", day: "numeric" })} ${hotelAction.time}` };
    const transport = String(day?.transport || "").trim();
    if (transport) return { type: "交通", id: "transport", timeLabel: transport.match(/\b\d{2}:\d{2}\b/)?.[0] || "待定", title: transport, location: day.city };
    const paidActivity = (expenses || []).filter((item) => item.paymentStatus === "paid" && ["sea", "attractions"].includes(item.category) && item.incurredOn >= dateKey(reference)).sort((a, b) => a.incurredOn.localeCompare(b.incurredOn))[0];
    if (paidActivity) return { type: "已付款活动", id: paidActivity.id, timeLabel: formatDate(paidActivity.incurredOn, { month: "numeric", day: "numeric" }), title: paidActivity.title, location: day?.city };
    const itinerary = nextItineraryEvent(day, reference);
    return itinerary ? { ...itinerary, type: "行程", at: travelDateTime(day.date, itinerary.time)?.getTime() ?? null, title: itinerary.text, location: day.city } : null;
  }

  function travelCountdown(target, now) {
    if (target === null || target === "") return "时间待确认";
    const at = Number(target);
    if (!Number.isFinite(at)) return "时间待确认";
    const minutes = Math.max(0, Math.ceil((at - (now || new Date()).getTime()) / 60000));
    if (!minutes) return "现在";
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const remaining = minutes % 60;
    if (days) return `${days}天${hours ? `${hours}小时` : ""}`;
    if (hours) return `${hours}小时${remaining ? `${remaining}分` : ""}`;
    return `${remaining}分`;
  }

  function flightWatchTarget(flight) {
    if (!flight || ["arrived", "cancelled"].includes(flight.status)) return null;
    return flight.status === "en_route" ? flight.arrival?.estimatedAt || null : flight.departure?.estimatedAt || null;
  }

  function flightDepartureAdvice(flight, now) {
    if (!flight) return "实时查询不可用，请按手动状态和机场通知出发";
    if (flight.status === "cancelled") return "航班已取消，请联系航空公司确认后续安排";
    if (flight.status === "arrived") return "航班已抵达，无需出发提醒";
    if (flight.status === "en_route") return "航班飞行中，请关注预计抵达时间";
    if (flight.status === "delayed") return "航班延误，仍建议按原计划前往机场并关注柜台通知";
    const target = flightWatchTarget(flight);
    if (!target) return "预计时间待确认，建议按原计划前往机场";
    const minutes = Math.ceil((Date.parse(target) - (now || new Date()).getTime()) / 60000);
    return minutes <= 180 ? "距离起飞不足3小时，建议立即前往机场" : "建议预计起飞前3小时抵达机场";
  }

  function travelTimeline(itinerary, now, limit) {
    const reference = now || new Date();
    const today = dateKey(reference);
    const count = Number.isSafeInteger(limit) && limit >= 0 ? limit : 8;
    return (itinerary || [])
      .flatMap((day) => itineraryTimeline(day).map((item, order) => ({
        ...item,
        dayId: day.id,
        date: day.date,
        dateLabel: formatDate(day.date, { month: "numeric", day: "numeric" }),
        at: travelDateTime(day.date, item.time)?.getTime() ?? null,
        order
      })))
      .filter((item) => item.date > today || (item.date === today && (item.at === null || item.at >= reference.getTime())))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.at ?? Infinity) - (b.at ?? Infinity) || a.order - b.order)
      .slice(0, count);
  }

  function recentSharedChanges(itineraryOverrides, expenses, limit) {
    const count = Number.isSafeInteger(limit) && limit >= 0 ? limit : 3;
    return [
      ...(itineraryOverrides || []).map((item) => ({ type: "行程", title: item.theme, updatedAt: item.updatedAt })),
      ...(expenses || []).map((item) => ({ type: "费用", title: item.title, updatedAt: item.updatedAt }))
    ]
      .filter((item) => item.title && Number.isFinite(Date.parse(item.updatedAt)))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, count);
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

  root.DashboardLogic = { parseISODate, dateKey, daysBetween, formatDate, tripMoment, currentItinerary, urgentTasks, transferBuffer, checklistProgress, inboxCounts, budgetTotals, itineraryDraft, mergeItineraryDay, mergeItinerary, addItineraryActivity, updateItineraryActivity, cancelItineraryActivity, moveItineraryActivity, itineraryTimeline, nextItineraryEvent, activeFlights, nextActiveFlight, flightStatusLabel, nextTravelAction, travelCountdown, flightWatchTarget, flightDepartureAdvice, travelTimeline, recentSharedChanges, parseExpenseAmount, expenseAmountValue, formatExpenseAmount, expenseLedgerTotals, canDeleteExpense };
})(typeof window !== "undefined" ? window : globalThis);
