(function (root) {
  "use strict";

  function generate(context, timeline, weather) {
    const hour = context.now.getHours();
    const nextAt = timeline.find((item) => item.at && item.at > context.now.getTime())?.at;
    const freeMinutes = nextAt ? Math.max(0, Math.round((nextAt - context.now.getTime()) / 60000)) : null;
    const arrival = context.mode === "Arrival Mode" || context.flight?.intelligence?.status === "Landed";
    const nearby = [
      { type: "餐饮", suggestion: arrival || hour >= 18 ? "住宿附近晚餐" : "附近简餐" },
      { type: "便利店", suggestion: "补充饮水和旅行用品" },
      { type: "换钱", suggestion: "仅使用正规换汇点" },
      { type: "交通", suggestion: "优先使用官方出租车或 Grab" },
      { type: "景点", suggestion: arrival ? "今天不安排远距离景点" : freeMinutes !== null && freeMinutes < 180 ? "只选附近短途地点" : "按今日行程选择" }
    ];
    const today = arrival ? ["附近晚餐", "附近散步", "休息"] : hour >= 18 ? ["附近晚餐", "补充明日用品", "早点休息"] : freeMinutes !== null && freeMinutes < 180 ? ["附近简餐", "短距离散步", "按时返回"] : ["按今日行程活动", "预留交通时间"];
    if (weather?.rainProbability >= 60) today.unshift("优先室内或近距离安排");
    return { location: context.location, freeMinutes, nearby, today };
  }

  root.TravelLocationContext = { generate };
})(typeof window !== "undefined" ? window : globalThis);
