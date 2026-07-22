(function (root) {
  "use strict";

  function generate(context, weather) {
    const activity = context.nextActivity;
    if (!activity?.collectionAt) return null;
    const hoursUntil = (activity.collectionAt - context.now.getTime()) / 3600000;
    const activityEnd = new Date(activity.collectionAt);
    activityEnd.setHours(20, 0, 0, 0);
    if (context.now.getTime() > activityEnd.getTime() || hoursUntil > 36) return null;
    const sea = /佩妮达|浮潜|出海|snorkel|sea/i.test(`${activity.theme} ${(activity.keywords || []).join(" ")}`);
    const preparation = sea ? ["泳衣", "防晒", "防水手机袋", "晕船药", "小额现金"] : ["确认集合地点", "舒适鞋服", "饮用水"];
    const reminders = activity.collectionTime && activity.collectionTime < "08:00" ? ["22:30 前休息", "睡前确认接送与集合地点"] : ["出发前再次确认时间与交通"];
    if (weather?.rainProbability >= 60) reminders.push("准备雨具并确认供应商天气通知");
    return {
      activity: { title: activity.theme, date: activity.date, collectionTime: activity.collectionTime },
      preparation,
      reminders,
      risk: context.activityRisk
    };
  }

  root.TravelPreparationEngine = { generate };
})(typeof window !== "undefined" ? window : globalThis);
