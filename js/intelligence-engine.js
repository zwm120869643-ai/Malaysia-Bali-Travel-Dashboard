(function (root) {
  "use strict";

  function weather(context, forecast) {
    const activity = context.nextActivity;
    if (!activity) return { level: "neutral", label: "暂无活动", score: null, reason: "没有需要评估的后续活动", advice: "按当前行程执行" };
    if (!forecast || !Number.isFinite(Number(forecast.rainProbability))) return { level: "neutral", label: "天气待确认", score: null, reason: `${activity.theme} 暂无可用天气数据`, advice: "出发前确认天气与供应商通知" };
    const rain = Number(forecast.rainProbability);
    const sea = /佩妮达|浮潜|出海|snorkel|sea/i.test(`${activity.theme} ${(activity.keywords || []).join(" ")}`);
    if (sea && rain >= 70) return { level: "red", label: "适合度低", score: 35, reason: `${activity.theme} 预计降雨${rain}%`, advice: "确认海况、船班和取消政策" };
    if (rain >= 40 || sea && forecast.seaCondition === "TBD") return { level: "yellow", label: "谨慎可行", score: 65, reason: `${activity.theme} 预计降雨${rain}%${sea ? "，海况待确认" : ""}`, advice: sea ? "准备雨具并在出发前确认海况" : "优先安排可随时避雨的活动" };
    return { level: "green", label: "适合进行", score: 90, reason: `${activity.theme} 预计降雨${rain}%`, advice: sea ? "按计划准备防晒、防水与晕船用品" : "按计划执行并注意补水" };
  }

  function recommendation(context, location, preparation, weatherStatus) {
    const intelligence = context.flight?.intelligence;
    if (intelligence?.status === "Delayed") return { title: "保持后续安排弹性", reason: `航班延误${intelligence.delayMinutes || "待定"}分钟`, action: "以最新登机时间为准，暂不追加远距离安排" };
    if (context.mode === "Arrival Mode") return { title: "先完成抵达流程", reason: "入境、行李和前往住宿仍未完成", action: `${context.arrival.estimatedAccommodationTime || "稍后"}前往住宿，今晚只安排附近活动` };
    if (weatherStatus.level === "red") return { title: "先确认活动供应商", reason: weatherStatus.reason, action: weatherStatus.advice };
    if (preparation) return { title: "今晚完成明日准备", reason: `${preparation.activity.title} ${preparation.activity.collectionTime}集合`, action: preparation.reminders[0] };
    if (location.freeMinutes !== null && location.freeMinutes < 180) return { title: "留在当前位置附近", reason: `距离下一事件约${location.freeMinutes}分钟`, action: location.today[0] };
    return { title: "按当前节奏执行", reason: `当前为 ${context.mode}`, action: location.today[0] || "预留交通和休息时间" };
  }

  function health(context, timeline, weatherStatus) {
    let score = 100;
    const reasons = [];
    const advice = [];
    const delay = context.flight?.intelligence?.delayMinutes || 0;
    if (delay >= 180) { score -= 25; reasons.push(`航班延误${delay}分钟`); advice.push("压缩非固定安排并确认接送"); }
    else if (delay >= 60) { score -= 15; reasons.push(`航班延误${delay}分钟`); advice.push("保留抵达和入住缓冲"); }
    else if (delay > 0) { score -= 5; reasons.push(`航班轻微延误${delay}分钟`); }
    else reasons.push("航班时间稳定");
    const density = Object.values(context.day?.periods || {}).flat().length;
    if (density >= 8) { score -= 12; reasons.push(`今日${density}项安排，密度较高`); advice.push("删除一个非必要活动"); }
    else reasons.push(`今日${density}项安排，密度可控`);
    const rest = context.activityRisk?.gapHours;
    if (Number.isFinite(rest) && rest < 8) { score -= 25; reasons.push(`活动前仅约${Math.round(rest)}小时`); advice.push("确认活动并优先休息"); }
    else if (Number.isFinite(rest) && rest < 12) { score -= 12; reasons.push(`活动前约${Math.round(rest)}小时`); advice.push("今晚提前休息"); }
    else if (Number.isFinite(rest)) reasons.push(`活动前约${Math.round(rest)}小时，可休息`);
    if (context.checklist.percent < 50) { score -= 10; reasons.push(`准备完成度${context.checklist.percent}%`); advice.push("优先完成关键准备项"); }
    else reasons.push(`准备完成度${context.checklist.percent}%`);
    if (weatherStatus.level === "red") { score -= 15; reasons.push("天气不利于主要活动"); }
    else if (weatherStatus.level === "yellow") { score -= 7; reasons.push("活动天气需复核"); }
    score = Math.max(0, Math.min(100, score));
    return { score, label: score >= 80 ? "状态良好" : score >= 60 ? "需要留意" : "需要调整", reasons, advice: advice.length ? advice : ["保持当前节奏，继续关注实时状态"], timelineCount: timeline.length };
  }

  function previousDate(date) {
    const [year, month, day] = date.split("-").map(Number);
    const value = new Date(year, month - 1, day - 1);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  function expenseInsight(expenses, date) {
    const valid = (expenses || []).filter((item) => Number.isSafeInteger(item.amountMinor) && item.amountMinor > 0 && item.paymentStatus !== "refunded");
    const yesterday = previousDate(date);
    const currencies = [...new Set(valid.map((item) => item.currency))];
    const byCurrency = currencies.map((currency) => {
      const today = valid.filter((item) => item.currency === currency && item.incurredOn === date).reduce((sum, item) => sum + item.amountMinor, 0);
      const previous = valid.filter((item) => item.currency === currency && item.incurredOn === yesterday).reduce((sum, item) => sum + item.amountMinor, 0);
      return { currency, today, previous, direction: today > previous ? "up" : today < previous ? "down" : "flat" };
    }).filter((item) => item.today || item.previous);
    const counts = valid.reduce((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + 1 }), {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { entries: valid.length, byCurrency, topCategory, summary: byCurrency.length ? "按币种比较今日与昨日，不进行换汇" : "暂无可分析的费用记录" };
  }

  function dailySummary(context, memory, healthStatus, expenses) {
    const intelligence = context.flight?.intelligence;
    const completed = memory.filter((item) => item.date === context.date);
    const lead = intelligence?.status === "Landed" ? `已完成 ${context.flight.flightNumber} 抵达${context.flight.arrivalCode}` : intelligence?.status === "Delayed" ? `${context.flight.flightNumber} 延误${intelligence.delayMinutes || "待定"}分钟` : `${context.mode} 按当前计划进行`;
    const expenseCount = (expenses || []).filter((item) => item.incurredOn === context.date).length;
    return { title: `${context.date} 旅行总结`, summary: `${lead}；旅行状态${healthStatus.score}分。`, highlights: [...completed.map((item) => `完成 ${item.title}`), ...(expenseCount ? [`记录 ${expenseCount} 笔费用`] : []), `下一步：${context.nextActivity?.theme || "按当前安排休息"}`] };
  }

  function evaluate(input) {
    const weatherStatus = weather(input.context, input.weather);
    const recommendationStatus = recommendation(input.context, input.location, input.preparation, weatherStatus);
    const healthStatus = health(input.context, input.timeline, weatherStatus);
    const expenses = expenseInsight(input.expenses, input.context.date);
    const memory = dailySummary(input.context, input.memory, healthStatus, input.expenses);
    return { weather: weatherStatus, recommendation: recommendationStatus, health: healthStatus, expenses, memory };
  }

  root.TravelIntelligence = { weather, recommendation, health, expenseInsight, dailySummary, evaluate };
})(typeof window !== "undefined" ? window : globalThis);
