(function (root) {
  "use strict";

  function generate(context, dayNumber, preparation, location) {
    const hour = context.now.getHours();
    const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    const intelligence = context.flight?.intelligence;
    const landed = intelligence?.status === "Landed";
    const today = [
      { icon: "✈", label: "航班", text: landed ? `已抵达${context.flight?.arrivalCode === "DPS" ? "巴厘岛" : context.nextDestination}` : context.flight ? `${context.flight.flightNumber} · ${intelligence.status}` : "今日无航班" },
      { icon: "🏠", label: "住宿", text: context.accommodation.current ? `已入住 ${context.accommodation.current.nameZh}` : `${context.accommodation.estimatedTime || "下午"}入住 ${context.accommodation.next?.nameZh || "住宿"}` }
    ];
    const tomorrow = preparation ? { icon: "🌊", label: "明日活动", text: preparation.activity.title } : null;
    const advice = location.today.slice(0, 2);
    if (hour >= 18 && preparation) advice.push("晚上准备浮潜装备");
    else if (preparation) advice.push("今晚完成明日活动准备");
    return { title: `${greeting} Day ${dayNumber}`, today, tomorrow, advice };
  }

  root.TravelBriefingEngine = { generate };
})(typeof window !== "undefined" ? window : globalThis);
