(function (root) {
  "use strict";

  function dateTime(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || "")) return null;
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime();
  }

  function clock(at) {
    const value = new Date(at);
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  function create(input) {
    const data = input.data;
    const logic = input.logic;
    const now = input.now || new Date();
    const itinerary = input.itinerary || data.itinerary || [];
    const flights = input.flights || data.flights || [];
    const hotels = input.hotels || data.hotels || [];
    const date = logic.dateKey(now);
    const trip = logic.tripMoment(data.meta, now);
    const currentDay = logic.currentItinerary(itinerary, now);
    const focusDay = currentDay || (trip.phase === "upcoming" ? itinerary[0] : itinerary.at(-1));
    const watchedFlight = flights.find((flight) => input.flightWatch?.flightNumber === flight.flightNumber && input.flightWatch?.date === flight.date);
    const flight = watchedFlight?.date === date ? watchedFlight : logic.itineraryBoundFlight(itinerary, flights, now);
    const matchingWatch = input.flightWatch?.flightNumber === flight?.flightNumber && input.flightWatch?.date === flight?.date ? input.flightWatch : null;
    const intelligence = logic.flightIntelligence(flight, matchingWatch);
    const nowClock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentAccommodation = hotels.filter((hotel) => {
      if (hotel.status === "cancelled" || hotel.checkIn > date || hotel.checkOut < date) return false;
      const checkout = String(hotel.notes || "").match(/(?:退房[^。；]*?(\d{2}:\d{2})|(\d{2}:\d{2})\s*退房)/)?.slice(1).find(Boolean) || "11:00";
      return !(hotel.checkIn === date && nowClock < "14:00") && !(hotel.checkOut === date && nowClock >= checkout);
    }).sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0] || null;
    const nextAccommodation = hotels.filter((hotel) => hotel.status !== "cancelled" && hotel.checkIn >= date).sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0] || null;
    const accommodationDay = itinerary.find((day) => day.date === nextAccommodation?.checkIn);
    const scheduledCheckInTime = logic.itineraryTimeline(accommodationDay).find((item) => /入住/.test(item.text))?.time || "14:00";
    const scheduledCheckInAt = nextAccommodation ? dateTime(nextAccommodation.checkIn, scheduledCheckInTime) : null;
    const checkInShift = nextAccommodation?.checkIn === flight?.date && intelligence.delayMinutes ? intelligence.delayMinutes + 20 : 0;
    const checkInAt = scheduledCheckInAt === null ? null : scheduledCheckInAt + checkInShift * 60000;
    const estimatedCheckInTime = checkInAt === null ? null : clock(checkInAt);
    const lateCheckIn = checkInAt !== null && (new Date(checkInAt).getHours() >= 22 || new Date(checkInAt).getHours() < 5);

    const activities = itinerary.filter((day) => day.date >= date && !/(航班|返程|住宿|酒店|交通|Airbnb|民宿)/i.test(day.theme)).map((day) => {
      const collectionTime = logic.itineraryTimeline(day).find((item) => item.time)?.time || null;
      return { ...day, collectionTime, collectionAt: collectionTime ? dateTime(day.date, collectionTime) : null };
    });
    const nextActivity = activities[0] || null;
    const gapHours = nextActivity?.collectionAt && intelligence.arrivalAt ? Math.max(0, (nextActivity.collectionAt - intelligence.arrivalAt) / 3600000) : null;
    let activityRisk = { type: "activity", level: "green", label: "绿色", title: "活动正常", detail: "当前活动与交通安排没有冲突", gapHours };
    if (nextActivity && (intelligence.delayMinutes >= 180 || gapHours !== null && gapHours < 8)) activityRisk = { type: "activity", level: "red", label: "红色", title: "活动存在冲突，需要确认", detail: "休息时间不足，建议确认活动安排。", gapHours };
    else if (nextActivity && (intelligence.delayMinutes >= 120 || gapHours !== null && gapHours < 12)) activityRisk = { type: "activity", level: "yellow", label: "黄色", title: "建议早点休息", detail: "行程仍可执行，但抵达后应尽快入住休息。", gapHours };
    else if (nextActivity && gapHours !== null) activityRisk.detail = `间隔约${Math.round(gapHours)}小时，可执行。`;

    const checklistItems = input.checklistItems || [];
    const completedTasks = input.completedTasks || {};
    const checklist = {
      ...logic.checklistProgress(checklistItems, completedTasks),
      next: checklistItems.find((item) => !(completedTasks[item.id] ?? item.completed)) || null
    };
    const departureAt = intelligence.departureAt;
    const arrivalAt = intelligence.arrivalAt;
    let mode = "Activity Mode";
    const flightSoon = flight && logic.daysBetween(date, flight.date) <= 1;
    if (flightSoon && departureAt && now.getTime() < departureAt) mode = "Departure Mode";
    else if (flightSoon && departureAt && arrivalAt && now.getTime() <= arrivalAt) mode = "Transit Mode";
    else if (arrivalAt && checkInAt && now.getTime() < checkInAt) mode = "Arrival Mode";

    const routeParts = String(focusDay?.city || "当前地点").split(/\s*(?:→|->)\s*/);
    const location = flightSoon && departureAt && now.getTime() < departureAt ? routeParts[0] : flightSoon && departureAt && arrivalAt && now.getTime() <= arrivalAt ? `${flight.departureCode} → ${flight.arrivalCode}` : routeParts.at(-1);
    const risks = [activityRisk];
    if (["medium", "high", "critical"].includes(intelligence.impactLevel)) risks.unshift({ type: "flight", level: intelligence.impactLevel, label: intelligence.impactLabel, title: "航班延误影响", detail: intelligence.detail });

    return {
      date,
      now,
      location,
      nextDestination: flight?.arrivalCode || nextActivity?.city || null,
      phase: trip.phase,
      phaseLabel: trip.label,
      mode,
      day: focusDay,
      itinerary,
      flight: flight ? { ...flight, intelligence } : null,
      upcomingFlights: logic.activeFlights(flights, now),
      accommodation: {
        current: currentAccommodation,
        next: nextAccommodation,
        scheduledTime: scheduledCheckInTime,
        estimatedTime: estimatedCheckInTime,
        checkInAt,
        status: currentAccommodation ? "已入住" : nextAccommodation ? "待入住" : "无后续住宿",
        advice: lateCheckIn ? "建议联系住宿确认晚入住" : "按调整后时间前往住宿"
      },
      activities,
      nextActivity,
      risks,
      activityRisk,
      checklist,
      expenses: input.expenses || []
    };
  }

  root.TravelContext = { create };
})(typeof window !== "undefined" ? window : globalThis);
