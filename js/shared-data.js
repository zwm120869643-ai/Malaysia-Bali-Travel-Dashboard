(function (root) {
  "use strict";

  const ERROR_CODES = Object.freeze({
    AUTH_REQUIRED: "AUTH_REQUIRED",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    MEMBERSHIP_REQUIRED: "MEMBERSHIP_REQUIRED",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    CONFLICT: "CONFLICT",
    IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    NETWORK_ERROR: "NETWORK_ERROR"
  });
  const MEMBER_COLUMNS = "trip_id,user_id,role";
  const ITINERARY_COLUMNS = "trip_id,day_id,base_version,travel_date,city,theme,transport,periods,notes,maps,status,revision,updated_by,updated_at";
  const EXPENSE_COLUMNS = "id,trip_id,client_ref,title,category,amount_minor,currency,incurred_on,paid_by_user_id,split_mode,payment_status,note,revision,created_by,updated_by,created_at,updated_at";
  const PERIOD_NAMES = Object.freeze(["morning", "noon", "afternoon", "evening"]);
  const ITINERARY_STATUSES = new Set(["pending", "confirmed", "changed", "cancelled"]);
  const ITEM_STATUSES = new Set(["planned", "done", "cancelled"]);
  const EXPENSE_CATEGORIES = new Set(["flight", "hotel", "transport", "food", "sea", "attractions", "insurance", "connectivity", "shopping", "other"]);
  const CURRENCIES = new Set(["CNY", "MYR", "IDR", "USD"]);
  const SPLIT_MODES = new Set(["shared", "personal"]);
  const PAYMENT_STATUSES = new Set(["pending", "paid", "refunded"]);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
  const PLACEHOLDER = /YOUR_|example|localhost/i;
  const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const REQUEST_TIMEOUT = 8000;

  function serviceError(code, message, status, cause) {
    const error = new Error(message);
    error.code = code;
    if (status) error.status = status;
    if (cause) error.cause = cause;
    return error;
  }

  function validation(message) {
    throw serviceError(ERROR_CODES.VALIDATION_FAILED, message);
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function jwtRole(key) {
    if (!key.startsWith("eyJ") || typeof root.atob !== "function") return "";
    try {
      const encoded = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(root.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))).role || "";
    } catch (_) {
      return "";
    }
  }

  function normalizeConfig(raw) {
    const value = isRecord(raw) ? raw : {};
    const supabaseUrl = String(value.supabaseUrl || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
    const publishableKey = String(value.publishableKey || "").trim();
    const tripId = String(value.tripId || "").trim();
    const safeKey = !/^sb_secret_/i.test(publishableKey)
      && !/service_role/i.test(publishableKey)
      && jwtRole(publishableKey) !== "service_role";
    const configured = value.enabled === true
      && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
      && publishableKey.length >= 20
      && !PLACEHOLDER.test(publishableKey)
      && safeKey
      && /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(tripId);
    return { configured, supabaseUrl, publishableKey, tripId };
  }

  function assertKeys(value, allowed, label) {
    if (!isRecord(value)) validation(`${label}格式不正确`);
    const unknown = Object.keys(value).find((key) => !allowed.includes(key));
    if (unknown) validation(`${label}包含不允许的字段: ${unknown}`);
  }

  function requiredText(value, maxLength, label) {
    const text = String(value ?? "").trim();
    if (!text || text.length > maxLength) validation(`${label}格式不正确`);
    return text;
  }

  function optionalText(value, maxLength, label) {
    if (value === null || value === undefined || value === "") return null;
    const text = String(value).trim();
    if (text.length > maxLength) validation(`${label}过长`);
    return text || null;
  }

  function dateValue(value, label) {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) validation(`${label}格式不正确`);
    const parsed = new Date(`${text}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) validation(`${label}无效`);
    return text;
  }

  function positiveRevision(value) {
    if (!Number.isSafeInteger(value) || value < 1) validation("revision格式不正确");
    return value;
  }

  function uuidValue(value, label) {
    const text = String(value || "");
    if (!UUID.test(text)) validation(`${label}格式不正确`);
    return text;
  }

  function normalizePeriods(value) {
    if (!isRecord(value) || Object.keys(value).sort().join(",") !== [...PERIOD_NAMES].sort().join(",")) validation("行程时段格式不正确");
    const ids = new Set();
    const result = {};
    PERIOD_NAMES.forEach((period) => {
      const items = value[period];
      if (!Array.isArray(items) || items.length > 30) validation(`${period}时段格式不正确`);
      result[period] = items.map((item) => {
        assertKeys(item, ["id", "time", "text", "order", "status"], "行程项目");
        const id = requiredText(item.id, 64, "行程项目ID");
        if (!SAFE_ID.test(id) || ids.has(id)) validation("行程项目ID无效或重复");
        ids.add(id);
        const time = item.time === null ? null : String(item.time || "");
        if (time !== null && !TIME.test(time)) validation("行程时间格式不正确");
        if (!Number.isInteger(item.order) || item.order < 0 || item.order > 9990) validation("行程排序格式不正确");
        const status = String(item.status || "");
        if (!ITEM_STATUSES.has(status)) validation("行程项目状态不正确");
        return { id, time, text: requiredText(item.text, 300, "行程项目"), order: item.order, status };
      });
    });
    return result;
  }

  function normalizeNotes(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 20) validation("行程备注格式不正确");
    return value.map((note) => requiredText(note, 500, "行程备注"));
  }

  function normalizeMaps(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 20) validation("地图入口格式不正确");
    return value.map((item) => {
      assertKeys(item, ["label", "query"], "地图入口");
      return { label: requiredText(item.label, 80, "地图名称"), query: requiredText(item.query, 300, "地图查询") };
    });
  }

  function normalizeItineraryInput(input) {
    const allowed = ["dayId", "baseVersion", "travelDate", "city", "theme", "transport", "periods", "notes", "maps", "status"];
    assertKeys(input, allowed, "行程覆盖");
    const dayId = requiredText(input.dayId, 120, "行程日期ID");
    if (!SAFE_ID.test(dayId)) validation("行程日期ID格式不正确");
    const status = input.status === undefined ? "changed" : String(input.status);
    if (!ITINERARY_STATUSES.has(status)) validation("行程状态不正确");
    const transport = String(input.transport ?? "").trim();
    if (transport.length > 1000) validation("交通摘要过长");
    return {
      dayId,
      baseVersion: requiredText(input.baseVersion, 30, "基础版本"),
      travelDate: dateValue(input.travelDate, "行程日期"),
      city: requiredText(input.city, 120, "城市"),
      theme: requiredText(input.theme, 160, "行程主题"),
      transport,
      periods: normalizePeriods(input.periods),
      notes: normalizeNotes(input.notes),
      maps: normalizeMaps(input.maps),
      status
    };
  }

  function normalizeExpenseInput(input, currentUserId, partial, allowNullPayer) {
    const createFields = ["clientRef", "title", "category", "amountMinor", "currency", "incurredOn", "paidByUserId", "splitMode", "paymentStatus", "note"];
    const updateFields = createFields.filter((field) => field !== "clientRef");
    assertKeys(input, partial ? updateFields : createFields, partial ? "费用更新" : "费用");
    if (partial && !Object.keys(input).length) validation("费用更新不能为空");
    const result = {};
    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

    if (!partial || has("clientRef")) {
      const clientRef = requiredText(input.clientRef, 120, "费用幂等标识");
      if (!SAFE_ID.test(clientRef)) validation("费用幂等标识格式不正确");
      result.clientRef = clientRef;
    }
    if (!partial || has("title")) result.title = requiredText(input.title, 160, "费用名称");
    if (!partial || has("category")) {
      const category = String(input.category || "");
      if (!EXPENSE_CATEGORIES.has(category)) validation("费用分类不正确");
      result.category = category;
    }
    if (!partial || has("amountMinor")) {
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > 999999999999) validation("费用金额不正确");
      result.amountMinor = input.amountMinor;
    }
    if (!partial || has("currency")) {
      const currency = String(input.currency || "").toUpperCase();
      if (!CURRENCIES.has(currency)) validation("费用币种不正确");
      result.currency = currency;
    }
    if (!partial || has("incurredOn")) result.incurredOn = dateValue(input.incurredOn, "费用日期");
    if (!partial || has("paidByUserId")) {
      const paidByUserId = input.paidByUserId || currentUserId;
      result.paidByUserId = allowNullPayer && input.paidByUserId === null ? null : uuidValue(paidByUserId, "付款人");
    }
    if (!partial || has("splitMode")) {
      const splitMode = has("splitMode") ? String(input.splitMode) : "shared";
      if (!SPLIT_MODES.has(splitMode)) validation("分摊方式不正确");
      result.splitMode = splitMode;
    }
    if (!partial || has("paymentStatus")) {
      const paymentStatus = has("paymentStatus") ? String(input.paymentStatus) : "paid";
      if (!PAYMENT_STATUSES.has(paymentStatus)) validation("支付状态不正确");
      result.paymentStatus = paymentStatus;
    }
    if (!partial || has("note")) result.note = optionalText(input.note, 500, "费用备注");
    return result;
  }

  function itineraryBody(config, value) {
    return {
      trip_id: config.tripId,
      day_id: value.dayId,
      base_version: value.baseVersion,
      travel_date: value.travelDate,
      city: value.city,
      theme: value.theme,
      transport: value.transport,
      periods: value.periods,
      notes: value.notes,
      maps: value.maps,
      status: value.status
    };
  }

  function expenseBody(config, value) {
    const map = {
      clientRef: "client_ref",
      title: "title",
      category: "category",
      amountMinor: "amount_minor",
      currency: "currency",
      incurredOn: "incurred_on",
      paidByUserId: "paid_by_user_id",
      splitMode: "split_mode",
      paymentStatus: "payment_status",
      note: "note"
    };
    return Object.entries(value).reduce((body, [key, item]) => {
      body[map[key]] = item;
      return body;
    }, { trip_id: config.tripId });
  }

  function normalizeMemberRow(row, config, currentUserId) {
    if (!isRecord(row) || row.trip_id !== config.tripId || !UUID.test(String(row.user_id || "")) || !["owner", "member"].includes(row.role)) {
      throw serviceError(ERROR_CODES.NETWORK_ERROR, "成员数据响应无效");
    }
    return { tripId: row.trip_id, userId: row.user_id, role: row.role, relativeLabel: row.user_id === currentUserId ? "我" : "对方" };
  }

  function normalizeItineraryRow(row, config) {
    if (!isRecord(row) || row.trip_id !== config.tripId) throw serviceError(ERROR_CODES.NETWORK_ERROR, "行程数据响应无效");
    const value = normalizeItineraryInput({
      dayId: row.day_id,
      baseVersion: row.base_version,
      travelDate: row.travel_date,
      city: row.city,
      theme: row.theme,
      transport: row.transport,
      periods: row.periods,
      notes: row.notes,
      maps: row.maps,
      status: row.status
    });
    return { ...value, tripId: row.trip_id, revision: positiveRevision(Number(row.revision)), updatedBy: row.updated_by || null, updatedAt: String(row.updated_at || "") };
  }

  function normalizeExpenseRow(row, config) {
    if (!isRecord(row) || row.trip_id !== config.tripId || !UUID.test(String(row.id || ""))) throw serviceError(ERROR_CODES.NETWORK_ERROR, "费用数据响应无效");
    const value = normalizeExpenseInput({
      clientRef: row.client_ref,
      title: row.title,
      category: row.category,
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency || "").trim(),
      incurredOn: row.incurred_on,
      paidByUserId: row.paid_by_user_id,
      splitMode: row.split_mode,
      paymentStatus: row.payment_status,
      note: row.note
    }, "", false, true);
    return {
      id: row.id,
      tripId: row.trip_id,
      ...value,
      revision: positiveRevision(Number(row.revision)),
      createdBy: row.created_by || null,
      updatedBy: row.updated_by || null,
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || "")
    };
  }

  function latestTimestamp(rows) {
    return rows.reduce((latest, row) => {
      const time = Date.parse(row.updatedAt);
      return Number.isFinite(time) && time > latest.time ? { value: row.updatedAt, time } : latest;
    }, { value: null, time: -1 }).value;
  }

  function sameExpense(existing, input) {
    return existing.clientRef === input.clientRef
      && existing.title === input.title
      && existing.category === input.category
      && existing.amountMinor === input.amountMinor
      && existing.currency === input.currency
      && existing.incurredOn === input.incurredOn
      && existing.paidByUserId === input.paidByUserId
      && existing.splitMode === input.splitMode
      && existing.paymentStatus === input.paymentStatus
      && existing.note === input.note;
  }

  function create(rawConfig, sessionProvider, requestImpl) {
    const config = normalizeConfig(rawConfig);
    const provideSession = typeof sessionProvider === "function"
      ? sessionProvider
      : typeof sessionProvider?.getSession === "function"
        ? sessionProvider.getSession.bind(sessionProvider)
        : null;
    const request = requestImpl || root.fetch?.bind(root);
    const activeControllers = new Set();
    let disposed = false;
    let memberUserId = "";
    let loadRun = null;

    function available() {
      if (disposed) throw serviceError(ERROR_CODES.NETWORK_ERROR, "共享数据服务已关闭");
      if (!config.configured || typeof request !== "function") throw serviceError(ERROR_CODES.NETWORK_ERROR, "共享数据服务未配置");
    }

    async function currentSession() {
      available();
      if (!provideSession) throw serviceError(ERROR_CODES.AUTH_REQUIRED, "请先登录私人旅行数据");
      let session;
      try {
        session = await provideSession();
      } catch (cause) {
        if (cause?.status === 401 || /失效|expired|invalid|401/i.test(String(cause?.message || ""))) {
          memberUserId = "";
          throw serviceError(ERROR_CODES.SESSION_EXPIRED, "登录已失效，请重新登录", 401, cause);
        }
        throw serviceError(ERROR_CODES.NETWORK_ERROR, "无法验证登录状态", 0, cause);
      }
      if (!session?.access_token || !UUID.test(String(session?.user?.id || ""))) throw serviceError(ERROR_CODES.AUTH_REQUIRED, "请先登录私人旅行数据");
      if (memberUserId && memberUserId !== session.user.id) memberUserId = "";
      return { accessToken: session.access_token, userId: session.user.id };
    }

    async function rest(session, path, options) {
      available();
      const controller = typeof root.AbortController === "function" ? new root.AbortController() : null;
      if (controller) activeControllers.add(controller);
      const timeout = controller ? root.setTimeout(() => controller.abort(), REQUEST_TIMEOUT) : null;
      const headers = {
        apikey: config.publishableKey,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      };
      if (options?.prefer) headers.Prefer = options.prefer;
      try {
        const response = await request(`${config.supabaseUrl}/rest/v1/${path}`, {
          method: options?.method || "GET",
          headers,
          body: options?.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller?.signal
        });
        if (!response || typeof response.ok !== "boolean") throw serviceError(ERROR_CODES.NETWORK_ERROR, "共享数据响应无效");
        let data = null;
        try { data = await response.json(); } catch (_) { /* Some successful writes have no body. */ }
        if (response.ok) return data;
        const message = data?.message || data?.error || `HTTP ${response.status || "error"}`;
        if (response.status === 401) {
          memberUserId = "";
          throw serviceError(ERROR_CODES.SESSION_EXPIRED, "登录已失效，请重新登录", 401);
        }
        if (response.status === 403) throw serviceError(ERROR_CODES.FORBIDDEN, "当前账号无权执行此操作", 403);
        if (response.status === 404) throw serviceError(ERROR_CODES.NOT_FOUND, "共享记录不存在", 404);
        if (response.status === 409) throw serviceError(ERROR_CODES.CONFLICT, message, 409);
        if (response.status === 400 || response.status === 422) throw serviceError(ERROR_CODES.VALIDATION_FAILED, message, response.status);
        throw serviceError(ERROR_CODES.NETWORK_ERROR, "共享数据请求失败", response.status);
      } catch (error) {
        if (error?.code && Object.values(ERROR_CODES).includes(error.code)) throw error;
        throw serviceError(ERROR_CODES.NETWORK_ERROR, "共享数据网络错误", 0, error);
      } finally {
        if (timeout) root.clearTimeout(timeout);
        if (controller) activeControllers.delete(controller);
      }
    }

    async function requireMembership(session, members) {
      if (memberUserId === session.userId) return;
      let rows = members;
      if (!rows) {
        const query = `trip_members?trip_id=eq.${encodeURIComponent(config.tripId)}&user_id=eq.${encodeURIComponent(session.userId)}&select=${MEMBER_COLUMNS}&limit=1`;
        const data = await rest(session, query);
        rows = Array.isArray(data) ? data.map((row) => normalizeMemberRow(row, config, session.userId)) : [];
      }
      if (!rows.some((member) => member.userId === session.userId)) throw serviceError(ERROR_CODES.MEMBERSHIP_REQUIRED, "当前账号不属于此行程");
      memberUserId = session.userId;
    }

    async function load() {
      const session = await currentSession();
      const trip = encodeURIComponent(config.tripId);
      const [memberRows, itineraryRows, expenseRows] = await Promise.all([
        rest(session, `trip_members?trip_id=eq.${trip}&select=${MEMBER_COLUMNS}&order=role.asc`),
        rest(session, `travel_itinerary_overrides?trip_id=eq.${trip}&select=${ITINERARY_COLUMNS}&order=travel_date.asc`),
        rest(session, `travel_expenses?trip_id=eq.${trip}&select=${EXPENSE_COLUMNS}&order=incurred_on.desc,created_at.desc`)
      ]);
      if (!Array.isArray(memberRows) || !Array.isArray(itineraryRows) || !Array.isArray(expenseRows)) throw serviceError(ERROR_CODES.NETWORK_ERROR, "共享数据响应无效");
      const members = memberRows.map((row) => normalizeMemberRow(row, config, session.userId));
      await requireMembership(session, members);
      const itineraryOverrides = itineraryRows.map((row) => normalizeItineraryRow(row, config));
      const expenses = expenseRows.map((row) => normalizeExpenseRow(row, config));
      return {
        currentUserId: session.userId,
        members,
        itineraryOverrides,
        expenses,
        loadedAt: new Date().toISOString(),
        lastRemoteUpdatedAt: latestTimestamp([...itineraryOverrides, ...expenses])
      };
    }

    function loadSnapshot() {
      if (loadRun) return loadRun;
      const run = load();
      loadRun = run;
      run.then(() => { if (loadRun === run) loadRun = null; }, () => { if (loadRun === run) loadRun = null; });
      return run;
    }

    async function refresh() {
      if (loadRun) {
        const pending = loadRun;
        try { await pending; } catch (_) { /* Refresh starts a new attempt below. */ }
        if (loadRun === pending) loadRun = null;
      }
      return loadSnapshot();
    }

    function firstRow(data) {
      return Array.isArray(data) && data.length ? data[0] : null;
    }

    async function findItinerary(session, dayId) {
      const query = `travel_itinerary_overrides?trip_id=eq.${encodeURIComponent(config.tripId)}&day_id=eq.${encodeURIComponent(dayId)}&select=${ITINERARY_COLUMNS}&limit=1`;
      const row = firstRow(await rest(session, query));
      return row ? normalizeItineraryRow(row, config) : null;
    }

    async function findExpenseById(session, id) {
      const query = `travel_expenses?trip_id=eq.${encodeURIComponent(config.tripId)}&id=eq.${encodeURIComponent(id)}&select=${EXPENSE_COLUMNS}&limit=1`;
      const row = firstRow(await rest(session, query));
      return row ? normalizeExpenseRow(row, config) : null;
    }

    async function findExpenseByClientRef(session, clientRef) {
      const query = `travel_expenses?trip_id=eq.${encodeURIComponent(config.tripId)}&client_ref=eq.${encodeURIComponent(clientRef)}&select=${EXPENSE_COLUMNS}&limit=1`;
      const row = firstRow(await rest(session, query));
      return row ? normalizeExpenseRow(row, config) : null;
    }

    async function saveItineraryOverride(input, expectedRevision) {
      const value = normalizeItineraryInput(input);
      if (expectedRevision !== undefined && expectedRevision !== null) positiveRevision(expectedRevision);
      const session = await currentSession();
      await requireMembership(session);
      const trip = encodeURIComponent(config.tripId);
      const body = itineraryBody(config, value);
      if (expectedRevision === undefined || expectedRevision === null) {
        try {
          const rows = await rest(session, `travel_itinerary_overrides?select=${ITINERARY_COLUMNS}`, { method: "POST", prefer: "return=representation", body });
          const row = firstRow(rows);
          if (!row) throw serviceError(ERROR_CODES.NETWORK_ERROR, "行程保存响应无效");
          return normalizeItineraryRow(row, config);
        } catch (error) {
          if (error.status !== 409) throw error;
          if (await findItinerary(session, value.dayId)) throw serviceError(ERROR_CODES.CONFLICT, "当天行程已被另一台设备创建", 409);
          throw error;
        }
      }
      const query = `travel_itinerary_overrides?trip_id=eq.${trip}&day_id=eq.${encodeURIComponent(value.dayId)}&revision=eq.${expectedRevision}&select=${ITINERARY_COLUMNS}`;
      const row = firstRow(await rest(session, query, { method: "PATCH", prefer: "return=representation", body }));
      if (row) return normalizeItineraryRow(row, config);
      if (await findItinerary(session, value.dayId)) throw serviceError(ERROR_CODES.CONFLICT, "当天行程已被更新", 409);
      throw serviceError(ERROR_CODES.NOT_FOUND, "当天行程覆盖不存在", 404);
    }

    async function createExpense(input) {
      const session = await currentSession();
      await requireMembership(session);
      const value = normalizeExpenseInput(input, session.userId, false);
      const body = expenseBody(config, value);
      try {
        const rows = await rest(session, `travel_expenses?select=${EXPENSE_COLUMNS}`, { method: "POST", prefer: "return=representation", body });
        const row = firstRow(rows);
        if (!row) throw serviceError(ERROR_CODES.NETWORK_ERROR, "费用创建响应无效");
        return normalizeExpenseRow(row, config);
      } catch (error) {
        if (error.status !== 409) throw error;
        const existing = await findExpenseByClientRef(session, value.clientRef);
        if (existing && sameExpense(existing, value)) return existing;
        if (existing) throw serviceError(ERROR_CODES.IDEMPOTENCY_CONFLICT, "费用幂等标识已用于其他内容", 409);
        throw error;
      }
    }

    async function updateExpense(id, patch, expectedRevision) {
      const expenseId = uuidValue(id, "费用ID");
      positiveRevision(expectedRevision);
      const value = normalizeExpenseInput(patch, "", true);
      const session = await currentSession();
      await requireMembership(session);
      const query = `travel_expenses?trip_id=eq.${encodeURIComponent(config.tripId)}&id=eq.${encodeURIComponent(expenseId)}&revision=eq.${expectedRevision}&select=${EXPENSE_COLUMNS}`;
      const row = firstRow(await rest(session, query, { method: "PATCH", prefer: "return=representation", body: expenseBody(config, value) }));
      if (row) return normalizeExpenseRow(row, config);
      if (await findExpenseById(session, expenseId)) throw serviceError(ERROR_CODES.CONFLICT, "费用已被更新", 409);
      throw serviceError(ERROR_CODES.NOT_FOUND, "费用不存在", 404);
    }

    async function deleteExpense(id, expectedRevision) {
      const expenseId = uuidValue(id, "费用ID");
      positiveRevision(expectedRevision);
      const session = await currentSession();
      await requireMembership(session);
      const query = `travel_expenses?trip_id=eq.${encodeURIComponent(config.tripId)}&id=eq.${encodeURIComponent(expenseId)}&revision=eq.${expectedRevision}&select=id`;
      const row = firstRow(await rest(session, query, { method: "DELETE", prefer: "return=representation" }));
      if (row) return true;
      if (await findExpenseById(session, expenseId)) throw serviceError(ERROR_CODES.CONFLICT, "费用已被更新", 409);
      throw serviceError(ERROR_CODES.NOT_FOUND, "费用不存在", 404);
    }

    function dispose() {
      disposed = true;
      memberUserId = "";
      loadRun = null;
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
    }

    return {
      configured: config.configured,
      loadSnapshot,
      refresh,
      saveItineraryOverride,
      createExpense,
      updateExpense,
      deleteExpense,
      dispose
    };
  }

  root.TravelSharedData = { create, normalizeConfig, errorCodes: ERROR_CODES };
})(typeof window !== "undefined" ? window : globalThis);
