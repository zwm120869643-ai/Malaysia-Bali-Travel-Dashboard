(function (root) {
  "use strict";

  const VALID_STATUS = new Set(["syncing", "synced", "offline"]);
  const PLACEHOLDER = /YOUR_|example|localhost/i;

  function jwtRole(key) {
    if (!key.startsWith("eyJ") || typeof root.atob !== "function") return "";
    try {
      const encoded = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      return JSON.parse(root.atob(payload)).role || "";
    } catch (_) {
      return "";
    }
  }

  function normalizeConfig(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const supabaseUrl = String(value.supabaseUrl || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
    const publishableKey = String(value.publishableKey || "").trim();
    const tripId = String(value.tripId || "").trim();
    const userName = cleanText(value.userName, 64) || "TBD";
    const safeKey = !/^sb_secret_/i.test(publishableKey)
      && !/service_role/i.test(publishableKey)
      && jwtRole(publishableKey) !== "service_role";
    const configured = value.enabled === true
      && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
      && publishableKey.length >= 20
      && !PLACEHOLDER.test(publishableKey)
      && safeKey
      && /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(tripId);
    return { configured, supabaseUrl, publishableKey, tripId, userName };
  }

  function cleanText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function normalizeChange(change) {
    if (!change || typeof change !== "object") return null;
    const taskId = cleanText(change.taskId, 120);
    const taskName = cleanText(change.taskName, 160);
    const completedBy = cleanText(change.completedBy, 64) || "shared-device";
    if (!/^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(taskId) || !taskName || typeof change.completed !== "boolean") return null;
    if (/(护照号|身份证号|银行卡号|订单号|CVV|密码)/i.test(`${taskName} ${completedBy}`)) return null;
    return { taskId, taskName, completed: change.completed, completedBy };
  }

  function create(rawConfig, requestImpl) {
    const config = normalizeConfig(rawConfig);
    const request = requestImpl || root.fetch?.bind(root);
    const listeners = new Set();
    let status = "offline";

    function setStatus(next) {
      if (!VALID_STATUS.has(next) || status === next) return;
      status = next;
      listeners.forEach((listener) => listener(status));
    }

    function headers(prefer) {
      const value = {
        apikey: config.publishableKey,
        "Content-Type": "application/json"
      };
      // Legacy anon keys are JWTs; new publishable keys authenticate through apikey only.
      if (config.publishableKey.startsWith("eyJ")) value.Authorization = `Bearer ${config.publishableKey}`;
      if (prefer) value.Prefer = prefer;
      return value;
    }

    async function call(path, options) {
      if (!config.configured || typeof request !== "function") throw new Error("sync disabled");
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
      try {
        const response = await request(`${config.supabaseUrl}/rest/v1/travel_checklist${path}`, { ...options, signal: controller?.signal });
        if (!response.ok) throw new Error(`sync http ${response.status || "error"}`);
        return response;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    async function push(changes) {
      const items = (Array.isArray(changes) ? changes : [changes]).map(normalizeChange).filter(Boolean);
      if (!config.configured || !items.length) { setStatus("offline"); return false; }
      setStatus("syncing");
      try {
        await call(`?on_conflict=trip_id,task_id`, {
          method: "POST",
          headers: headers("resolution=merge-duplicates,return=minimal"),
          body: JSON.stringify(items.map((item) => ({
            trip_id: config.tripId,
            task_id: item.taskId,
            task_name: item.taskName,
            completed: item.completed,
            completed_by: item.completedBy
          })))
        });
        setStatus("synced");
        return true;
      } catch (_) {
        setStatus("offline");
        return false;
      }
    }

    async function pull() {
      if (!config.configured) { setStatus("offline"); return null; }
      setStatus("syncing");
      try {
        const query = `?trip_id=eq.${encodeURIComponent(config.tripId)}&select=task_id,task_name,completed,completed_by,updated_at`;
        const response = await call(query, { method: "GET", headers: headers() });
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error("invalid sync response");
        setStatus("synced");
        return rows.filter((row) => row && typeof row.task_id === "string" && typeof row.completed === "boolean");
      } catch (_) {
        setStatus("offline");
        return null;
      }
    }

    return {
      configured: config.configured,
      userName: config.userName,
      get status() { return status; },
      subscribe(listener) { if (typeof listener === "function") listeners.add(listener); return () => listeners.delete(listener); },
      markOffline() { setStatus("offline"); },
      push,
      pull
    };
  }

  root.TravelChecklistSync = { create, normalizeConfig, normalizeChange };
})(typeof window !== "undefined" ? window : globalThis);
