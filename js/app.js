(function () {
  "use strict";

  const DATA = window.TRIP_DATA;
  const OFFLINE_PACK = window.OFFLINE_PACK;
  const L = window.DashboardLogic;
  const STORAGE_KEY = "malaysia-bali-dashboard-overrides-v1";
  const SYNC_DEVICE_KEY = "malaysia-bali-sync-device-v1";
  const LOCAL_STORAGE_ALLOWLIST = new Set([STORAGE_KEY, SYNC_DEVICE_KEY]);
  const ASSIGNEES = ["我", "女朋友", "共同完成"];
  const STATUSES = ["pending", "confirmed", "changed", "cancelled"];
  const ACTUAL_FLIGHT_STATUSES = ["等待确认", "正常", "延误", "取消", "已完成"];
  const ITINERARY_PERIODS = [["morning", "上午"], ["noon", "中午"], ["afternoon", "下午"], ["evening", "晚上"]];
  const ITINERARY_ACTIVITY_TEMPLATES = {
    sea: { label: "出海", period: "morning", text: "出海 / 浮潜" },
    hotel: { label: "酒店", period: "afternoon", text: "办理酒店入住" },
    transport: { label: "交通", period: "morning", text: "前往下一目的地" }
  };
  const EXPENSE_CATEGORIES = { flight: "机票", hotel: "酒店", transport: "交通", food: "餐饮", sea: "出海", attractions: "景点", insurance: "保险", connectivity: "通信", shopping: "购物", other: "其他" };
  const QUICK_EXPENSE_CATEGORIES = ["flight", "hotel", "transport", "food", "sea", "attractions", "other"];
  const EXPENSE_STATUSES = { paid: "已支付", pending: "待支付", refunded: "已退款" };
  const EXPENSE_SPLITS = { shared: "共同费用", personal: "个人费用" };
  const EXPENSE_CURRENCIES = ["CNY", "MYR", "IDR", "USD"];
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
    return clean;
  }

  function persistentState(value) {
    return {
      baseVersion: value.baseVersion,
      updatedAt: value.updatedAt,
      lastSyncedAt: value.lastSyncedAt,
      syncUserName: value.syncUserName,
      completedTasks: value.completedTasks,
      pendingChecklistSync: value.pendingChecklistSync,
      assignees: value.assignees,
      budget: value.budget,
      flights: value.flights,
      hotels: value.hotels
    };
  }

  function enforceLocalStorageBoundary() {
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith("malaysia-bali-") && !LOCAL_STORAGE_ALLOWLIST.has(key)) localStorage.removeItem(key);
      }
    } catch (_) { /* file:// may block storage */ }
  }

  enforceLocalStorageBoundary();

  // ponytail: persist an explicit non-sensitive allowlist, never the whole runtime state.
  const storage = {
    get() {
      try {
        const clean = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState(clean)));
        return clean;
      } catch (_) {
        return emptyState();
      }
    },
    set(next) {
      next.updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState(next)));
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
  const weatherService = window.TravelWeather ? window.TravelWeather.create() : { async load() { return []; } };
  const documentService = window.TravelDocuments
    ? window.TravelDocuments.create(window.TRAVEL_SYNC_CONFIG)
    : { configured: false, authenticated: false, hasSession: false, categories: [], canDelete() { return false; }, onInvalid() {}, clearSignedUrls() {}, async reset() {}, async getSession() { return null; }, async signIn() { throw new Error("私人资料服务未加载"); }, async list() { return []; }, async upload() { throw new Error("私人资料服务未加载"); }, async signedUrl() { throw new Error("私人资料服务未加载"); }, async remove() { return false; } };
  const sharedDataService = window.TravelSharedData
    ? window.TravelSharedData.create(window.TRAVEL_SYNC_CONFIG, documentService)
    : { configured: false, async loadSnapshot() { return null; }, async refresh() { return null; }, async saveItineraryOverride() { const error = new Error("请先登录私人旅行数据"); error.code = "AUTH_REQUIRED"; throw error; } };
  let state = storage.get();
  let weatherByLocation = {};
  let weatherLoading = true;
  let weatherRun;
  let privateDocuments = [];
  let documentsLoading = false;
  let documentsRun;
  let privateRequestVersion = 0;
  let privateSessionChecking = false;
  let privateSessionRun;
  let sharedSnapshot = null;
  let sharedDataRun;
  let sharedRequestVersion = 0;
  let sharedDataLoading = false;
  let itineraryEdit = null;
  let itinerarySaving = false;
  let itineraryConflict = false;
  let itineraryActivitySequence = 0;
  let expenseEdit = null;
  let expenseSaving = false;
  let expenseConflict = false;
  let expenseDeletingId = null;
  let expenseSequence = 0;
  let selectedPrivateDocument = null;
  let pendingPrivateUploads = 0;
  const incompleteDeletes = new Set();
  const generatedObjectUrls = new Set();
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
  const flightActualTag = (status) => `<span class="status ${status === "正常" || status === "已完成" ? "confirmed" : status === "延误" ? "changed" : status === "取消" ? "cancelled" : "pending"}">${esc(status)}</span>`;
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
    generatedObjectUrls.add(anchor.href);
    anchor.download = name;
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(anchor.href);
      generatedObjectUrls.delete(anchor.href);
    }, 1000);
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

  function weatherLocationIdForDay(day) {
    return day.date <= "2026-07-21" ? "kuala-lumpur" : "bali";
  }

  function formatSunset(value) {
    return value === "TBD" ? value : String(value).slice(11, 16) || "TBD";
  }

  function loadWeatherData() {
    if (weatherRun) return weatherRun;
    weatherLoading = true;
    weatherRun = weatherService.load(DATA.weatherLocations).then((rows) => {
      weatherByLocation = Object.fromEntries(rows.map((row) => [row.id, row]));
      weatherLoading = false;
      renderHome();
    }).finally(() => { weatherRun = null; });
    return weatherRun;
  }

  function readinessBoard() {
    const taskStatus = (items) => !items.length ? "missing" : items.every((item) => state.completedTasks[item.id] ?? item.completed) ? "ready" : "pending";
    const registryStatus = (items, localState) => !items.length ? "missing" : items.every((item) => (localState[item.id]?.status || item.status) === "confirmed") ? "ready" : "pending";
    return [
      { label: "Documents", status: taskStatus(DATA.preDepartureChecklist) },
      { label: "Hotels", status: registryStatus(DATA.hotelRegistry, state.hotels) },
      { label: "Flights", status: registryStatus(DATA.flightRegistry, state.flights) },
      { label: "Network", status: taskStatus(DATA.connectivityChecklist) },
      { label: "Activities", status: taskStatus(DATA.boatTripChecklist.tasks) }
    ];
  }

  function weatherOverviewCard() {
    const rows = DATA.weatherLocations.map((location) => {
      const weather = weatherByLocation[location.id];
      const value = weather ? `${weather.temperature}°C · 雨${weather.rainProbability}% · 日落${formatSunset(weather.sunset)}` : weatherLoading ? "获取中" : "TBD";
      return `<div class="today-row"><span>${esc(location.name)}</span><strong>${esc(value)}</strong></div>`;
    }).join("");
    return `<article class="card"><p class="eyebrow">Weather</p><h3>目的地天气</h3><div class="today-list">${rows}<div class="today-row"><span>海况</span><strong>TBD</strong></div></div></article>`;
  }

  const documentCategoryLabels = {
    flights: "航班",
    hotels: "酒店",
    immigration: "入境",
    transport: "交通",
    activities: "活动",
    finance: "财务"
  };

  function documentCounts() {
    return privateDocuments.reduce((counts, item) => {
      counts.total += 1;
      counts[item.category] = (counts[item.category] || 0) + 1;
      return counts;
    }, { total: 0 });
  }

  function relatedItemName(id) {
    const flight = DATA.flights.find((item) => item.id === id);
    if (flight) return `${flight.flightNumber} · ${flight.date}`;
    const hotel = DATA.hotels.find((item) => item.id === id);
    return hotel ? hotel.nameZh : "未关联具体行程";
  }

  function relatedOptions(category) {
    const items = category === "flights"
      ? DATA.flights.map((item) => ({ id: item.id, label: `${item.flightNumber} · ${item.date}` }))
      : category === "hotels"
        ? DATA.hotels.map((item) => ({ id: item.id, label: item.nameZh }))
        : [];
    return `<option value="">不关联具体项目</option>${items.map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join("")}`;
  }

  function revokeGeneratedObjectUrls() {
    generatedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    generatedObjectUrls.clear();
  }

  async function resetPrivateSession(reason) {
    const message = reason === "已退出私人资料层" ? reason : "登录已失效，请重新登录";
    const signOutRun = documentService.reset(message);
    privateRequestVersion += 1;
    sharedRequestVersion += 1;
    privateDocuments = [];
    sharedSnapshot = null;
    sharedDataRun = null;
    sharedDataLoading = false;
    itineraryEdit = null;
    itinerarySaving = false;
    itineraryConflict = false;
    expenseEdit = null;
    expenseSaving = false;
    expenseConflict = false;
    expenseDeletingId = null;
    selectedPrivateDocument = null;
    pendingPrivateUploads = 0;
    documentsLoading = false;
    documentsRun = null;
    privateSessionChecking = false;
    privateSessionRun = null;
    incompleteDeletes.clear();
    documentService.clearSignedUrls();
    revokeGeneratedObjectUrls();
    renderAll();
    switchView("documents", false);
    showToast(message);
    await signOutRun;
    return message;
  }

  documentService.onInvalid(resetPrivateSession);

  function linkedDocumentBlock(category, relatedItemId) {
    const matches = privateDocuments.filter((item) => item.category === category && item.related_item_id === relatedItemId);
    const body = !documentService.authenticated
      ? '<span class="muted">登录后查看</span>'
      : matches.length
        ? matches.map((item) => `<button class="button small ghost" type="button" data-document-open="${esc(item.id)}">${esc(item.title)}</button>`).join("")
        : '<span class="muted">暂无关联文件</span>';
    return `<div class="document-links"><strong>关联文件</strong><div>${body}<button class="button small" type="button" data-go="documents">资料中心</button></div></div>`;
  }

  function loadPrivateDocuments() {
    if (!documentService.authenticated) {
      privateDocuments = [];
      renderHome();
      renderBookings();
      renderDocuments();
      return Promise.resolve([]);
    }
    if (documentsRun) return documentsRun;
    const runVersion = privateRequestVersion;
    documentsLoading = true;
    renderHome();
    renderDocuments();
    const run = documentService.list().then((rows) => {
      if (runVersion === privateRequestVersion && documentService.authenticated) privateDocuments = rows;
      return rows;
    }).catch((error) => {
      if (runVersion === privateRequestVersion) showToast(error.message || "私人资料读取失败");
      return [];
    }).finally(() => {
      if (runVersion !== privateRequestVersion) return;
      documentsLoading = false;
      documentsRun = null;
      renderHome();
      renderBookings();
      renderDocuments();
    });
    documentsRun = run;
    return run;
  }

  function itineraryDays() {
    return L.mergeItinerary(DATA.itinerary, sharedSnapshot?.itineraryOverrides || []);
  }

  function loadSharedSnapshot(force) {
    if (!documentService.authenticated || !sharedDataService.configured) {
      sharedSnapshot = null;
      itineraryEdit = null;
      itineraryConflict = false;
      expenseEdit = null;
      expenseConflict = false;
      return Promise.resolve(null);
    }
    if (sharedDataRun) return sharedDataRun;
    const runVersion = sharedRequestVersion;
    sharedDataLoading = true;
    renderHome();
    renderItinerary();
    renderBudget();
    const request = force ? sharedDataService.refresh() : sharedDataService.loadSnapshot();
    const run = request.then((snapshot) => {
      if (runVersion === sharedRequestVersion && documentService.authenticated && snapshot) {
        sharedSnapshot = {
          currentUserId: snapshot.currentUserId,
          members: snapshot.members || [],
          itineraryOverrides: snapshot.itineraryOverrides || [],
          expenses: snapshot.expenses || [],
          loadedAt: snapshot.loadedAt || null
        };
      }
      return snapshot;
    }).catch(async (error) => {
      if (runVersion !== sharedRequestVersion) return null;
      if (["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error?.code)) {
        await resetPrivateSession("登录已失效，请重新登录");
      } else {
        if (["MEMBERSHIP_REQUIRED", "FORBIDDEN"].includes(error?.code)) {
          sharedSnapshot = null;
          itineraryEdit = null;
          itineraryConflict = false;
          expenseEdit = null;
          expenseConflict = false;
        }
        showToast(error?.message || "共享旅行数据读取失败");
      }
      return null;
    }).finally(() => {
      if (runVersion !== sharedRequestVersion) return;
      sharedDataLoading = false;
      sharedDataRun = null;
      renderHome();
      renderItinerary();
      renderBudget();
    });
    sharedDataRun = run;
    return run;
  }

  function commandCenterActive() {
    return documentService.authenticated && sharedDataService.configured && Boolean(sharedSnapshot);
  }

  function commandSyncState() {
    if (itineraryConflict || expenseConflict) return { key: "conflict", label: "冲突", detail: "共享记录已有更新，请重新打开后处理" };
    if (navigator.onLine === false) return { key: "offline", label: "离线只读", detail: "保留当前内存快照，联网后再写入" };
    if (itinerarySaving || expenseSaving || expenseDeletingId || pendingPrivateUploads > 0) return { key: "saving", label: "保存中", detail: "正在写入共享旅行数据" };
    return { key: "synced", label: "已同步", detail: "共享快照已加载" };
  }

  function commandPeriodLabel(period) {
    return ITINERARY_PERIODS.find(([name]) => name === period)?.[1] || period;
  }

  function liveTravelState(day) {
    const flights = DATA.flights.map((flight) => ({ ...flight, ...state.flights[flight.id] }));
    const hotels = DATA.hotels.map((hotel) => ({ ...hotel, ...state.hotels[hotel.id] }));
    return {
      flight: L.nextActiveFlight(flights),
      hotel: hotels.filter((hotel) => hotel.status !== "cancelled" && hotel.checkIn <= day.date && hotel.checkOut >= day.date).sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0] || null,
      nextAction: L.nextTravelAction(day, flights, hotels)
    };
  }

  function updateTravelCountdown() {
    const countdown = $("#next-action-countdown");
    if (!countdown) return;
    countdown.textContent = L.travelCountdown(countdown.dataset.nextAt ? Number(countdown.dataset.nextAt) : null);
  }

  function renderCommandCenter() {
    const itinerary = itineraryDays();
    const trip = L.tripMoment(DATA.meta);
    const current = L.currentItinerary(itinerary);
    const focusDay = current || (trip.phase === "upcoming" ? itinerary[0] : itinerary.at(-1));
    const dayNumber = Math.max(1, itinerary.findIndex((day) => day.id === focusDay.id) + 1);
    const timeline = L.travelTimeline(itinerary, new Date(), 8);
    const live = liveTravelState(focusDay);
    const nextAction = live.nextAction;
    const todayExpenses = (sharedSnapshot.expenses || []).filter((expense) => expense.incurredOn === focusDay.date);
    const expenseTotals = L.expenseLedgerTotals(todayExpenses);
    const recentChanges = L.recentSharedChanges(sharedSnapshot.itineraryOverrides, sharedSnapshot.expenses);
    const documents = documentCounts();
    const sync = commandSyncState();
    const writesDisabled = sync.key === "offline" || sync.key === "saving" || sharedDataLoading;
    const phaseLabel = trip.phase === "upcoming" ? "即将出发" : trip.phase === "traveling" ? "旅行进行中" : "旅行已结束";

    $("#view-home").innerHTML = `<div class="command-center">
      <header class="command-header">
        <div class="command-header-top"><span class="command-private-label">Travel Day Mode · Realtime Travel Status</span><span class="command-sync-chip ${sync.key}" role="status" aria-live="polite">${esc(sync.label)}</span></div>
        <p class="eyebrow">今日模式 · ${esc(L.formatDate(focusDay.date, { month: "numeric", day: "numeric", weekday: "short" }))} · ${esc(phaseLabel)}</p>
        <h1>${esc(DATA.meta.title)}</h1>
        <div class="command-travel-meta">
          <div><span>当前有效航班</span><strong>${esc(live.flight?.flightNumber || "暂无")}</strong><small>${live.flight ? `${esc(live.flight.date)} ${esc(live.flight.departureTime)} → ${esc(live.flight.arrivalTime)} · ${esc(labels[live.flight.status] || live.flight.status)} / ${esc(live.flight.actualStatus)}` : "等待后续航段"}</small></div>
          <div><span>当前住宿</span><strong>${esc(live.hotel?.nameZh || "待确认")}</strong><small>${live.hotel ? `${esc(live.hotel.checkIn)} → ${esc(live.hotel.checkOut)}` : esc(focusDay.theme)}</small></div>
          <div><span>当前交通</span><strong>Day ${esc(dayNumber)} · ${esc(focusDay.city)}</strong><small>${esc(focusDay.transport)}</small></div>
        </div>
      </header>

      <div class="section-head"><div><p class="eyebrow">Next Action</p><h2>下一步</h2></div><p>${esc(focusDay.city)}</p></div>
      <article class="card command-next-action">
        <div class="command-next-time"><span>时间</span><strong>${esc(nextAction?.timeLabel || "待定")}</strong></div>
        <div><p class="eyebrow">${esc(nextAction?.type || "下一事件")}</p><h3>${esc(nextAction?.title || "今日已无后续安排")}</h3><p class="command-location">地点 · ${esc(nextAction?.location || focusDay.city)}</p><p class="command-countdown">下一事件倒计时 · <strong id="next-action-countdown" data-next-at="${esc(nextAction?.at ?? "")}">${esc(L.travelCountdown(nextAction?.at))}</strong></p><div class="card-actions"><button class="button small primary" type="button" data-command-expense ${writesDisabled ? "disabled" : ""}>快速记账</button></div></div>
      </article>

      <div class="section-head"><div><p class="eyebrow">Trip Timeline</p><h2>旅行时间轴</h2></div><p>${timeline.length}项</p></div>
      <div class="card command-timeline">${timeline.length ? timeline.map((item) => `<div class="command-timeline-row ${nextAction?.type === "行程" && item.id === nextAction.id ? "next" : ""}"><time>${esc(item.dateLabel)}<br>${esc(item.timeLabel || "待定")}</time><div><strong>${esc(item.text)}</strong><small>${esc(commandPeriodLabel(item.period))}</small></div></div>`).join("") : '<p class="empty">暂无后续活动</p>'}</div>

      <div class="section-head"><div><p class="eyebrow">Expense Snapshot</p><h2>今日费用</h2></div><p>${todayExpenses.length}笔 · 不换汇</p></div>
      <div class="command-expense-snapshot">${EXPENSE_CURRENCIES.map((currency) => {
        const values = expenseTotals[currency];
        const spending = values.paid + values.pending;
        return `<article class="card command-expense-currency"><span>${currency}</span><strong>${esc(L.formatExpenseAmount(spending, currency))}</strong><small>已付 ${esc(L.formatExpenseAmount(values.paid, currency))}<br>待付 ${esc(L.formatExpenseAmount(values.pending, currency))} · 退款 ${esc(L.formatExpenseAmount(values.refunded, currency))}</small></article>`;
      }).join("")}</div>

      <div class="section-head"><div><p class="eyebrow">Recent Changes</p><h2>最近修改</h2></div><p>${recentChanges.length}项</p></div>
      <article class="card">${recentChanges.length ? `<div class="today-list">${recentChanges.map((change) => `<div class="today-row"><span>${esc(change.type)}</span><div><strong>${esc(change.title)}</strong><small>${esc(formatUpdated(change.updatedAt))}</small></div></div>`).join("")}</div>` : '<p class="empty">暂无共享修改</p>'}</article>

      <div class="section-head"><div><p class="eyebrow">Quick Actions</p><h2>快速操作</h2></div></div>
      <div class="command-quick-actions">
        <button class="button command-action" type="button" data-command-itinerary="${esc(focusDay.id)}" ${writesDisabled ? "disabled" : ""}><strong>编辑今日行程</strong><small>Day ${esc(dayNumber)}</small></button>
        <button class="button command-action" type="button" data-command-expense ${writesDisabled ? "disabled" : ""}><strong>记一笔</strong><small>共享费用</small></button>
        <button class="button command-action" type="button" data-command-upload ${writesDisabled ? "disabled" : ""}><strong>上传资料</strong><small>${documentsLoading ? "读取中" : `${esc(documents.total)}份文件`}</small></button>
        <button class="button command-action" type="button" data-go="documents"><strong>文件中心</strong><small>Private Bucket</small></button>
      </div>

      <div class="section-head"><div><p class="eyebrow">Sync Status</p><h2>同步状态</h2></div></div>
      <article class="card command-sync-panel">
        <div class="command-sync-summary"><span class="command-sync-chip ${sync.key}">${esc(sync.label)}</span><div><strong>${esc(sync.detail)}</strong><small>${sharedSnapshot.loadedAt ? `刷新于 ${esc(formatUpdated(sharedSnapshot.loadedAt))}` : "等待首次同步"}</small></div></div>
        <div class="command-sync-grid"><div><span>共享行程</span><strong>${sharedSnapshot.itineraryOverrides.length}天</strong></div><div><span>费用账本</span><strong>${sharedSnapshot.expenses.length}笔</strong></div><div><span>私人资料</span><strong>${documents.total}份</strong></div><div><span>同步方式</span><strong>手动刷新</strong></div></div>
        <div class="card-actions"><button class="button small" type="button" data-command-refresh ${navigator.onLine === false || sharedDataLoading ? "disabled" : ""}>${sharedDataLoading ? "刷新中" : "刷新共享数据"}</button></div>
      </article>
    </div>`;
  }

  function renderHome() {
    if (commandCenterActive()) return renderCommandCenter();
    const itinerary = itineraryDays();
    const trip = L.tripMoment(DATA.meta);
    const current = L.currentItinerary(itinerary);
    const focusDay = current || (trip.phase === "upcoming" ? itinerary[0] : itinerary.at(-1));
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
    const todayFlight = DATA.flights.find((flight) => flight.date === focusDay.date) || DATA.flights.find((flight) => flight.date > focusDay.date);
    const todayTasks = DATA.tasks.filter((task) => task.dueAt === focusDay.date && !(state.completedTasks[task.id] ?? task.completed));
    const focusWeather = weatherByLocation[weatherLocationIdForDay(focusDay)];
    const focusWeatherLabel = focusWeather ? `${focusWeather.temperature}°C · 降雨${focusWeather.rainProbability}%` : weatherLoading ? "正在获取" : "TBD";
    const emergencyContact = weatherLocationIdForDay(focusDay) === "kuala-lumpur" ? DATA.emergency.find((item) => item.id === "malaysia-emergency") : DATA.emergency.find((item) => item.id === "indonesia-police");
    const board = readinessBoard();
    const inbox = L.inboxCounts(DATA.travelInbox.items);
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

      <div class="section-head"><div><p class="eyebrow">Mobile travel actions</p><h2>${trip.phase === "traveling" ? "今日总览" : "下一站总览"}</h2></div><p>${esc(L.formatDate(focusDay.date))}</p></div>
      <div class="grid home-grid">
        <article class="card today-card">
          <div class="today-top"><div><p class="eyebrow">${trip.phase === "traveling" ? "Now" : "First day"}</p><h3 class="today-city">${esc(focusDay.city)}</h3></div><div class="weather">天气<br><strong>${esc(focusWeatherLabel)}</strong></div></div>
          <div class="today-list">
            <div class="today-row"><span>住宿</span><strong>${esc(todayHotel ? todayHotel.nameZh : "等待确认")}</strong></div>
            <div class="today-row"><span>交通</span><strong>${esc(focusDay.transport)}</strong></div>
            <div class="today-row"><span>重点</span><strong>${esc(focusDay.theme)}</strong></div>
            <div class="today-row"><span>必须完成</span><strong>${esc(todayTasks[0]?.title || state.notes.today || "暂无当天待办")}</strong></div>
          </div>
        </article>
        ${weatherOverviewCard()}
        <article class="card"><p class="eyebrow">Flight</p><h3>${esc(todayFlight?.flightNumber || "TBD")}</h3><div class="today-list"><div class="today-row"><span>出发</span><strong>${esc(todayFlight ? `${todayFlight.departureTime} · ${todayFlight.departureAirport}` : "TBD")}</strong></div><div class="today-row"><span>抵达</span><strong>${esc(todayFlight ? `${todayFlight.arrivalTime} · ${todayFlight.arrivalAirport}` : "TBD")}</strong></div><div class="today-row"><span>状态</span><strong>${esc(todayFlight?.status || "missing")}</strong></div></div></article>
        <article class="card"><p class="eyebrow">Hotel</p><h3>${esc(todayHotel?.nameZh || "住宿待确认")}</h3><div class="today-list"><div class="today-row"><span>入住</span><strong>${esc(todayHotel?.checkIn || "TBD")}</strong></div><div class="today-row"><span>退房</span><strong>${esc(todayHotel?.checkOut || "TBD")}</strong></div><div class="today-row"><span>状态</span><strong>${esc(todayHotel?.status || "missing")}</strong></div></div></article>
        <article class="card readiness-card"><p class="eyebrow">Checklist</p><h3>旅行清单</h3><div class="today-list"><div class="today-row"><span>完成</span><strong>${esc(departureStatus.completionRate)}%</strong></div><div class="today-row"><span>重要待办</span><strong>${esc(departureStatus.highPriorityRemaining)}项</strong></div><div class="today-row"><span>离线摘要</span><strong>${esc(OFFLINE_PACK.checklistSummary.total)}项</strong></div></div></article>
        <article class="card"><p class="eyebrow">Private storage</p><h3>📂 Document Center</h3><div class="today-list"><div class="today-row"><span>文件</span><strong>${documentService.authenticated ? `${esc(documentCounts().total)}份` : "登录后查看"}</strong></div><div class="today-row"><span>航班</span><strong>${documentService.authenticated ? `${esc(documentCounts().flights || 0)}份` : "私有"}</strong></div><div class="today-row"><span>酒店 / 入境</span><strong>${documentService.authenticated ? `${esc(documentCounts().hotels || 0)} / ${esc(documentCounts().immigration || 0)}` : "私有"}</strong></div></div><div class="card-actions"><button class="button small" type="button" data-go="documents">打开资料中心</button></div></article>
        <article class="card"><p class="eyebrow">Inbox</p><h3>Travel Inbox</h3><div class="today-list"><div class="today-row"><span>待处理</span><strong>${esc(inbox.pending)}项</strong></div><div class="today-row"><span>已确认</span><strong>${esc(inbox.verified)}项</strong></div><div class="today-row"><span>存储</span><strong>私人层</strong></div></div></article>
        <article class="card"><p class="eyebrow">Emergency</p><h3>${esc(emergencyContact?.label || "紧急信息")}</h3><div class="today-list"><div class="today-row"><span>地区</span><strong>${esc(emergencyContact?.region || "TBD")}</strong></div><div class="today-row"><span>电话</span><strong>${esc(emergencyContact?.phone || "TBD")}</strong></div><div class="today-row"><span>离线</span><strong>可用</strong></div></div></article>
      </div>

      <div class="section-head"><div><p class="eyebrow">Readiness board</p><h2>旅行准备状态</h2></div></div>
      <div class="grid home-grid">
        <article class="card"><p class="eyebrow">Status</p><h3>准备分类</h3><div class="today-list">${board.map((item) => `<div class="today-row"><span>${esc(item.label)}</span><strong>${esc(item.status)}</strong></div>`).join("")}</div></article>
        <article class="card"><p class="eyebrow">Document readiness</p><h3>资料准备状态</h3><div class="today-list">${DATA.documentReadiness.categories.map((item) => `<div class="today-row"><span>${esc(item.label)}</span><strong>${esc(item.status)}</strong></div>`).join("")}</div></article>
        <article class="card"><p class="eyebrow">Private-Public bridge</p><h3>资料状态</h3><div class="today-list">${DATA.documentReadiness.categories.map((item) => `<div class="today-row"><span>${esc(item.labelZh)}</span><strong>${esc(item.readyCount)}/${esc(item.totalCount)} ${esc(item.status)}</strong></div>`).join("")}</div></article>
        <article class="card"><p class="eyebrow">Offline pack</p><h3>离线包状态</h3><div class="today-list"><div class="today-row"><span>最后同步</span><strong>${esc(formatUpdated(OFFLINE_PACK.generatedAt))}</strong></div><div class="today-row"><span>包含</span><strong>航班 · 酒店 · 紧急信息 · 行程 · 清单摘要</strong></div><div class="today-row"><span>离线可用</span><strong>${OFFLINE_PACK.offlineReady ? "ready" : "missing"}</strong></div></div></article>
      </div>

      <div class="section-head"><div><p class="eyebrow">Next actions</p><h2>下一步行动</h2></div></div>
      <div class="grid home-grid">
        <article class="card">
          <p class="eyebrow">Checklist focus</p><h3>优先任务</h3>
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
    const itinerary = itineraryDays();
    const current = L.currentItinerary(itinerary);
    const canEdit = documentService.authenticated && sharedDataService.configured && Boolean(sharedSnapshot);
    const editDay = itinerary.find((day) => day.id === itineraryEdit?.value.dayId) || current || itinerary[0];
    const editButton = canEdit && editDay
      ? `<button class="button primary" type="button" data-command-itinerary="${esc(editDay.id)}">${itineraryEdit ? "继续编辑" : current ? "编辑今日行程" : "编辑首日行程"}</button>`
      : "";
    const refreshButton = documentService.authenticated && sharedDataService.configured
      ? `<button class="button" type="button" id="refresh-itinerary" ${sharedDataLoading ? "disabled" : ""}>${sharedDataLoading ? "正在同步" : "刷新共享行程"}</button>`
      : "";
    const activeFlight = liveTravelState(current || itinerary[0]).flight;
    $("#view-itinerary").innerHTML = `
      <header class="page-header"><p class="eyebrow">Daily story</p><h1>每日行程</h1><p>慢一点，把时间留给风景和彼此。所有待确认安排都会保留，不会因冲突被自动删除。</p><div class="header-actions"><button class="button" type="button" id="jump-today" ${current ? "" : "disabled"}>跳到今天</button>${editButton}${refreshButton}</div></header>
      ${activeFlight ? `<article class="alert warning"><div><h3>当前有效航班 · ${esc(activeFlight.flightNumber)}</h3><p>${esc(activeFlight.date)} ${esc(activeFlight.departureTime)} ${esc(activeFlight.departureAirport)} → ${esc(activeFlight.arrivalTime)} ${esc(activeFlight.arrivalAirport)} · 状态：${esc(activeFlight.actualStatus)}</p></div></article>` : ""}
      <div class="timeline">${itinerary.map((day, index) => dayCard(day, current?.id === day.id, index === 0 && !current, canEdit)).join("")}</div>
    `;
  }

  function dayCard(day, isToday, openFallback, canEdit) {
    const periods = ITINERARY_PERIODS.map(([period, label]) => [label, day.periods[period]]);
    const editing = itineraryEdit?.value.dayId === day.id;
    return `<article class="card day-card ${isToday ? "today" : ""}" id="${esc(day.id)}">
      <div class="day-cover">
        <img src="${esc(day.image)}" alt="${esc(day.imageAlt)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(fallbackImage("cover"))}'">
        <div class="day-cover-content"><div class="status-row"><time datetime="${esc(day.date)}">${esc(L.formatDate(day.date, { month: "long", day: "numeric", weekday: "long" }))}</time>${statusTag(day.status)}</div><h2>${esc(day.city)}</h2><p>${esc(day.theme)}</p></div>
      </div>
      <div class="day-body">${editing ? itineraryEditor() : `<details ${isToday || openFallback ? "open" : ""}><summary>查看当天安排</summary>
        <div class="period"><span>交通</span><div>${esc(day.transport)}</div></div>
        ${periods.map(([label, items]) => `<div class="period"><span>${label}</span><ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`).join("")}
        <div class="note-box"><strong>注意事项</strong><ul class="notes-list">${day.notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul></div>
        <div class="map-actions">${day.maps.map((map) => `<a class="button small" href="${mapUrl("apple", map.query)}" target="_blank" rel="noopener">Apple地图 · ${esc(map.label)}</a><a class="button small ghost" href="${mapUrl("google", map.query)}" target="_blank" rel="noopener">Google Maps</a>`).join("")}</div>
        ${canEdit && !itineraryEdit ? `<div class="itinerary-shared-actions">${day.overrideRevision ? `<span>共享版本 r${esc(day.overrideRevision)}</span>` : ""}<button class="button small primary" type="button" data-itinerary-edit="${esc(day.id)}">编辑当天</button></div>` : ""}
      </details>`}</div>
    </article>`;
  }

  function itineraryEditor() {
    const value = itineraryEdit.value;
    const periods = ITINERARY_PERIODS.map(([period, label]) => {
      const items = [...value.periods[period]].sort((a, b) => Number(a.status === "cancelled") - Number(b.status === "cancelled") || a.order - b.order);
      const active = items.filter((item) => item.status !== "cancelled");
      return `<section class="itinerary-edit-period"><div class="itinerary-edit-period-head"><strong>${label}</strong><button class="button small" type="button" data-itinerary-add="${period}">新增活动</button></div><div class="itinerary-activity-list">${items.length ? items.map((item) => {
        const cancelled = item.status === "cancelled";
        const position = active.findIndex((candidate) => candidate.id === item.id);
        return `<div class="itinerary-activity ${cancelled ? "cancelled" : ""}">
          <div class="itinerary-activity-fields"><label class="field">时间<input type="time" value="${esc(item.time || "")}" data-itinerary-field="time" data-period="${period}" data-activity-id="${esc(item.id)}" ${cancelled ? "disabled" : ""}></label><label class="field itinerary-activity-text">活动<input maxlength="300" value="${esc(item.text)}" data-itinerary-field="text" data-period="${period}" data-activity-id="${esc(item.id)}" ${cancelled ? "disabled" : "required"}></label></div>
          <div class="itinerary-activity-actions">${cancelled ? '<span class="status cancelled">已取消</span>' : `<button class="button small ghost" type="button" data-itinerary-move="up" data-period="${period}" data-activity-id="${esc(item.id)}" ${position <= 0 ? "disabled" : ""}>上移</button><button class="button small ghost" type="button" data-itinerary-move="down" data-period="${period}" data-activity-id="${esc(item.id)}" ${position >= active.length - 1 ? "disabled" : ""}>下移</button><button class="button small danger" type="button" data-itinerary-remove data-period="${period}" data-activity-id="${esc(item.id)}">删除</button>`}</div>
        </div>`;
      }).join("") : '<p class="muted itinerary-empty-period">暂无活动</p>'}</div></section>`;
    }).join("");
    return `<form id="itinerary-override-form" class="itinerary-editor" aria-busy="${itinerarySaving}">
      <div class="itinerary-editor-title"><div><strong>编辑当天行程</strong><span>${itineraryEdit.revision ? `共享版本 r${esc(itineraryEdit.revision)}` : "首次创建共享版本"}</span></div></div>
      ${itineraryConflict ? '<article class="alert critical"><div><h3>发现版本冲突</h3><p>对方已更新当天行程。当前草稿仍保留，请取消后重新编辑最新版本。</p></div></article>' : ""}
      <fieldset class="itinerary-editor-fields" ${itinerarySaving ? "disabled" : ""}>
        <div class="field-grid"><label class="field">主题<input maxlength="160" value="${esc(value.theme)}" data-itinerary-root-field="theme" required></label><label class="field">状态<select data-itinerary-root-field="status">${STATUSES.map((status) => `<option value="${status}" ${status === value.status ? "selected" : ""}>${status === "pending" ? "planned" : status}</option>`).join("")}</select></label></div>
        ${value.travelDate === "2026-07-22" ? '<div class="card-actions"><button class="button small" type="button" data-itinerary-preset="od306">填入 OD306 航班变更</button></div>' : ""}
        <div class="card-actions" role="group" aria-label="活动模板"><span class="muted">活动模板</span>${Object.entries(ITINERARY_ACTIVITY_TEMPLATES).map(([name, template]) => `<button class="button small ghost" type="button" data-itinerary-template="${name}">${esc(template.label)}</button>`).join("")}</div>
        <label class="field">交通摘要<textarea maxlength="1000" data-itinerary-root-field="transport">${esc(value.transport)}</textarea></label>
        ${periods}
        <label class="field">注意事项（每行一项）<textarea maxlength="10019" data-itinerary-notes>${esc(value.notes.join("\n"))}</textarea></label>
      </fieldset>
      <div class="itinerary-editor-actions"><button class="button primary" type="submit" ${itinerarySaving || itineraryConflict ? "disabled" : ""}>${itinerarySaving ? "保存中" : "保存共享行程"}</button><button class="button" type="button" data-itinerary-cancel>取消编辑</button></div>
    </form>`;
  }

  function startItineraryEdit(dayId) {
    if (!documentService.authenticated) return showToast("登录后才能编辑共享行程");
    if (!sharedSnapshot) { loadSharedSnapshot(); return showToast("共享行程正在加载"); }
    const baseDay = DATA.itinerary.find((day) => day.id === dayId);
    if (!baseDay) return showToast("当天行程不存在");
    const override = sharedSnapshot.itineraryOverrides.find((item) => item.dayId === dayId);
    itineraryEdit = { value: L.itineraryDraft(baseDay, override, DATA.meta.version), revision: override?.revision ?? null };
    itineraryConflict = false;
    renderItinerary();
    $(`#${dayId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelItineraryEdit() {
    itineraryEdit = null;
    itineraryConflict = false;
    renderItinerary();
  }

  function addItineraryActivity(period, text) {
    if (!itineraryEdit) return;
    itineraryActivitySequence += 1;
    const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : `activity-${Date.now().toString(36)}-${itineraryActivitySequence}`;
    itineraryEdit.value = L.addItineraryActivity(itineraryEdit.value, period, id);
    if (text) itineraryEdit.value = L.updateItineraryActivity(itineraryEdit.value, period, id, "text", text);
    renderItinerary();
    $(`[data-activity-id="${id}"][data-itinerary-field="text"]`)?.focus();
  }

  function applyActivityTemplate(name) {
    const template = ITINERARY_ACTIVITY_TEMPLATES[name];
    if (!template || !itineraryEdit) return;
    addItineraryActivity(template.period, template.text);
    showToast(`已添加${template.label}活动`);
  }

  function applyItineraryPreset(name) {
    if (name !== "od306" || !itineraryEdit || itineraryEdit.value.travelDate !== "2026-07-22") return;
    itineraryEdit.value = {
      ...itineraryEdit.value,
      city: "Kuala Lumpur → Bali",
      theme: "航班变更 · OD306",
      transport: "OD306 · 2026-07-22 09:00 Kuala Lumpur → Bali · 12:00 arrival",
      periods: {
        morning: [{ id: "od306-departure", time: "09:00", text: "OD306 Kuala Lumpur → Bali", order: 10, status: "planned" }],
        noon: [{ id: "od306-arrival", time: "12:00", text: "arrival", order: 10, status: "planned" }],
        afternoon: [{ id: "od306-check-in", time: null, text: "酒店入住", order: 10, status: "planned" }],
        evening: [{ id: "od306-dinner", time: null, text: "晚餐休息", order: 10, status: "planned" }]
      },
      notes: ["因错过原航班，改乘 OD306 前往巴厘岛。"],
      maps: [],
      status: "confirmed"
    };
    renderItinerary();
    showToast("已填入 OD306 航班变更，请确认后保存");
  }

  async function saveItineraryEdit() {
    if (!itineraryEdit || itinerarySaving) return;
    if (!documentService.authenticated) return showToast("登录后才能编辑共享行程");
    itinerarySaving = true;
    renderHome();
    renderItinerary();
    try {
      await sharedDataService.saveItineraryOverride(itineraryEdit.value, itineraryEdit.revision);
      itineraryEdit = null;
      itineraryConflict = false;
      const snapshot = await loadSharedSnapshot(true);
      showToast(snapshot ? "共享行程已保存" : "行程已保存，刷新失败");
    } catch (error) {
      if (error?.code === "CONFLICT") {
        itineraryConflict = true;
        await loadSharedSnapshot(true);
        showToast("对方已更新此行程，请取消后重新编辑");
      } else if (["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error?.code)) {
        await resetPrivateSession("登录已失效，请重新登录");
      } else showToast(error?.message || "共享行程保存失败");
    } finally {
      itinerarySaving = false;
      renderHome();
      renderItinerary();
    }
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
      <div class="booking-title"><div><p class="eyebrow">${esc(flight.airline)}</p><h3>${esc(flight.flightNumber)}</h3></div><div class="status-row">${statusTag(status)}${flightActualTag(actual)}</div></div>
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
      ${linkedDocumentBlock("flights", flight.id)}
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
      ${linkedDocumentBlock("hotels", hotel.id)}
      <div class="card-actions"><button class="button small" type="button" data-copy="${esc(hotel.address)}">复制地址</button><a class="button small ghost" href="${mapUrl("google", hotel.address)}" target="_blank" rel="noopener">Google Maps</a><a class="button small ghost" href="${mapUrl("apple", hotel.address)}" target="_blank" rel="noopener">Apple地图</a><a class="button small ghost ${phoneReady ? "" : "disabled"}" ${phoneReady ? `href="tel:${esc(hotel.phone)}"` : 'aria-disabled="true"'}>联系酒店</a></div>
    </article>`;
  }

  function documentRow(item) {
    const created = item.created_at ? formatUpdated(item.created_at) : "时间未知";
    const incomplete = incompleteDeletes.has(item.id);
    const deletable = documentService.canDelete(item);
    return `<div class="document-row"><div><strong>${esc(item.title)}</strong><span>${incomplete ? "文件已移除 · 元数据待重试" : `${esc(relatedItemName(item.related_item_id))} · ${esc(created)}`}</span></div><div class="document-row-actions">${incomplete ? "" : `<button class="button small" type="button" data-document-open="${esc(item.id)}">查看</button>`}${deletable ? `<button class="button small danger" type="button" data-document-delete="${esc(item.id)}">${incomplete ? "重试清理" : "删除"}</button>` : ""}</div></div>`;
  }

  function renderDocuments() {
    const container = $("#view-documents");
    if (!container) return;
    if (!documentService.configured) {
      container.innerHTML = `<header class="page-header"><p class="eyebrow">Private storage</p><h1>📂 Document Center</h1></header><article class="card"><h3>尚未配置</h3><p class="card-subtitle">请检查 Supabase publishable key 与 tripId。不得使用 secret 或 service_role key。</p><div class="card-actions"><button class="button small" type="button" data-go="home">返回首页</button></div></article>`;
      return;
    }
    if (privateSessionChecking || (documentService.hasSession && !documentService.authenticated)) {
      container.innerHTML = `<header class="page-header"><p class="eyebrow">Private storage</p><h1>📂 Document Center</h1></header><article class="card"><h3>正在验证登录</h3><p class="card-subtitle">私人内容会在真实 session 验证成功后加载。</p></article>`;
      return;
    }
    if (!documentService.authenticated) {
      container.innerHTML = `<header class="page-header"><p class="eyebrow">Private storage</p><h1>📂 Document Center</h1><p>私人文件只存入 Supabase Private Bucket；查看链接 60 秒后失效。</p></header>
        <form id="document-login" class="card document-auth"><h3>登录私人资料层</h3><label class="field">邮箱<input name="email" type="email" autocomplete="username" required></label><label class="field">密码<input name="password" type="password" autocomplete="current-password" required></label><button class="button primary" type="submit">登录</button><p class="card-subtitle">登录仅保留在当前浏览会话。GitHub 不保存账号、密码、文件或 signed URL。</p></form>`;
      return;
    }

    const counts = documentCounts();
    const categories = documentService.categories || Object.keys(documentCategoryLabels);
    container.innerHTML = `<header class="page-header"><p class="eyebrow">Private storage</p><h1>📂 Document Center</h1><p>${esc(documentService.user?.email || "已登录")} · Private Bucket · signed URL 60秒有效</p><div class="header-actions"><button class="button" type="button" id="refresh-documents">刷新</button><button class="button danger" type="button" id="document-logout">退出私人资料层</button><button class="button" type="button" data-go="home">返回首页</button></div></header>
      <article class="card"><p class="eyebrow">Overview</p><h3>${esc(counts.total)} 份私人文件</h3><div class="document-summary">${categories.map((category) => `<div><span>${esc(documentCategoryLabels[category] || category)}</span><strong>${esc(counts[category] || 0)}</strong></div>`).join("")}</div></article>
      <div class="section-head"><div><p class="eyebrow">Upload</p><h2>添加文件</h2></div><p>PDF / PNG / JPG · 最大10MB</p></div>
      <form id="document-upload" class="card">
        <div class="field-grid"><label class="field">分类<select id="document-category" name="category">${categories.map((category) => `<option value="${esc(category)}">${esc(documentCategoryLabels[category] || category)}</option>`).join("")}</select></label><label class="field">关联项目<select id="document-related" name="relatedItemId">${relatedOptions(categories[0])}</select></label></div>
        <label class="field" style="margin-top:10px">标题<input name="title" maxlength="160" placeholder="例如：3U3995 航班资料" required></label>
        <label class="field" style="margin-top:10px">文件<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required></label>
        <button class="button primary" type="submit" style="margin-top:12px">上传到私人 Bucket</button>
        <p class="card-subtitle" style="margin-top:10px">不要在标题中填写证件号、订单号、银行卡或密码；原文件不会进入 Git。</p>
      </form>
      <div class="section-head"><div><p class="eyebrow">Private registry</p><h2>文件中心</h2></div><p>${documentsLoading ? "读取中" : `${counts.total}份`}</p></div>
      <div class="grid document-centers">${categories.map((category) => {
        const rows = privateDocuments.filter((item) => item.category === category);
        const heading = category === "flights" ? "Flight Center" : category === "hotels" ? "Hotel Center" : category === "immigration" ? "Immigration Center" : `${documentCategoryLabels[category] || category}资料`;
        return `<article class="card"><p class="eyebrow">${esc(category)}</p><h3>${esc(heading)}</h3><div class="document-list">${rows.length ? rows.map(documentRow).join("") : `<p class="empty">${documentsLoading ? "正在读取" : "暂无文件"}</p>`}</div></article>`;
      }).join("")}</div>`;
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
    const ledger = renderExpenseLedger();
    $("#view-budget").innerHTML = `
      ${ledger || '<header class="page-header"><p class="eyebrow">Shared spending</p><h1>Budget Center</h1><p>登录后直接记录双方共享费用；预算计划继续保存在本机。所有金额均不自动换汇。</p></header>'}
      <div class="section-head"><div><p class="eyebrow">Plan</p><h2>预算计划</h2></div><p>本机保存</p></div>
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

  function renderExpenseLedger() {
    if (!documentService.authenticated || !sharedDataService.configured) return "";
    const expenses = sharedSnapshot?.expenses || [];
    const totals = L.expenseLedgerTotals(expenses);
    const body = !sharedSnapshot
      ? `<article class="card expense-ledger-state"><p>${sharedDataLoading ? "正在读取共享费用…" : "当前账号无法读取共享费用。"}</p></article>`
      : `
        <div class="expense-summary">${EXPENSE_CURRENCIES.map((currency) => `<article class="card expense-currency"><h3>${currency}</h3>${Object.entries(EXPENSE_STATUSES).map(([status, label]) => `<div class="expense-status-row"><span>${label}</span><strong>${esc(L.formatExpenseAmount(totals[currency][status], currency))}</strong></div>`).join("")}</article>`).join("")}</div>
        ${expenseEdit ? renderExpenseEditor() : ""}
        <div class="expense-list">${expenses.length ? expenses.map(expenseCard).join("") : '<article class="card expense-ledger-state"><p>暂无共享费用，新增第一笔后双方即可读取。</p></article>'}</div>
      `;
    return `<section class="expense-ledger" aria-labelledby="expense-ledger-title">
      <header class="page-header"><p class="eyebrow">Expense Ledger</p><h1 id="expense-ledger-title">Budget Center</h1><p>共享费用优先展示；按 CNY、MYR、IDR、USD 分别汇总，不自动换汇。</p><div class="header-actions"><button class="button" type="button" data-expense-refresh ${sharedDataLoading || expenseEdit ? "disabled" : ""}>${sharedDataLoading ? "同步中" : "刷新"}</button><button class="button primary" type="button" data-expense-create ${!sharedSnapshot || expenseEdit || sharedDataLoading ? "disabled" : ""}>新增费用</button></div></header>
      <p class="expense-ledger-note">账本只保存在登录保护的共享数据库中。</p>
      ${body}
    </section>`;
  }

  function expenseMemberLabel(userId) {
    if (!userId) return "付款成员已删除";
    const member = sharedSnapshot?.members.find((item) => item.userId === userId);
    if (!member) return "未知成员";
    return `${member.relativeLabel}${member.role === "owner" ? " · Owner" : ""}`;
  }

  function expenseMemberOptions(selectedUserId) {
    const options = (sharedSnapshot?.members || []).map((member) => `<option value="${esc(member.userId)}" ${member.userId === selectedUserId ? "selected" : ""}>${esc(expenseMemberLabel(member.userId))}</option>`).join("");
    return `${selectedUserId ? "" : '<option value="" selected disabled>请选择当前成员</option>'}${options}`;
  }

  function expenseCard(expense) {
    const canDelete = L.canDeleteExpense(expense, sharedSnapshot.currentUserId, sharedSnapshot.members);
    const deleting = expenseDeletingId === expense.id;
    return `<article class="card expense-row">
      <div class="expense-row-title"><div><p class="eyebrow">${esc(EXPENSE_CATEGORIES[expense.category] || expense.category)}</p><h3>${esc(expense.title)}</h3></div><span class="status ${esc(expense.paymentStatus)}">${esc(EXPENSE_STATUSES[expense.paymentStatus] || expense.paymentStatus)}</span></div>
      <strong class="expense-amount">${esc(L.formatExpenseAmount(expense.amountMinor, expense.currency))}</strong>
      <div class="expense-meta"><span>${esc(L.formatDate(expense.incurredOn, { year: "numeric", month: "numeric", day: "numeric" }))}</span><span>${esc(expenseMemberLabel(expense.paidByUserId))}支付</span><span>${esc(EXPENSE_SPLITS[expense.splitMode] || expense.splitMode)}</span><span>r${esc(expense.revision)}</span></div>
      ${expense.note ? `<p class="expense-note">${esc(expense.note)}</p>` : ""}
      <div class="expense-row-actions"><button class="button small" type="button" data-expense-edit="${esc(expense.id)}" ${expenseEdit || expenseSaving || deleting ? "disabled" : ""}>编辑</button>${canDelete ? `<button class="button small danger" type="button" data-expense-delete="${esc(expense.id)}" ${expenseEdit || expenseSaving || deleting ? "disabled" : ""}>${deleting ? "删除中" : "删除"}</button>` : ""}</div>
    </article>`;
  }

  function renderExpenseEditor() {
    const value = expenseEdit.value;
    const editLabel = expenseEdit.mode === "edit" ? `编辑费用 · r${expenseEdit.revision}` : "新增共享费用";
    return `<form id="expense-ledger-form" class="card expense-form" aria-busy="${expenseSaving}">
      <div class="expense-form-title"><div><p class="eyebrow">Ledger entry</p><h3>${esc(editLabel)}</h3></div></div>
      ${expenseConflict ? '<article class="alert critical"><div><h3>这笔费用已有更新</h3><p>当前草稿仍保留。请取消后重新打开最新版本；若为幂等冲突，请取消后新建。</p></div></article>' : ""}
      <fieldset class="expense-form-fields" ${expenseSaving ? "disabled" : ""}>
        <div class="card-actions" role="group" aria-label="快速分类">${QUICK_EXPENSE_CATEGORIES.map((category) => `<button class="button small ${category === value.category ? "primary" : ""}" type="button" data-expense-category="${category}">${esc(EXPENSE_CATEGORIES[category])}</button>`).join("")}</div>
        <div class="field-grid">
          <label class="field">费用名称<input name="title" maxlength="160" value="${esc(value.title)}" required></label>
          <label class="field">分类<select name="category" required>${Object.entries(EXPENSE_CATEGORIES).map(([category, label]) => `<option value="${category}" ${category === value.category ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
          <label class="field">金额<input name="amount" type="text" inputmode="decimal" maxlength="13" pattern="[0-9]{1,10}([.][0-9]{1,2})?" value="${esc(value.amount)}" placeholder="0.00" required></label>
          <label class="field">币种<select name="currency" required>${EXPENSE_CURRENCIES.map((currency) => `<option ${currency === value.currency ? "selected" : ""}>${currency}</option>`).join("")}</select></label>
          <label class="field">发生日期<input name="incurredOn" type="date" value="${esc(value.incurredOn)}" required></label>
          <label class="field">付款人<select name="paidByUserId" required>${expenseMemberOptions(value.paidByUserId)}</select></label>
          <label class="field">分摊方式<select name="splitMode" required>${Object.entries(EXPENSE_SPLITS).map(([mode, label]) => `<option value="${mode}" ${mode === value.splitMode ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
          <label class="field">支付状态<select name="paymentStatus" required>${Object.entries(EXPENSE_STATUSES).map(([status, label]) => `<option value="${status}" ${status === value.paymentStatus ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
        </div>
        <label class="field">备注（可选）<textarea name="note" maxlength="500">${esc(value.note)}</textarea></label>
      </fieldset>
      <div class="expense-form-actions"><button class="button primary" type="submit" ${expenseSaving || expenseConflict ? "disabled" : ""}>${expenseSaving ? "保存中" : "保存费用"}</button><button class="button" type="button" data-expense-cancel ${expenseSaving ? "disabled" : ""}>取消</button></div>
    </form>`;
  }

  function expenseClientRef() {
    expenseSequence += 1;
    const token = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${expenseSequence.toString(36)}`;
    return `expense-${token}`;
  }

  function startExpenseCreate() {
    if (!documentService.authenticated) return showToast("登录后才能新增共享费用");
    if (!sharedSnapshot) return showToast("共享费用正在加载");
    expenseEdit = {
      mode: "create",
      clientRef: expenseClientRef(),
      value: { title: "", category: "other", amount: "", currency: "CNY", incurredOn: L.dateKey(new Date()), paidByUserId: sharedSnapshot.currentUserId, splitMode: "shared", paymentStatus: "paid", note: "" }
    };
    expenseConflict = false;
    renderBudget();
    $("#expense-ledger-form input[name=title]")?.focus();
  }

  function startExpenseEdit(id) {
    if (!documentService.authenticated) return showToast("登录后才能编辑共享费用");
    const expense = sharedSnapshot?.expenses.find((item) => item.id === id);
    if (!expense) return showToast("费用不存在或正在刷新");
    expenseEdit = {
      mode: "edit",
      id: expense.id,
      revision: expense.revision,
      value: { title: expense.title, category: expense.category, amount: L.expenseAmountValue(expense.amountMinor), currency: expense.currency, incurredOn: expense.incurredOn, paidByUserId: expense.paidByUserId || "", splitMode: expense.splitMode, paymentStatus: expense.paymentStatus, note: expense.note || "" }
    };
    expenseConflict = false;
    renderBudget();
    $("#expense-ledger-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelExpenseEdit() {
    expenseEdit = null;
    expenseConflict = false;
    renderBudget();
  }

  async function saveExpenseEdit(form) {
    if (!expenseEdit || expenseSaving) return;
    if (!documentService.authenticated) return showToast("登录后才能保存共享费用");
    const fields = new FormData(form);
    const value = {
      title: String(fields.get("title") || "").trim(),
      category: String(fields.get("category") || ""),
      amount: String(fields.get("amount") || "").trim(),
      currency: String(fields.get("currency") || ""),
      incurredOn: String(fields.get("incurredOn") || ""),
      paidByUserId: String(fields.get("paidByUserId") || ""),
      splitMode: String(fields.get("splitMode") || ""),
      paymentStatus: String(fields.get("paymentStatus") || ""),
      note: String(fields.get("note") || "").trim()
    };
    const amountMinor = L.parseExpenseAmount(value.amount);
    if (amountMinor === null) return showToast("金额需大于 0，且最多保留两位小数");
    expenseEdit.value = value;
    const payload = { title: value.title, category: value.category, amountMinor, currency: value.currency, incurredOn: value.incurredOn, paidByUserId: value.paidByUserId, splitMode: value.splitMode, paymentStatus: value.paymentStatus, note: value.note || null };
    expenseSaving = true;
    renderHome();
    renderBudget();
    try {
      if (expenseEdit.mode === "create") await sharedDataService.createExpense({ clientRef: expenseEdit.clientRef, ...payload });
      else await sharedDataService.updateExpense(expenseEdit.id, payload, expenseEdit.revision);
      expenseEdit = null;
      expenseConflict = false;
      const snapshot = await loadSharedSnapshot(true);
      showToast(snapshot ? "共享费用已保存" : "费用已保存，刷新失败");
    } catch (error) {
      if (["CONFLICT", "IDEMPOTENCY_CONFLICT"].includes(error?.code)) {
        expenseConflict = true;
        await loadSharedSnapshot(true);
        showToast(error.code === "CONFLICT" ? "对方已更新此费用，请重新编辑" : "此新增标识对应了其他内容，请重新新建");
      } else if (["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error?.code)) {
        await resetPrivateSession("登录已失效，请重新登录");
      } else showToast(error?.message || "共享费用保存失败");
    } finally {
      expenseSaving = false;
      renderHome();
      renderBudget();
    }
  }

  async function deleteExpense(id) {
    if (expenseDeletingId) return;
    if (!documentService.authenticated) return showToast("登录后才能删除共享费用");
    const expense = sharedSnapshot?.expenses.find((item) => item.id === id);
    if (!expense) return showToast("费用不存在或正在刷新");
    if (!L.canDeleteExpense(expense, sharedSnapshot.currentUserId, sharedSnapshot.members)) return showToast("仅创建者或 Owner 可删除");
    if (!window.confirm(`确认删除“${expense.title}”？`)) return;
    expenseDeletingId = id;
    renderHome();
    renderBudget();
    try {
      await sharedDataService.deleteExpense(expense.id, expense.revision);
      await loadSharedSnapshot(true);
      showToast("共享费用已删除");
    } catch (error) {
      if (["CONFLICT", "NOT_FOUND"].includes(error?.code)) {
        await loadSharedSnapshot(true);
        showToast(error.code === "CONFLICT" ? "费用已被更新，请确认最新版本" : "费用已不存在");
      } else if (["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error?.code)) {
        await resetPrivateSession("登录已失效，请重新登录");
      } else showToast(error?.code === "FORBIDDEN" ? "仅创建者或 Owner 可删除" : (error?.message || "共享费用删除失败"));
    } finally {
      expenseDeletingId = null;
      renderHome();
      renderBudget();
    }
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
        <article class="card"><p class="eyebrow">Emergency</p><h3>紧急中心</h3><div class="today-list">${DATA.documentReadiness.emergencyStatus.map((item) => `<div class="today-row"><span>${esc(item.label)}</span><strong>${esc(item.status)}</strong></div>`).join("")}</div><div class="emergency-list">${DATA.emergency.map((contact) => `<div class="contact-row"><div><strong>${esc(contact.label)}</strong><span>${esc(contact.region)} · ${esc(contact.notes)}</span></div>${contact.phone === "TBD" ? '<b class="muted">TBD</b>' : `<a href="tel:${esc(contact.phone)}">${esc(contact.phone)}</a>`}</div>`).join("")}</div></article>
        <article class="card"><p class="eyebrow">Private storage</p><h3>📂 Document Center</h3><p class="card-subtitle">PDF、PNG、JPG 通过登录后访问的 Supabase Private Bucket 保存，不进入 GitHub Pages 文件。</p><div class="card-actions"><button class="button small" type="button" data-go="documents">打开资料中心</button></div></article>
        <article class="card"><p class="eyebrow">Session notes</p><h3>当前页面备注</h3><label class="field">今日提醒<textarea id="today-note" maxlength="500" placeholder="关闭或刷新页面后消失；不要填写敏感信息">${esc(state.notes.today)}</textarea></label><label class="field" style="margin-top:10px">临时备注<textarea id="temporary-note" maxlength="1000" placeholder="仅保留在当前页面内存">${esc(state.notes.temporary)}</textarea></label><button class="button primary" type="button" id="save-notes" style="margin-top:10px">暂存备注</button></article>
        <article class="card"><p class="eyebrow">Shared checklist</p><h3>共享身份与同步</h3><label class="field">这台手机的显示名称<input id="sync-user-name" maxlength="64" value="${esc(state.syncUserName || (checklistSync.userName === "TBD" ? "" : checklistSync.userName))}" placeholder="例如：张微明"></label><button class="button primary" type="button" id="save-sync-user" style="margin-top:10px">保存显示名称</button><p class="card-subtitle"><span id="sync-status-detail">${esc(syncStatusLabel())}</span><br>最后同步：<span id="last-synced-time">${esc(formatLastSynced(state.lastSyncedAt))}</span><br>仅 completed、completed_by、updated_at 进入云端。</p></article>
        <article class="card"><p class="eyebrow">Flight status</p><h3>航班实际状态</h3><div class="edit-list">${DATA.flights.map((flight) => { const local = state.flights[flight.id] || {}; return `<label class="edit-item"><strong>${esc(flight.flightNumber)} · ${esc(flight.date)}</strong><select class="field" data-flight="${esc(flight.id)}" data-field="actualStatus">${ACTUAL_FLIGHT_STATUSES.map((value) => `<option ${value === (local.actualStatus || flight.actualStatus) ? "selected" : ""}>${esc(value)}</option>`).join("")}</select><select class="field" style="margin-top:7px" data-flight="${esc(flight.id)}" data-field="status">${STATUSES.map((value) => `<option value="${value}" ${value === (local.status || flight.status) ? "selected" : ""}>${esc(labels[value])}</option>`).join("")}</select></label>`; }).join("")}</div></article>
        <article class="card"><p class="eyebrow">Hotel status</p><h3>酒店确认状态</h3><div class="edit-list">${DATA.hotels.map((hotel) => { const local = state.hotels[hotel.id] || {}; return `<label class="edit-item"><strong>${esc(hotel.nameZh)}</strong><select class="field" data-hotel="${esc(hotel.id)}" data-field="status">${STATUSES.map((value) => `<option value="${value}" ${value === (local.status || hotel.status) ? "selected" : ""}>${esc(labels[value])}</option>`).join("")}</select></label>`; }).join("")}</div></article>
        <article class="card"><p class="eyebrow">Local data</p><h3>本机修改数据</h3><p class="card-subtitle">基础版本：${esc(DATA.meta.version)}<br>本机修改：${esc(formatUpdated(state.updatedAt))}</p><div class="card-actions"><button class="button small" type="button" id="export-all">导出JSON</button><button class="button small" type="button" id="import-all">从JSON导入</button><button class="button small danger" type="button" id="reset-all">恢复基础数据</button></div></article>
        <article class="card"><p class="eyebrow">Privacy</p><h3>不可进入 Git 仓库</h3><ul class="privacy-list"><li>护照、身份证照片与完整号码</li><li>银行卡号、支付密码与CVV</li><li>完整预订编号和私人订单PDF</li><li>secret / service_role key 与长期文件链接</li></ul><p class="card-subtitle">私人原件仅进入 iCloud 私人层或登录保护的 Supabase Private Bucket；页面只生成短时 signed URL。</p></article>
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
    renderDocuments();
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
    if (name === "documents" && documentService.authenticated && !documentsLoading && !privateDocuments.length) loadPrivateDocuments();
  }

  function handleClick(event) {
    const nav = event.target.closest("[data-view]");
    if (nav) return switchView(nav.dataset.view);
    const go = event.target.closest("[data-go]");
    if (go) return switchView(go.dataset.go);
    const openDocument = event.target.closest("[data-document-open]");
    if (openDocument) return openPrivateDocument(openDocument.dataset.documentOpen);
    const deleteDocument = event.target.closest("[data-document-delete]");
    if (deleteDocument) return deletePrivateDocument(deleteDocument.dataset.documentDelete);
    const copy = event.target.closest("[data-copy]");
    if (copy) return copyText(copy.dataset.copy);
    const commandItinerary = event.target.closest("[data-command-itinerary]");
    if (commandItinerary) {
      if (navigator.onLine === false) return showToast("当前离线，只能查看已有数据");
      switchView("itinerary");
      if (itineraryEdit) $("#itinerary-override-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else startItineraryEdit(commandItinerary.dataset.commandItinerary);
      return;
    }
    if (event.target.closest("[data-command-expense]")) {
      if (navigator.onLine === false) return showToast("当前离线，只能查看已有数据");
      switchView("budget");
      if (expenseEdit) $("#expense-ledger-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else startExpenseCreate();
      return;
    }
    if (event.target.closest("[data-command-upload]")) {
      if (navigator.onLine === false) return showToast("当前离线，无法上传资料");
      switchView("documents");
      requestAnimationFrame(() => {
        $("#document-upload")?.scrollIntoView({ behavior: "smooth", block: "start" });
        $("#document-upload input[name=title]")?.focus();
      });
      return;
    }
    if (event.target.closest("[data-command-refresh]")) {
      if (navigator.onLine === false) return showToast("当前离线，只能查看已有数据");
      return Promise.all([loadSharedSnapshot(true), loadPrivateDocuments()]);
    }
    const expenseCategory = event.target.closest("[data-expense-category]");
    if (expenseCategory && expenseEdit) {
      expenseEdit.value = { ...expenseEdit.value, category: expenseCategory.dataset.expenseCategory };
      renderBudget();
      $("#expense-ledger-form input[name=amount]")?.focus();
      return;
    }
    if (event.target.closest("[data-expense-create]")) return startExpenseCreate();
    const editExpense = event.target.closest("[data-expense-edit]");
    if (editExpense) return startExpenseEdit(editExpense.dataset.expenseEdit);
    const removeExpense = event.target.closest("[data-expense-delete]");
    if (removeExpense) return deleteExpense(removeExpense.dataset.expenseDelete);
    if (event.target.closest("[data-expense-cancel]")) return cancelExpenseEdit();
    if (event.target.closest("[data-expense-refresh]")) return loadSharedSnapshot(true);
    const editItinerary = event.target.closest("[data-itinerary-edit]");
    if (editItinerary) return startItineraryEdit(editItinerary.dataset.itineraryEdit);
    const itineraryPreset = event.target.closest("[data-itinerary-preset]");
    if (itineraryPreset) return applyItineraryPreset(itineraryPreset.dataset.itineraryPreset);
    const itineraryTemplate = event.target.closest("[data-itinerary-template]");
    if (itineraryTemplate) return applyActivityTemplate(itineraryTemplate.dataset.itineraryTemplate);
    const addActivity = event.target.closest("[data-itinerary-add]");
    if (addActivity) return addItineraryActivity(addActivity.dataset.itineraryAdd);
    const moveActivity = event.target.closest("[data-itinerary-move]");
    if (moveActivity && itineraryEdit) {
      itineraryEdit.value = L.moveItineraryActivity(itineraryEdit.value, moveActivity.dataset.period, moveActivity.dataset.activityId, moveActivity.dataset.itineraryMove);
      renderItinerary();
      return;
    }
    const removeActivity = event.target.closest("[data-itinerary-remove]");
    if (removeActivity && itineraryEdit) {
      itineraryEdit.value = L.cancelItineraryActivity(itineraryEdit.value, removeActivity.dataset.period, removeActivity.dataset.activityId);
      renderItinerary();
      return;
    }
    if (event.target.closest("[data-itinerary-cancel]")) return cancelItineraryEdit();
    if (event.target.id === "refresh-itinerary") return loadSharedSnapshot(true);
    if (event.target.id === "jump-today") return $(".day-card.today")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (event.target.id === "filter-open") { checklistFilter = checklistFilter === "open" ? "all" : "open"; renderChecklist(); return; }
    if (event.target.id === "clear-checklist") return clearChecklist();
    if (event.target.id === "export-checklist") return exportChecklist();
    if (event.target.id === "import-checklist") return chooseImport("checklist");
    if (event.target.id === "save-notes") return saveNotes();
    if (event.target.id === "save-sync-user") return saveSyncUserName();
    if (event.target.id === "refresh-documents") return loadPrivateDocuments();
    if (event.target.id === "document-logout") return resetPrivateSession("已退出私人资料层");
    if (event.target.id === "export-all") { download("malaysia-bali-local-overrides.json", storage.export()); showToast("本机修改已导出"); return; }
    if (event.target.id === "import-all") return chooseImport("all");
    if (event.target.id === "reset-all") return resetAll();
  }

  function handleChange(event) {
    if (event.target.id === "document-category") {
      const related = $("#document-related");
      if (related) related.innerHTML = relatedOptions(event.target.value);
      return;
    }
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

  function handleInput(event) {
    if (expenseEdit && event.target.form?.id === "expense-ledger-form" && Object.prototype.hasOwnProperty.call(expenseEdit.value, event.target.name)) {
      expenseEdit.value = { ...expenseEdit.value, [event.target.name]: event.target.value };
      return;
    }
    if (!itineraryEdit) return;
    const rootField = event.target.dataset.itineraryRootField;
    if (["theme", "status", "transport"].includes(rootField)) {
      itineraryEdit.value = { ...itineraryEdit.value, [rootField]: event.target.value };
      return;
    }
    if (Object.prototype.hasOwnProperty.call(event.target.dataset, "itineraryNotes")) {
      itineraryEdit.value = { ...itineraryEdit.value, notes: event.target.value.split("\n").map((note) => note.trim()).filter(Boolean) };
      return;
    }
    const field = event.target.dataset.itineraryField;
    if (field) {
      const value = field === "time" ? event.target.value || null : event.target.value;
      itineraryEdit.value = L.updateItineraryActivity(itineraryEdit.value, event.target.dataset.period, event.target.dataset.activityId, field, value);
    }
  }

  async function handleSubmit(event) {
    if (event.target.id === "expense-ledger-form") {
      event.preventDefault();
      return saveExpenseEdit(event.target);
    }
    if (event.target.id === "itinerary-override-form") {
      event.preventDefault();
      return saveItineraryEdit();
    }
    if (event.target.id === "document-login") {
      event.preventDefault();
      const button = event.target.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const form = new FormData(event.target);
        await documentService.signIn(form.get("email"), form.get("password"));
        showToast("私人资料层登录成功");
        await Promise.all([loadPrivateDocuments(), loadSharedSnapshot(true)]);
      } catch (error) {
        showToast(error.message || "登录失败");
        button.disabled = false;
      }
      return;
    }
    if (event.target.id === "document-upload") {
      event.preventDefault();
      const button = event.target.querySelector("button[type=submit]");
      const runVersion = privateRequestVersion;
      button.disabled = true;
      pendingPrivateUploads += 1;
      renderHome();
      try {
        const form = new FormData(event.target);
        await documentService.upload({
          category: form.get("category"),
          title: form.get("title"),
          relatedItemId: form.get("relatedItemId"),
          file: form.get("file")
        });
        showToast("文件已保存到私人 Bucket");
        if (runVersion === privateRequestVersion) await loadPrivateDocuments();
      } catch (error) {
        if (runVersion === privateRequestVersion) {
          showToast(error.message || "文件上传失败");
          button.disabled = false;
        }
      } finally {
        if (runVersion === privateRequestVersion) {
          pendingPrivateUploads = Math.max(0, pendingPrivateUploads - 1);
          renderHome();
        }
      }
    }
  }

  async function openPrivateDocument(id) {
    const item = privateDocuments.find((document) => document.id === id);
    if (!item) return showToast("文件记录不存在");
    selectedPrivateDocument = item;
    const target = window.open("about:blank", "_blank");
    try {
      const url = await documentService.signedUrl(item);
      if (target) { target.opener = null; target.location = url; }
      else window.location.href = url;
    } catch (error) {
      target?.close();
      showToast(error.message || "文件打开失败");
    } finally {
      selectedPrivateDocument = null;
    }
  }

  async function deletePrivateDocument(id) {
    const item = privateDocuments.find((document) => document.id === id);
    if (!item) return;
    if (!documentService.canDelete(item)) return showToast("当前账号无权删除此文件");
    if (!window.confirm(`确认永久删除“${item.title}”？此操作不可恢复。`)) return;
    try {
      await documentService.remove(item);
      incompleteDeletes.delete(id);
      privateDocuments = privateDocuments.filter((document) => document.id !== id);
      renderHome();
      renderBookings();
      renderDocuments();
      showToast("私人文件已删除");
    } catch (error) {
      if (error.storageRemoved) {
        incompleteDeletes.add(id);
        renderHome();
        renderBookings();
        renderDocuments();
      }
      showToast(error.storageRemoved ? "删除未完成，可重试" : (error.message || "删除失败"));
    }
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
    renderHome();
    renderMore();
    showToast("备注仅保留在当前页面");
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

  function verifyPrivateSession() {
    if (!documentService.hasSession) {
      if (privateDocuments.length || selectedPrivateDocument) return resetPrivateSession("登录已失效，请重新登录");
      return Promise.resolve(null);
    }
    if (privateSessionRun) return privateSessionRun;
    privateRequestVersion += 1;
    privateSessionChecking = true;
    privateDocuments = [];
    selectedPrivateDocument = null;
    documentsLoading = false;
    documentsRun = null;
    renderAll();
    const run = documentService.getSession().then((session) => {
      if (!session) return resetPrivateSession("登录已失效，请重新登录");
      privateSessionChecking = false;
      renderAll();
      return Promise.all([loadPrivateDocuments(), loadSharedSnapshot(true)]);
    }).catch(() => null).finally(() => {
      if (privateSessionRun === run) privateSessionRun = null;
    });
    privateSessionRun = run;
    return run;
  }

  function setupNetwork() {
    const banner = $("#offline-banner");
    const update = () => {
      banner.hidden = navigator.onLine;
      if (navigator.onLine) {
        syncChecklistFromCloud();
        if (!Object.keys(weatherByLocation).length) loadWeatherData();
      } else checklistSync.markOffline();
      renderHome();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", verifyPrivateSession);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        selectedPrivateDocument = null;
        documentService.clearSignedUrls();
        revokeGeneratedObjectUrls();
      } else verifyPrivateSession();
    });
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
    document.addEventListener("input", handleInput);
    document.addEventListener("submit", handleSubmit);
    $("#import-file").addEventListener("change", handleImport);
    setupNetwork();
    window.setInterval(updateTravelCountdown, 30000);
    switchView("home", false);
    if (documentService.hasSession) verifyPrivateSession();
  }

  try {
    init();
  } catch (error) {
    console.error(error);
    $("#view-home").innerHTML = `<article class="card" style="margin-top:20px"><h1>页面加载遇到问题</h1><p>${esc(error.message)}</p><p>请确认 <code>data/trip-data.js</code> 存在后刷新页面。</p></article>`;
  }
})();
