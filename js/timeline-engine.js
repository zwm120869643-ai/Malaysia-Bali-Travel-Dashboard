(function (root) {
  "use strict";

  function timeLabel(at) {
    const value = new Date(at);
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  function build(context, logic, limit) {
    const intelligence = context.flight?.intelligence;
    const paidDates = new Set((context.expenses || []).filter((item) => item.paymentStatus === "paid" && ["sea", "attractions"].includes(item.category)).map((item) => item.incurredOn));
    const scheduledArrivalAt = intelligence?.arrivalAt ? intelligence.arrivalAt - intelligence.delayMinutes * 60000 : null;
    return logic.travelTimeline(context.itinerary, context.now, 50, intelligence).map((item) => {
      const flightEvent = Boolean(item.dynamic);
      const hotelEvent = item.date === context.accommodation.next?.checkIn && /入住/.test(item.text);
      const paidActivity = paidDates.has(item.date) && !/(arrival|抵达|航班|入住)/i.test(item.text);
      const fixed = flightEvent || hotelEvent || paidActivity;
      let at = item.at;
      if (hotelEvent && context.accommodation.checkInAt) at = context.accommodation.checkInAt;
      else if (!fixed && at && scheduledArrivalAt && item.date === intelligence.date && at >= scheduledArrivalAt) at += intelligence.delayMinutes * 60000;
      return {
        ...item,
        at,
        time: at ? timeLabel(at) : item.time,
        timeLabel: at ? timeLabel(at) : item.timeLabel,
        fixed,
        classification: fixed ? "Fixed Event" : "Flexible Event",
        type: flightEvent ? "flight" : hotelEvent ? "hotel" : paidActivity ? "paid-activity" : "flexible"
      };
    }).filter((item) => item.at === null || item.at >= context.now.getTime()).sort((a, b) => a.date.localeCompare(b.date) || (a.at ?? Infinity) - (b.at ?? Infinity) || a.order - b.order).slice(0, limit || 8);
  }

  function nextAction(context, events, logic) {
    const flight = context.flight;
    const intelligence = flight?.intelligence;
    const now = context.now.getTime();
    const flightSoon = flight && logic.daysBetween(context.date, flight.date) <= 1;
    if (flightSoon && intelligence?.status === "Cancelled") return { type: "航班处置", title: "联系航空公司", reason: "航班已取消", at: null, timeLabel: "立即", location: flight.departureAirport };
    if (flightSoon && intelligence?.status === "Delayed" && now < intelligence.departureAt) return { type: "航班", title: "等待新的登机时间", reason: "航班延误", at: intelligence.departureAt, timeLabel: intelligence.departureTime, location: flight.departureAirport };
    if (flightSoon && intelligence?.departureAt && now < intelligence.departureAt) {
      const minutes = Math.ceil((intelligence.departureAt - now) / 60000);
      return { type: "航班", title: minutes <= 180 ? "前往机场" : "确认机场交通", reason: "航班即将起飞", at: intelligence.departureAt, timeLabel: intelligence.departureTime, location: flight.departureAirport };
    }
    if (flightSoon && intelligence?.status !== "Landed" && intelligence?.arrivalAt && now <= intelligence.arrivalAt) return { type: "航班", title: "关注航班抵达时间", reason: "正在前往下一目的地", at: intelligence.arrivalAt, timeLabel: intelligence.arrivalTime, location: flight.arrivalAirport };
    if (context.accommodation.checkInAt && now < context.accommodation.checkInAt) return { type: "住宿", title: "前往住宿", reason: context.accommodation.advice, at: context.accommodation.checkInAt, timeLabel: context.accommodation.estimatedTime, location: context.accommodation.next?.address || context.nextDestination };
    if (context.nextActivity?.collectionAt && context.nextActivity.collectionAt - now <= 86400000) return { type: "活动", title: "准备装备", reason: "明日出海", at: context.nextActivity.collectionAt, timeLabel: context.nextActivity.collectionTime, location: context.nextActivity.city };
    const next = events.find((item) => item.at === null || item.at >= now);
    if (next) return { type: next.fixed ? "固定事件" : "灵活行程", title: next.text, reason: next.classification, at: next.at, timeLabel: next.timeLabel || "待定", location: context.day?.city };
    if (context.checklist.next) return { type: "Checklist", title: context.checklist.next.title || context.checklist.next.task, reason: "仍有旅行准备事项未完成", at: null, timeLabel: "现在", location: context.location };
    return { type: "旅行状态", title: "确认今日安排", reason: "当前没有更紧急的事件", at: null, timeLabel: "现在", location: context.location };
  }

  function memory(context, logic, limit) {
    const events = [];
    const intelligence = context.flight?.intelligence;
    if (intelligence?.status === "Landed") events.push({ date: context.flight.date, type: "flight", title: `${context.flight.flightNumber} ${context.flight.departureCode}→${context.flight.arrivalCode}`, status: "completed" });
    if (context.accommodation.current) events.push({ date: context.accommodation.current.checkIn, type: "hotel", title: `${context.accommodation.current.nameZh} 入住`, status: "completed" });
    context.itinerary.filter((day) => day.date < context.date && ["confirmed", "changed"].includes(day.status) && !/(航班|住宿|酒店|Airbnb|民宿)/i.test(day.theme)).forEach((day) => events.push({ date: day.date, type: "activity", title: day.theme, status: "completed" }));
    context.expenses.filter((expense) => expense.incurredOn <= context.date).forEach((expense) => events.push({ date: expense.incurredOn, type: "expense", title: expense.title, status: "completed" }));
    return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit || 8).map((event) => ({ ...event, dateLabel: logic.formatDate(event.date, { month: "numeric", day: "numeric" }) }));
  }

  root.TravelTimelineEngine = { build, nextAction, memory };
})(typeof window !== "undefined" ? window : globalThis);
