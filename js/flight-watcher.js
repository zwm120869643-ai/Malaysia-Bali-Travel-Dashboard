(function (root) {
  "use strict";

  const CACHE_TTL_MS = 5 * 60 * 1000;
  const FLIGHT_NUMBER = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const STATUSES = new Set(["scheduled", "delayed", "en_route", "arrived", "cancelled", "unknown"]);

  function normalizeConfig(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const supabaseUrl = String(value.supabaseUrl || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
    const publishableKey = String(value.publishableKey || "").trim();
    return {
      configured: value.enabled === true && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) && publishableKey.length >= 20 && !/service_role|sb_secret_/i.test(publishableKey),
      supabaseUrl,
      publishableKey
    };
  }

  function normalizeInput(input) {
    const flightNumber = String(input?.flightNumber || "").toUpperCase().replace(/[\s-]+/g, "");
    const date = String(input?.date || "");
    if (!FLIGHT_NUMBER.test(flightNumber)) throw new Error("航班号格式不正确");
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!DATE.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("航班日期格式不正确");
    return { flightNumber, date };
  }

  function normalizeLeg(value) {
    if (!value || typeof value !== "object") throw new Error("航班时间响应无效");
    return {
      airport: String(value.airport || ""),
      scheduledTime: String(value.scheduledTime || ""),
      estimatedTime: String(value.estimatedTime || value.scheduledTime || ""),
      estimatedAt: value.estimatedAt && Number.isFinite(Date.parse(value.estimatedAt)) ? value.estimatedAt : null,
      terminal: value.terminal ? String(value.terminal) : null,
      gate: value.gate ? String(value.gate) : null
    };
  }

  function normalizeResponse(value, expected) {
    if (!value || typeof value !== "object" || value.flightNumber !== expected.flightNumber || value.date !== expected.date || !STATUSES.has(value.status)) throw new Error("航班查询响应无效");
    return {
      flightNumber: value.flightNumber,
      date: value.date,
      status: value.status,
      statusLabel: String(value.statusLabel || "状态未知"),
      statusDetail: String(value.statusDetail || ""),
      departure: normalizeLeg(value.departure),
      arrival: normalizeLeg(value.arrival),
      fetchedAt: String(value.fetchedAt || ""),
      source: String(value.source || ""),
      cached: Boolean(value.cached)
    };
  }

  function create(rawConfig, sessionProvider, requestImpl, nowImpl) {
    const config = normalizeConfig(rawConfig);
    const request = requestImpl || root.fetch?.bind(root);
    const provideSession = typeof sessionProvider === "function" ? sessionProvider : sessionProvider?.getSession?.bind(sessionProvider);
    const now = nowImpl || Date.now;
    const cache = new Map();

    async function query(input) {
      const value = normalizeInput(input);
      const key = `${value.flightNumber}:${value.date}`;
      const existing = cache.get(key);
      if (existing && existing.expiresAt > now()) return { ...existing.value, cached: true };
      if (!config.configured || typeof request !== "function") throw new Error("航班查询服务尚未配置");
      const session = await provideSession?.();
      const token = session?.access_token || config.publishableKey;
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
      try {
        const response = await request(`${config.supabaseUrl}/functions/v1/flight-watcher`, {
          method: "POST",
          headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(value),
          signal: controller?.signal,
          cache: "no-store"
        });
        let data = null;
        try { data = await response.json(); } catch (_) { /* Error below keeps the manual status. */ }
        if (!response.ok) {
          const error = new Error(data?.message || "航班网络查询失败，已保留手动状态");
          error.status = response.status;
          throw error;
        }
        const normalized = normalizeResponse(data, value);
        cache.set(key, { value: normalized, expiresAt: now() + CACHE_TTL_MS });
        return normalized;
      } catch (error) {
        if (error?.status) throw error;
        throw new Error("航班网络查询失败，已保留手动状态", { cause: error });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    return { configured: config.configured, query, clear() { cache.clear(); } };
  }

  root.TravelFlightWatcher = { create, normalizeConfig, cacheTtlMs: CACHE_TTL_MS };
})(typeof window !== "undefined" ? window : globalThis);
