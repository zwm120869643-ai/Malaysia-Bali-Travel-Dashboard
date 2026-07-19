(function () {
  "use strict";

  const DATA = window.TRIP_DATA;
  const L = window.DashboardLogic;
  const STORAGE_KEY = "malaysia-bali-dashboard-overrides-v1";
  const SYNC_DEVICE_KEY = "malaysia-bali-sync-device-v1";
  const ASSIGNEES = ["我", "女朋友", "共同完成"];
  const STATUSES = ["pending", "confirmed", "changed", "cancelled"];
  const ACTUAL_FLIGHT_STATUSES = ["等待确认", "正常", "延误", "取消", "已完成"];
  const labels = { pending: "待确认", confirmed: "已确认", changed: "有变更", cancelled: "已取消", high: "高", medium: "中", low: "低" };

  const emptyState = () => ({
    baseVersion: DATA.meta.version,
    updatedAt: null,
    lastSyncedAt: null,
    syncUserName: "",
    completedTasks: {},
    pendingChecklistSync: {},
    assignees: {},
    budget: {},
    flights: {},
    hotels: {},
    notes: { temporary: "", today: "" }
  });

  function isRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeState(raw) {
    const clean = emptyState();
    if (!isRecord(raw)) return clean;
    if (typeof raw.baseVersion === "string") clean.baseVersion = raw.baseVersion.slice(0, 30);
    if (typeof raw.updatedAt === "string") clean.updatedAt = raw.updatedAt.slice(0, 40);
    if (typeof raw.lastSyncedAt === "string") clean.lastSyncedAt = raw.lastSyncedAt.slice(0, 40);
    if (typeof raw.syncUserName === "string") clean.syncUserName = raw.syncUserName.trim().slice(0, 64);

    const checklistIds = new Set(allChecklistItems().map((item) => item.id));
    if (isRecord(raw.completedTasks)) Object.entries(raw.completedTasks).forEach(([id, value]) => {
      if (checklistIds.has(id) && typeof value === "boolean") clean.completedTasks[id] = value;
    });
    if (isRecord(raw.pendingChecklistSync)) Object.entries(raw.pendingChecklistSync).forEach(([id, value]) => {
      if (!checklistIds.has(id) || !isRecord(value) || typeof value.completed !== "boolean" || typeof value.taskName !== "string") return;
      clean.pendingChecklistSync[id] = {
        taskId: id,
        taskName: value.taskName.slice(0, 160),
        completed: value.completed,
        completedBy: typeof value.completedBy === "string" ? value.completedBy.slice(0, 64) : "shared-device"
      };
    });
    if (isRecord(raw.assignees)) Object.entries(raw.assignees).forEach(([id, value]) => {
      if (checklistIds.has(id) && ASSIGNEES.includes(value)) clean.assignees[id] = value;
    });

    if (isRecord(raw.budget)) DATA.budget.forEach((item) => {
      const value = raw.budget[item.id];
      if (!isRecord(value)) return;
      clean.budget[item.id] = {};
      if (["CNY", "MYR", "IDR", "USD"].includes(value.currency)) clean.budget[item.id].currency = value.currency;
      if (["我", "女朋友", "共同", "分别"].includes(value.payer)) clean.budget[item.id].payer = value.payer;
      if (typeof value.paid === "boolean") clean.budget[item.id].paid = value.paid;
      if (value.actualAmount === "" || (Number.isFinite(Number(value.actualAmount)) && Number(value.actualAmount) >= 0)) clean.budget[item.id].actualAmount = String(value.actualAmount);
    });

    if (isRecord(raw.flights)) DATA.flights.forEach((item) => {
      const value = raw.flights[item.id];
      if (!isRecord(value)) return;
      clean.flights[item.id] = {};
      if (STATUSES.includes(value.status)) clean.flights[item.id].status = value.status;
      if (ACTUAL_FLIGHT_STATUSES.includes(value.actualStatus)) clean.flights[item.id].actualStatus = value.actualStatus;
    });
    if (isRecord(raw.hotels)) DATA.hotels.forEach((item) => {
      const value = raw.hotels[item.id];
      if (isRecord(value) && STATUSES.includes(value.status)) clean.hotels[item.id] = { status: value.status };
    });
    if (isRecord(raw.notes)) {
      if (typeof raw.notes.today === "string") clean.notes.today = raw.notes.today.slice(0, 500);
      if (typeof raw.notes.temporary === "string") clean.notes.temporary = raw.notes.temporary.slice(0, 1000);
    }
    return clean;
  }

  // ponytail: localStorage stays the durable fallback; only checklist state leaves this boundary.
  const storage = {
    get() {
      try {
        return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
      } catch (_) {
        return emptyState();
      }
    },
    set(next) {
      next.updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return true;
      } catch (_) {
        return false;
      }
    },
    export() {
      return JSON.stringify(this.get(), null, 2);
    },
    import(data) {
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("JSON格式不正确");
      const clean = normalizeState(data);
      this.set(clean);
      return clean;
    },
    reset() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* file:// may block storage */ }
      return emptyState();
    }
  };

  const checklistSync = window.TravelChecklistSync
    ? window.TravelChecklistSync.create(window.TRAVEL_SYNC_CONFIG)
    : { configured: false, userName: "TBD", status: "offline", subscribe() {}, markOffline() {}, async push() { return false; }, async pull() { return null; } };
  let state = storage.get();
  let syncStatus = checklistSync.status;
  let checklistSyncRun;
  let checklistFilter = "all";
  let importMode = "all";
  let toastTimer;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const esc = (value) => String(value ?? "TBD").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const display = (value, fallback) => value === null || value === undefined || value === "" ? (fallback || "TBD") : value;
  const statusTag = (status) => `<span class="status ${esc(status)}">${esc(labels[status] || status || "pending")}</span>`;
  const mapUrl = (provider, query) => provider === "apple"
    ? `https://maps.apple.com/?q=${encodeURIComponent(query)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function save() {
    if (!storage.set(state)) showToast("浏览器未允许本机保存；请使用本地服务器打开");
  }

  function syncStatusLabel() {
    if (syncStatus === "syncing") return "同步中";
    if (syncStatus === "synced") return state.lastSyncedAt ? `已同步 · ${formatSyncTime(state.lastSyncedAt)}` : "已同步";
    return state.lastSyncedAt ? `离线模式 · 上次 ${formatSyncTime(state.lastSyncedAt)}` : "离线模式";
  }

  function updateSyncStatus(status) {
    syncStatus = status;
    const indicator = $("#sync-status");
    if (indicator) indicator.textContent = syncStatusLabel();
    const detail = $("#sync-status-detail");
    if (detail) detail.textContent = syncStatusLabel();
    const lastSynced = $("#last-synced-time");
    if (lastSynced) lastSynced.textContent = formatLastSynced(state.lastSyncedAt);
  }

  function download(name, content) {
    const blob = new Blob([content], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  }

  function formatUpdated(value) {
    if (!value) return "尚无本地修改";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function formatSyncTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function formatLastSynced(value) {
    return value ? formatUpdated(value) : "尚未完成云同步";
  }

  function allChecklistItems() {
    const packing = DATA.packing.flatMap((group, groupIndex) => group.items.map((title, itemIndex) => ({
      id: `packing-${groupIndex}-${itemIndex}`,
      title,
      category: group.category,
      assignee: "共同完成",
      priority: "medium",
      dueAt: "2026-07-20",
      completed: false,
      notes: ""
    })));
    return [...DATA.tasks, ...packing];
  }

  function readinessItems() {
    return [
      ...DATA.preDepartureChecklist,
      ...DATA.connectivityChecklist,
      ...DATA.paymentChecklist,
      ...DATA.boatTripChecklist.tasks,
      ...DATA.hotelPreparation,
      ...DATA.transportPreparation,
      ...DATA.emergencyPreparation
    ];
  }

  function syncDeviceId() {
    try {
      let value = localStorage.getItem(SYNC_DEVICE_KEY);
      if (!value) {
        const suffix = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
        value = `device-${suffix}`;
        localStorage.setItem(SYNC_DEVICE_KEY, value);
      }
      return value.slice(0, 64);
    } catch (_) {
      return "shared-device";
    }
  }

  function currentSyncUserName() {
    const configuredName = checklistSync.userName && checklistSync.userName !== "TBD" ? checklistSync.userName : "";
    return state.syncUserName || configuredName || syncDeviceId();
  }

  function checklistPayload(taskId, completed) {
    const item = allChecklistItems().find((candidate) => candidate.id === taskId);
    if (!item) return null;
    return { taskId, taskName: item.title, completed, completedBy: currentSyncUserName() };
  }

  function queueChecklistChanges(changes) {
    changes.filter(Boolean).forEach((change) => { state.pendingChecklistSync[change.taskId] = change; });
  }

  function commitChecklistChanges(changes, synced) {
    changes.filter(Boolean).forEach((change) => {
      state.completedTasks[change.taskId] = change.completed;
      if (synced) delete state.pendingChecklistSync[change.taskId];
    });
    if (synced) state.lastSyncedAt = new Date().toISOString();
    if (!synced) queueChecklistChanges(changes);
    save();
    renderHome();
    renderChecklist();
    renderMore();
  }

  async function updateChecklistTask(taskId, completed) {
    const change = checklistPayload(taskId, completed);
    if (!change) return;
    const synced = await checklistSync.push(change);
    commitChecklistChanges([change], synced);
    showToast(synced ? "清单已同步" : "已保存在本机 · 离线模式");
  }

  async function clearChecklist() {
    const changes = allChecklistItems().map((item) => checklistPayload(item.id, false));
    const synced = await checklistSync.push(changes);
    commitChecklistChanges(changes, synced);
    showToast(synced ? "完成状态已清除并同步" : "完成状态已在本机清除");
  }

  function syncChecklistFromCloud() {
    if (!checklistSync.configured || (typeof navigator !== "undefined" && !navigator.onLine)) {
      checklistSync.markOffline();
      return Promise.resolve();
    }
    if (checklistSyncRun) return checklistSyncRun;
    checklistSyncRun = (async () => {
      const pending = Object.values(state.pendingChecklistSync);
      if (pending.length) {
        const flushed = await checklistSync.push(pending);
        if (!flushed) return;
        pending.forEach((change) => delete state.pendingChecklistSync[change.taskId]);
      }

      const rows = await checklistSync.pull();
      if (rows === null) return;
      const checklistIds = new Set(allChecklistItems().map((item) => item.id));
      rows.forEach((row) => {
        if (checklistIds.has(row.task_id)) state.completedTasks[row.task_id] = row.completed;
      });

      if (!rows.length) {
        const initial = Object.entries(state.completedTasks).map(([taskId, completed]) => checklistPayload(taskId, completed)).filter(Boolean);
        if (initial.length && !(await checklistSync.push(initial))) {
          queueChecklistChanges(initial);
          save();
          return;
        }
      }

      state.lastSyncedAt = new Date().toISOString();
      save();
      renderHome();
      renderChecklist();
      renderMore();
    })().finally(() => { checklistSyncRun = null; });
    return checklistSyncRun;
  }

  const fallbackImage = (type) => DATA.imageFallbacks[type] || DATA.imageFallbacks.cover;

  function renderHome() {
    const trip = L.tripMoment(DATA.meta);
    const current = L.currentItinerary(DATA.itinerary);
    const focusDay = current || (trip.phase === "upcoming" ? DATA.itinerary[0] : DATA.itinerary.at(-1));
    const urgent = L.urgentTasks(DATA.tasks, state.completedTasks, 3);
    const heroImage = DATA.gallery[0]?.src || fallbackImage("cover");
    const readiness = readinessItems();
    const readinessProgress = L.checklistProgress(readiness, state.completedTasks);
    const departureStatus = {
      ...DATA.departureStatus,
      daysRemaining: trip.phase === "upcoming" ? trip.value : 0,
      completionRate: readiness.length ? readinessProgress.percent : DATA.departureStatus.completionRate,
      highPriorityRemaining: readiness.filter((item) => item.priority === "HIGH" && !(state.completedTasks[item.id] ?? item.completed)).length
    };
    const todayHotel = DATA.hotels.find((hotel) => hotel.checkIn <= focusDay.date && hotel.checkOut > focusDay.date);
    const todayTasks = DATA.tasks.filter((task) => task.dueAt === focusDay.date && !(state.completedTasks[task.id] ?? task.completed));
    const phaseLabel = trip.phase === "upcoming" ? "即将出发" : trip.phase === "traveling" ? "旅行进行中" : "旅行已结束";

    $("#view-home").innerHTML = `
      <article class="hero" style="--hero-image:url('${esc(heroImage)}');--hero-fallback:url('${esc(fallbackImage("cover"))}')">
        <div class="hero-content">
          <p class="eyebrow">${esc(DATA.meta.subtitle)}</p>
          <h1>马来西亚 × 巴厘岛<span>情侣旅行总控台</span></h1>
          <p class="hero-route">${DATA.route.map((stop) => esc(stop.city)).join(" → ")}</p>
          <div class="hero-meta">
            <span class="glass-chip">♡ 两人情侣旅行</span>
            <span class="glass-chip">${esc(L.formatDate(DATA.meta.startDate, { year: "numeric", month: "long", day: "numeric" }))} — ${esc(L.formatDate(DATA.meta.endDate, { month: "long", day: "numeric" }))}</span>
            <span class="glass-chip">${phaseLabel}</span>
            <span class="glass-chip" id="sync-status" role="status" aria-live="polite">${esc(syncStatusLabel())}</span>
          </div>
          <div class="hero-status">
            <div class="countdown"><strong>${esc(trip.label)}</strong><small>${trip.phase === "traveling" && current ? `${esc(current.city)} · ${esc(current.theme)}` : "成都出发 · 轻松海岛假期"}</small></div>
            <div class="updated">基础数据 ${esc(DATA.meta.version)}<br>更新于 ${esc(formatUpdated(DATA.meta.lastUpdated))}</div>
          </div>
        </div>
      </article>

      <div class="section-head"><div><p class="eyebrow">Today at a glance</p><h2>${trip.phase === "traveling" ? "今日总览" : "下一站总览"}</h2></div><p>${esc(L.formatDate(focusDay.date))}</p></div>
      <div class="grid home-grid">
        <article class="card readiness-card">
          <p class="eyebrow">Travel ready</p><h3>出发准备</h3>
          <div class="today-list">
            <div class="today-row"><span>距离出发</span><strong>${esc(departureStatus.daysRemaining)}天</strong></div>
            <div class="today-row"><span>完成</span><strong>${esc(departureStatus.completionRate)}%</strong></div>
            <div class="today-row"><span>剩余重要任务</span><strong>${esc(departureStatus.highPriorityRemaining)}项</strong></div>
          </div>
        </article>
        <article class="card today-card">
          <div class="today-top"><div><p class="eyebrow">${trip.phase === "traveling" ? "Now" : "First day"}</p><h3 class="today-city">${esc(focusDay.city)}</h3></div><div class="weather">天气<br><strong>${esc(focusDay.weather)}</strong></div></div>
          <div class="today-list">
            <div class="today-row"><span>住宿</span><strong>${esc(todayHotel ? todayHotel.nameZh : "等待确认")}</strong></div>
            <div class="today-row"><span>交通</span><strong>${esc(focusDay.transport)}</strong></div>
            <div class="today-row"><span>重点</span><strong>${esc(focusDay.theme)}</strong></div>
            <div class="today-row"><span>必须完成</span><strong>${esc(todayTasks[0]?.title || state.notes.today || "暂无当天待办")}</strong></div>
          </div>
        </article>

        <article class="card">
          <p class="eyebrow">Next actions</p><h3>下一步行动</h3>
          <div class="task-list">${urgent.length ? urgent.map((task, index) => `
            <div class="task-line"><span class="task-index">${index + 1}</span><div><strong>${esc(task.title)}</strong><small>${esc(task.assignee)} · ${esc(L.formatDate(task.dueAt, { month: "numeric", day: "numeric" }))}前</small></div>${statusTag("pending")}</div>
          `).join("") : '<p class="empty">紧急事项已完成</p>'}</div>
          <div class="card-actions"><button class="button small" type="button" data-go="checklist">打开准备清单</button></div>
        </article>

        <article class="card route-card">
          <p class="eyebrow">Route</p><h3>成都到海岛，再回家</h3>
          ${routeSvg(trip.phase, current?.date)}
          <div class="route-labels">${DATA.route.map((stop) => `<span><b>${esc(stop.city)}</b>${esc(L.formatDate(stop.date, { month: "numeric", day: "numeric" }))}</span>`).join("")}</div>
        </article>
      </div>

      <div class="section-head"><div><p class="eyebrow">Important</p><h2>重要提醒</h2></div></div>
      <div class="grid">${DATA.alerts.filter((alert) => alert.active).map((alert) => `<article class="alert ${esc(alert.severity)}"><div><h3>${esc(alert.title)}</h3><p>${esc(alert.text)}</p></div></article>`).join("")}</div>
    `;
  }

  function routeSvg(phase, currentDate) {
    const x = [26, 98, 170, 242, 314];
    return `<svg class="route-svg" viewBox="0 0 340 116" role="img" aria-label="成都、吉隆坡、巴厘岛、吉隆坡、成都旅行路线">
      <defs><linearGradient id="route-gradient" x1="0" x2="1"><stop stop-color="#0d5c63"/><stop offset=".6" stop-color="#52a4a4"/><stop offset="1" stop-color="#d97745"/></linearGradient></defs>
      <path d="M26 59 C62 21 75 21 98 59 S145 96 170 59 S218 22 242 59 S289 96 314 59" fill="none" stroke="url(#route-gradient)" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 7"/>
      ${DATA.route.map((stop, index) => {
        const isCurrent = phase === "traveling" && stop.date === currentDate;
        const fill = isCurrent ? "#d97745" : stop.status === "pending" ? "#f6f1e7" : "#0d5c63";
        const stroke = stop.status === "pending" ? "#9d7434" : fill;
        return `<circle cx="${x[index]}" cy="59" r="${isCurrent ? 10 : 7}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
      }).join("")}
    </svg>`;
  }

  function renderItinerary() {
    const current = L.currentItinerary(DATA.itinerary);
    $("#view-itinerary").innerHTML = `
      <header class="page-header"><p class="eyebrow">Daily story</p><h1>每日行程</h1><p>慢一点，把时间留给风景和彼此。所有待确认安排都会保留，不会因冲突被自动删除。</p><div class="header-actions"><button class="button primary" type="button" id="jump-today" ${current ? "" : "disabled"}>跳到今天</button></div></header>
      <article class="alert warning"><div><h3>${esc(DATA.alerts[1].title)}</h3><p>${esc(DATA.alerts[1].text)}</p></div></article>
      <div class="timeline">${DATA.itinerary.map((day, index) => dayCard(day, current?.id === day.id, index === 0 && !current)).join("")}</div>
    `;
  }

  function dayCard(day, isToday, openFallback) {
    const periods = [["上午", day.periods.morning], ["中午", day.periods.noon], ["下午", day.periods.afternoon], ["晚上", day.periods.evening]];
    return `<article class="card day-card ${isToday ? "today" : ""}" id="${esc(day.id)}">
      <div class="day-cover">
        <img src="${esc(day.image)}" alt="${esc(day.imageAlt)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(fallbackImage("cover"))}'">
        <div class="day-cover-content"><div class="status-row"><time datetime="${esc(day.date)}">${esc(L.formatDate(day.date, { month: "long", day: "numeric", weekday: "long" }))}</time>${statusTag(day.status)}</div><h2>${esc(day.city)}</h2><p>${esc(day.theme)}</p></div>
      </div>
      <div class="day-body"><details ${isToday || openFallback ? "open" : ""}><summary>查看当天安排</summary>
        <div class="period"><span>交通</span><div>${esc(day.transport)}</div></div>
        ${periods.map(([label, items]) => `<div class="period"><span>${label}</span><ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`).join("")}
        <div class="note-box"><strong>注意事项</strong><ul class="notes-list">${day.notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul></div>
        <div class="map-actions">${day.maps.map((map) => `<a class="button small" href="${mapUrl("apple", map.query)}" target="_blank" rel="noopener">Apple地图 · ${esc(map.label)}</a><a class="button small ghost" href="${mapUrl("google", map.query)}" target="_blank" rel="noopener">Google Maps</a>`).join("")}</div>
      </details></div>
    </article>`;
  }

  function renderBookings() {
    $("#view-bookings").innerHTML = `
      <header class="page-header"><p class="eyebrow">Bookings</p><h1>航班与酒店</h1><p>只保存非敏感摘要。这里不提供实时航班状态，实际状态需手动更新。</p></header>
      <div class="section-head"><div><p class="eyebrow">Flights</p><h2>航班</h2></div><p>4个航段</p></div>
      <article class="alert critical"><div><h3>${esc(DATA.alerts[0].title)}</h3><p>${esc(DATA.alerts[0].text)}</p></div></article>
      <div class="booking-grid">${DATA.flights.map(flightCard).join("")}</div>
      <div class="section-head"><div><p class="eyebrow">Hotels</p><h2>酒店</h2></div><p>2个城市</p></div>
      <div class="booking-grid">${DATA.hotels.map(hotelCard).join("")}</div>
    `;
  }

  function flightCard(flight) {
    const local = state.flights[flight.id] || {};
    const status = local.status || flight.status;
    const actual = local.actualStatus || flight.actualStatus;
    let bufferText = "等待两段航班日期与时间确认后自动计算";
    if (flight.id === "flight-bali-kl") {
      const onward = DATA.flights.find((item) => item.id === "flight-3u3994");
      const minutes = L.transferBuffer(flight.date, flight.arrivalTime, onward.date, onward.departureTime);
      if (minutes !== null) bufferText = `${Math.floor(minutes / 60)}小时${minutes % 60}分 · ${minutes < 360 ? "风险较高" : "仍需核对机场与航站楼"}`;
    }
    return `<article class="card booking-card">
      <div class="booking-title"><div><p class="eyebrow">${esc(flight.airline)}</p><h3>${esc(flight.flightNumber)}</h3></div>${statusTag(status)}</div>
      <div class="flight-route"><div class="airport"><strong>${esc(flight.departureTime)}</strong><span>${esc(flight.departureAirport)}</span></div><div class="flight-line"></div><div class="airport"><strong>${esc(flight.arrivalTime)}</strong><span>${esc(flight.arrivalAirport)}</span></div></div>
      <div class="info-grid">
        <div class="info"><span>日期</span><strong>${esc(L.formatDate(flight.date, { year: "numeric", month: "numeric", day: "numeric" }))}</strong></div>
        <div class="info"><span>航站楼</span><strong>${esc(flight.departureTerminal)} → ${esc(flight.arrivalTerminal)}</strong></div>
        <div class="info"><span>托运行李</span><strong>${esc(flight.checkedBaggage)}</strong></div>
        <div class="info"><span>是否联程</span><strong>${flight.isThroughTicket ? "是" : "否 / 分开购买"}</strong></div>
        <div class="info"><span>值机状态</span><strong>${esc(labels[flight.checkInStatus] || flight.checkInStatus)}</strong></div>
        <div class="info"><span>实际状态</span><strong>${esc(actual)}</strong></div>
      </div>
      ${flight.id === "flight-bali-kl" ? `<div class="note-box"><strong>转机缓冲</strong><br>${esc(bufferText)}</div>` : ""}
      <p class="card-subtitle" style="margin-top:12px">${esc(flight.notes)}</p>
      <div class="card-actions"><button class="button small" type="button" data-copy="${esc(flight.flightNumber)}">复制航班号</button><button class="button small ghost" type="button" data-copy="${esc(flight.departureAirport)}">复制起飞机场</button><button class="button small ghost" type="button" data-copy="${esc(flight.arrivalAirport)}">复制抵达机场</button></div>
    </article>`;
  }

  function hotelCard(hotel) {
    const local = state.hotels[hotel.id] || {};
    const status = local.status || hotel.status;
    const phoneReady = hotel.phone && hotel.phone !== "TBD";
    return `<article class="card booking-card">
      <div class="hotel-image"><img src="${esc(hotel.image)}" alt="${esc(hotel.imageAlt)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(fallbackImage("hotel"))}'"></div>
      <div class="booking-title"><div><p class="eyebrow">${esc(hotel.name)}</p><h3>${esc(hotel.nameZh)}</h3></div>${statusTag(status)}</div>
      <p class="card-subtitle">${esc(hotel.address)}</p>
      <div class="info-grid" style="margin-top:16px">
        <div class="info"><span>入住</span><strong>${esc(L.formatDate(hotel.checkIn, { month: "numeric", day: "numeric" }))}</strong></div>
        <div class="info"><span>退房</span><strong>${esc(L.formatDate(hotel.checkOut, { month: "numeric", day: "numeric" }))}</strong></div>
        <div class="info"><span>房型</span><strong>${esc(hotel.roomType)}</strong></div>
        <div class="info"><span>早餐</span><strong>${esc(hotel.breakfast)}</strong></div>
        <div class="info"><span>支付</span><strong>${hotel.paid ? "已支付" : "待支付"}</strong></div>
        <div class="info"><span>平台</span><strong>${esc(hotel.bookingPlatform)}</strong></div>
        <div class="info"><span>押金</span><strong>${esc(hotel.depositAmount)}</strong></div>
        <div class="info"><span>押金方式</span><strong>${esc(hotel.depositMethod)}</strong></div>
      </div>
      <details><summary class="button small" style="margin-top:12px">查看订单备注</summary><p class="card-subtitle">订单别名：${esc(hotel.orderAlias)}<br>${esc(hotel.notes)}</p></details>
      <div class="card-actions"><button class="button small" type="button" data-copy="${esc(hotel.address)}">复制地址</button><a class="button small ghost" href="${mapUrl("google", hotel.address)}" target="_blank" rel="noopener">Google Maps</a><a class="button small ghost" href="${mapUrl("apple", hotel.address)}" target="_blank" rel="noopener">Apple地图</a><a class="button small ghost ${phoneReady ? "" : "disabled"}" ${phoneReady ? `href="tel:${esc(hotel.phone)}"` : 'aria-disabled="true"'}>联系酒店</a></div>
    </article>`;
  }

  function renderChecklist() {
    const items = allChecklistItems();
    const progress = L.checklistProgress(items, state.completedTasks);
    const categories = [...new Set(items.map((item) => item.category))];
    $("#view-checklist").innerHTML = `
      <header class="page-header"><p class="eyebrow">Ready together</p><h1>准备清单</h1><p>勾选状态优先同步云端；离线时继续保存在本机，恢复网络后自动重试。</p>
        <div class="header-actions"><button class="button ${checklistFilter === "open" ? "primary" : ""}" type="button" id="filter-open">${checklistFilter === "open" ? "显示全部" : "只看未完成"}</button><button class="button" type="button" id="export-checklist">导出清单</button><button class="button" type="button" id="import-checklist">导入清单</button><button class="button danger" type="button" id="clear-checklist">清除完成状态</button></div>
      </header>
      <article class="card progress-card"><div class="progress-top"><div><p class="eyebrow">Progress</p><strong>${progress.completed} / ${progress.total}</strong></div><span class="progress-value">${progress.percent}%</span></div><div class="progress-track" aria-label="清单完成${progress.percent}%"><span style="width:${progress.percent}%"></span></div></article>
      <div class="grid" style="margin-top:14px">${categories.map((category) => checklistCategory(category, items.filter((item) => item.category === category))).join("")}</div>
    `;
  }

  function checklistCategory(category, categoryItems) {
    const visible = checklistFilter === "open" ? categoryItems.filter((item) => !(state.completedTasks[item.id] ?? item.completed)) : categoryItems;
    const completed = categoryItems.filter((item) => state.completedTasks[item.id] ?? item.completed).length;
    return `<details class="card check-category" open><summary>${esc(category)} <small>${completed}/${categoryItems.length}</small></summary><div class="check-items">
      ${visible.length ? visible.map((item) => {
        const checked = state.completedTasks[item.id] ?? item.completed;
        const assignee = state.assignees[item.id] || item.assignee;
        return `<div class="check-row ${checked ? "completed" : ""}"><input id="check-${esc(item.id)}" type="checkbox" data-task="${esc(item.id)}" ${checked ? "checked" : ""}><label for="check-${esc(item.id)}">${esc(item.title)}${item.notes ? `<small class="muted"><br>${esc(item.notes)}</small>` : ""}</label><select data-assignee="${esc(item.id)}" aria-label="${esc(item.title)}负责人">${ASSIGNEES.map((name) => `<option ${name === assignee ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></div>`;
      }).join("") : '<p class="empty">此分类已全部完成</p>'}
    </div></details>`;
  }

  function renderBudget() {
    const grouped = budgetByCurrency();
    $("#view-budget").innerHTML = `
      <header class="page-header"><p class="eyebrow">Shared spending</p><h1>旅行预算</h1><p>不自动获取汇率。金额在本机保存，不记录银行卡或支付密码。</p></header>
      <article class="card"><p class="eyebrow">Overview</p><div class="budget-summary">${Object.entries(grouped).map(([currency, totals]) => `
        <div class="money-stat"><span>${esc(currency)} · 计划</span><strong>${money(totals.planned, currency)}</strong></div>
        <div class="money-stat"><span>${esc(currency)} · 实际</span><strong>${money(totals.actual, currency)}</strong></div>
        <div class="money-stat"><span>我支付</span><strong>${money(totals.me, currency)}</strong></div>
        <div class="money-stat"><span>女朋友支付</span><strong>${money(totals.partner, currency)}</strong></div>
      `).join("")}</div><p class="card-subtitle" style="margin-top:12px">${esc(DATA.exchangeRates.note)}</p></article>
      <div class="section-head"><div><p class="eyebrow">Items</p><h2>预算项目</h2></div><p>实际花费可直接修改</p></div>
      <div class="grid budget-list">${DATA.budget.map(budgetCard).join("")}</div>
    `;
  }

  function budgetByCurrency() {
    return DATA.budget.reduce((groups, item) => {
      const local = state.budget[item.id] || {};
      const currency = local.currency || item.currency;
      const planned = numeric(local.plannedAmount ?? item.plannedAmount);
      const actual = numeric(local.actualAmount ?? item.actualAmount);
      groups[currency] ||= { planned: 0, actual: 0, paid: 0, unpaid: 0, me: 0, partner: 0 };
      groups[currency].planned += planned;
      groups[currency].actual += actual;
      const payer = local.payer || item.payer;
      if (payer === "我") groups[currency].me += actual;
      if (payer === "女朋友") groups[currency].partner += actual;
      if (local.paid ?? item.paid) groups[currency].paid += actual;
      else groups[currency].unpaid += planned;
      return groups;
    }, {});
  }

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function money(value, currency) {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(value || 0);
  }

  function budgetCard(item) {
    const local = state.budget[item.id] || {};
    const currency = local.currency || item.currency;
    const actual = local.actualAmount ?? item.actualAmount ?? "";
    const payer = local.payer || item.payer;
    const paid = local.paid ?? item.paid;
    return `<article class="card budget-row"><div class="budget-main"><div><strong>${esc(item.category)}</strong><small>${esc(item.item)}</small></div>${statusTag(paid ? "confirmed" : "pending")}</div>
      <div class="info-grid"><div class="info"><span>计划预算</span><strong>${item.plannedAmount === null ? "TBD" : money(item.plannedAmount, item.currency)}</strong></div><div class="info"><span>备注</span><strong>${esc(item.notes)}</strong></div></div>
      <div class="field-grid"><label class="field">币种<select data-budget="${esc(item.id)}" data-field="currency">${["CNY", "MYR", "IDR", "USD"].map((code) => `<option ${code === currency ? "selected" : ""}>${code}</option>`).join("")}</select></label><label class="field">实际花费<input data-budget="${esc(item.id)}" data-field="actualAmount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(actual)}" placeholder="TBD"></label><label class="field">付款人<select data-budget="${esc(item.id)}" data-field="payer">${["我", "女朋友", "共同", "分别"].map((name) => `<option ${name === payer ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label><label class="field">支付状态<select data-budget="${esc(item.id)}" data-field="paid"><option value="false" ${!paid ? "selected" : ""}>待支付</option><option value="true" ${paid ? "selected" : ""}>已支付</option></select></label></div>
    </article>`;
  }

  function renderMore() {
    $("#view-more").innerHTML = `
      <header class="page-header"><p class="eyebrow">Travel tools</p><h1>更多工具</h1><p>紧急联系、旅行图片、本机编辑和数据管理集中在这里。</p></header>
      <div class="settings-grid">
        <article class="card wide"><p class="eyebrow">Gallery</p><h3>旅行图片</h3><div class="gallery">${DATA.gallery.map((image) => `<figure class="gallery-item"><img src="${esc(image.src)}" alt="${esc(image.alt)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(fallbackImage("cover"))}'"><span>${esc(image.label)}</span></figure>`).join("")}</div></article>
        <article class="card"><p class="eyebrow">Emergency</p><h3>紧急联系</h3><div class="emergency-list">${DATA.emergency.map((contact) => `<div class="contact-row"><div><strong>${esc(contact.label)}</strong><span>${esc(contact.region)} · ${esc(contact.notes)}</span></div>${contact.phone === "TBD" ? '<b class="muted">TBD</b>' : `<a href="tel:${esc(contact.phone)}">${esc(contact.phone)}</a>`}</div>`).join("")}</div></article>
        <article class="card"><p class="eyebrow">Local notes</p><h3>本机备注</h3><label class="field">今日提醒<textarea id="today-note" maxlength="500" placeholder="只保存在本机，不要填写证件号或银行卡信息">${esc(state.notes.today)}</textarea></label><label class="field" style="margin-top:10px">临时备注<textarea id="temporary-note" maxlength="1000" placeholder="记录临时变更；不要填写敏感信息">${esc(state.notes.temporary)}</textarea></label><button class="button primary" type="button" id="save-notes" style="margin-top:10px">保存备注</button></article>
        <article class="card"><p class="eyebrow">Shared checklist</p><h3>共享身份与同步</h3><label class="field">这台手机的显示名称<input id="sync-user-name" maxlength="64" value="${esc(state.syncUserName || (checklistSync.userName === "TBD" ? "" : checklistSync.userName))}" placeholder="例如：张微明"></label><button class="button primary" type="button" id="save-sync-user" style="margin-top:10px">保存显示名称</button><p class="card-subtitle"><span id="sync-status-detail">${esc(syncStatusLabel())}</span><br>最后同步：<span id="last-synced-time">${esc(formatLastSynced(state.lastSyncedAt))}</span><br>仅 completed、completed_by、updated_at 进入云端。</p></article>
        <article class="card"><p class="eyebrow">Flight status</p><h3>航班实际状态</h3><div class="edit-list">${DATA.flights.map((flight) => { const local = state.flights[flight.id] || {}; return `<label class="edit-item"><strong>${esc(flight.flightNumber)} · ${esc(flight.date)}</strong><select class="field" data-flight="${esc(flight.id)}" data-field="actualStatus">${ACTUAL_FLIGHT_STATUSES.map((value) => `<option ${value === (local.actualStatus || flight.actualStatus) ? "selected" : ""}>${esc(value)}</option>`).join("")}</select><select class="field" style="margin-top:7px" data-flight="${esc(flight.id)}" data-field="status">${STATUSES.map((value) => `<option value="${value}" ${value === (local.status || flight.status) ? "selected" : ""}>${esc(labels[value])}</option>`).join("")}</select></label>`; }).join("")}</div></article>
        <article class="card"><p class="eyebrow">Hotel status</p><h3>酒店确认状态</h3><div class="edit-list">${DATA.hotels.map((hotel) => { const local = state.hotels[hotel.id] || {}; return `<label class="edit-item"><strong>${esc(hotel.nameZh)}</strong><select class="field" data-hotel="${esc(hotel.id)}" data-field="status">${STATUSES.map((value) => `<option value="${value}" ${value === (local.status || hotel.status) ? "selected" : ""}>${esc(labels[value])}</option>`).join("")}</select></label>`; }).join("")}</div></article>
        <article class="card"><p class="eyebrow">Local data</p><h3>本机修改数据</h3><p class="card-subtitle">基础版本：${esc(DATA.meta.version)}<br>本机修改：${esc(formatUpdated(state.updatedAt))}</p><div class="card-actions"><button class="button small" type="button" id="export-all">导出JSON</button><button class="button small" type="button" id="import-all">从JSON导入</button><button class="button small danger" type="button" id="reset-all">恢复基础数据</button></div></article>
        <article class="card"><p class="eyebrow">Privacy</p><h3>不可进入公开页面</h3><ul class="privacy-list"><li>护照、身份证照片与完整号码</li><li>银行卡号、支付密码与CVV</li><li>完整预订编号和私人订单PDF</li><li>API Key、保险保单原件与二维码</li></ul><p class="card-subtitle">敏感文件继续保存在私密iCloud目录，不进入项目或公开GitHub Pages。</p></article>
      </div>
    `;
  }

  function renderAll() {
    renderHome();
    renderItinerary();
    renderBookings();
    renderChecklist();
    renderBudget();
    renderMore();
  }

  function switchView(name, scroll) {
    $$(".view").forEach((view) => {
      const active = view.id === `view-${name}`;
      view.hidden = !active;
      view.classList.toggle("active", active);
    });
    $$(".nav-item").forEach((button) => {
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    if (scroll !== false) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleClick(event) {
    const nav = event.target.closest("[data-view]");
    if (nav) return switchView(nav.dataset.view);
    const go = event.target.closest("[data-go]");
    if (go) return switchView(go.dataset.go);
    const copy = event.target.closest("[data-copy]");
    if (copy) return copyText(copy.dataset.copy);
    if (event.target.id === "jump-today") return $(".day-card.today")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (event.target.id === "filter-open") { checklistFilter = checklistFilter === "open" ? "all" : "open"; renderChecklist(); return; }
    if (event.target.id === "clear-checklist") return clearChecklist();
    if (event.target.id === "export-checklist") return exportChecklist();
    if (event.target.id === "import-checklist") return chooseImport("checklist");
    if (event.target.id === "save-notes") return saveNotes();
    if (event.target.id === "save-sync-user") return saveSyncUserName();
    if (event.target.id === "export-all") { download("malaysia-bali-local-overrides.json", storage.export()); showToast("本机修改已导出"); return; }
    if (event.target.id === "import-all") return chooseImport("all");
    if (event.target.id === "reset-all") return resetAll();
  }

  function handleChange(event) {
    const task = event.target.dataset.task;
    if (task) { event.target.disabled = true; updateChecklistTask(task, event.target.checked); return; }
    const assignee = event.target.dataset.assignee;
    if (assignee) { state.assignees[assignee] = event.target.value; save(); showToast("负责人已更新"); return; }
    const budget = event.target.dataset.budget;
    if (budget) {
      state.budget[budget] ||= {};
      let value = event.target.value;
      if (event.target.dataset.field === "paid") value = value === "true";
      state.budget[budget][event.target.dataset.field] = value;
      save(); renderBudget(); showToast("预算已保存在本机"); return;
    }
    const flight = event.target.dataset.flight;
    if (flight) { state.flights[flight] ||= {}; state.flights[flight][event.target.dataset.field] = event.target.value; save(); renderBookings(); renderMore(); showToast("航班状态已更新"); return; }
    const hotel = event.target.dataset.hotel;
    if (hotel) { state.hotels[hotel] ||= {}; state.hotels[hotel][event.target.dataset.field] = event.target.value; save(); renderBookings(); renderMore(); showToast("酒店状态已更新"); }
  }

  async function copyText(text) {
    if (!text || text === "TBD") return showToast("此字段仍待确认");
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const input = document.createElement("textarea");
        input.value = text;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      showToast("已复制");
    } catch (_) {
      showToast("复制失败，请长按文本复制");
    }
  }

  function saveNotes() {
    state.notes.today = $("#today-note").value.trim();
    state.notes.temporary = $("#temporary-note").value.trim();
    save();
    renderHome();
    renderMore();
    showToast("备注已保存在本机");
  }

  function saveSyncUserName() {
    const value = $("#sync-user-name").value.trim().slice(0, 64);
    if (/(护照号|身份证号|银行卡号|订单号|CVV|密码)/i.test(value)) return showToast("显示名称不能包含敏感信息");
    state.syncUserName = value;
    Object.values(state.pendingChecklistSync).forEach((change) => { change.completedBy = currentSyncUserName(); });
    save();
    renderMore();
    showToast(value ? "共享显示名称已保存在本机" : "已恢复设备默认身份");
  }

  function exportChecklist() {
    const payload = { type: "malaysia-bali-checklist", version: 1, exportedAt: new Date().toISOString(), completedTasks: state.completedTasks, assignees: state.assignees };
    download("malaysia-bali-checklist.json", JSON.stringify(payload, null, 2));
    showToast("清单已导出");
  }

  function chooseImport(mode) {
    importMode = mode;
    const input = $("#import-file");
    input.value = "";
    input.click();
  }

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (importMode === "checklist") {
        if (data.type !== "malaysia-bali-checklist" || !isRecord(data.completedTasks)) throw new Error("不是本项目的清单文件");
        const imported = normalizeState({ completedTasks: data.completedTasks, assignees: data.assignees });
        state.completedTasks = imported.completedTasks;
        state.assignees = imported.assignees;
        save();
      } else {
        state = storage.import(data);
      }
      queueChecklistChanges(allChecklistItems().map((item) => checklistPayload(item.id, state.completedTasks[item.id] ?? item.completed)));
      save();
      renderAll();
      switchView(importMode === "checklist" ? "checklist" : "more", false);
      showToast("数据导入成功");
      syncChecklistFromCloud();
    } catch (error) {
      showToast(error.message || "导入失败");
    }
  }

  function resetAll() {
    if (!window.confirm("确认清除这台设备上的全部修改？基础数据不会被删除。")) return;
    state = storage.reset();
    renderAll();
    switchView("more", false);
    showToast("已恢复基础数据");
  }

  function setupNetwork() {
    const banner = $("#offline-banner");
    const update = () => {
      banner.hidden = navigator.onLine;
      if (navigator.onLine) syncChecklistFromCloud(); else checklistSync.markOffline();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./service-worker.js").then((registration) => {
        if (registration.waiting) $("#update-banner").hidden = false;
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) $("#update-banner").hidden = false;
          });
        });
        $("#refresh-app").addEventListener("click", () => {
          if (registration.waiting) registration.waiting.postMessage("SKIP_WAITING");
          else location.reload();
        });
      }).catch(() => showToast("离线缓存注册失败，页面仍可正常使用"));
      navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
    }
  }

  function init() {
    if (!DATA || !L) throw new Error("旅行数据或页面逻辑未加载");
    checklistSync.subscribe(updateSyncStatus);
    renderAll();
    document.addEventListener("click", handleClick);
    document.addEventListener("change", handleChange);
    $("#import-file").addEventListener("change", handleImport);
    setupNetwork();
    switchView("home", false);
  }

  try {
    init();
  } catch (error) {
    console.error(error);
    $("#view-home").innerHTML = `<article class="card" style="margin-top:20px"><h1>页面加载遇到问题</h1><p>${esc(error.message)}</p><p>请确认 <code>data/trip-data.js</code> 存在后刷新页面。</p></article>`;
  }
})();
