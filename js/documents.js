(function (root) {
  "use strict";

  const SESSION_KEY = "malaysia-bali-document-session-v1";
  const BUCKET = "travel-documents";
  const SIGNED_URL_SECONDS = 60;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MIME_EXTENSIONS = Object.freeze({
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg"
  });
  const CATEGORIES = Object.freeze(["flights", "hotels", "immigration", "transport", "activities", "finance"]);
  const PLACEHOLDER = /YOUR_|example|localhost/i;

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
    const value = raw && typeof raw === "object" ? raw : {};
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
      && /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(tripId);
    return { configured, supabaseUrl, publishableKey, tripId };
  }

  function create(rawConfig, requestImpl, storageImpl, supabaseImpl) {
    const config = normalizeConfig(rawConfig);
    const request = requestImpl || root.fetch?.bind(root);
    const sessionStore = storageImpl || root.sessionStorage;
    const supabase = supabaseImpl || root.supabaseClient;
    const projectRef = config.supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co$/i)?.[1];
    const supabaseSessionKey = projectRef ? `sb-${projectRef}-auth-token` : "";
    let session = readSession();
    let sessionVerified = false;
    let membershipRole = null;
    let invalidHandler = null;
    const signedUrls = new Set();

    function readSession() {
      try {
        const parsed = JSON.parse(sessionStore?.getItem(SESSION_KEY) || "null");
        if (!parsed?.access_token || !parsed?.user?.id) return null;
        return parsed;
      } catch (_) {
        return null;
      }
    }

    function saveSession(value, verified) {
      session = value;
      sessionVerified = Boolean(value && verified);
      try {
        if (value) sessionStore?.setItem(SESSION_KEY, JSON.stringify(value));
        else {
          sessionStore?.removeItem(SESSION_KEY);
          if (supabaseSessionKey) sessionStore?.removeItem(supabaseSessionKey);
        }
      } catch (_) { /* Session remains in memory for this page. */ }
    }

    function sessionPayload(data) {
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
        user: { id: data.user.id, email: data.user.email || "" }
      };
    }

    async function reset(reason) {
      const accessToken = session?.access_token;
      saveSession(null, false);
      membershipRole = null;
      signedUrls.clear();
      try {
        if (supabase?.auth?.signOut) await supabase.auth.signOut({ scope: "local" });
        else if (accessToken && config.configured && typeof request === "function") {
          await request(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
            method: "POST",
            headers: { ...publicHeaders(), Authorization: `Bearer ${accessToken}` }
          });
        }
      } catch (_) { /* Local cleanup above must survive sign-out failure. */ }
      return reason;
    }

    async function invalidate(reason) {
      if (invalidHandler) return invalidHandler(reason);
      return reset(reason);
    }

    async function jsonResponse(response) {
      let data = null;
      try { data = await response.json(); } catch (_) { /* Some successful calls return no body. */ }
      if (!response.ok) {
        if (response.status === 401) await invalidate("登录已失效，请重新登录");
        const error = new Error(data?.msg || data?.message || data?.error_description || data?.error || `HTTP ${response.status || "error"}`);
        error.status = response.status;
        throw error;
      }
      return data;
    }

    function publicHeaders() {
      return { apikey: config.publishableKey, "Content-Type": "application/json" };
    }

    async function refreshIfNeeded() {
      if (!session) throw new Error("请先登录私人资料中心");
      if (!session.expires_at || session.expires_at > Math.floor(Date.now() / 1000) + 30) return;
      if (!session.refresh_token) {
        await invalidate("登录已失效，请重新登录");
        throw new Error("登录已失效，请重新登录");
      }
      try {
        const response = await request(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: publicHeaders(),
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        const data = await jsonResponse(response);
        if (!data?.access_token || !data?.user?.id) throw new Error("登录响应不完整");
        membershipRole = null;
        saveSession(sessionPayload(data), true);
      } catch (error) {
        if (session) await invalidate("登录已失效，请重新登录");
        if (error.message === "登录已失效，请重新登录") throw error;
        throw new Error("登录已失效，请重新登录", { cause: error });
      }
    }

    async function authHeaders(contentType) {
      if (!config.configured || typeof request !== "function") throw new Error("私人资料服务尚未配置");
      await refreshIfNeeded();
      const headers = { apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}` };
      if (contentType) headers["Content-Type"] = contentType;
      return headers;
    }

    function encodePath(path) {
      return String(path).split("/").map(encodeURIComponent).join("/");
    }

    function newId() {
      if (root.crypto?.randomUUID) return root.crypto.randomUUID();
      throw new Error("当前浏览器不支持安全随机文件标识");
    }

    function validateUpload(input) {
      const file = input?.file;
      const category = String(input?.category || "").toLowerCase();
      const title = String(input?.title || "").trim().slice(0, 160);
      if (!session) throw new Error("请先登录私人资料中心");
      if (!file || !MIME_EXTENSIONS[file.type]) throw new Error("只支持 PDF、PNG、JPG");
      if (!Number.isFinite(Number(file.size)) || file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error("文件必须小于 10MB");
      if (!CATEGORIES.includes(category)) throw new Error("文件分类不正确");
      if (!title) throw new Error("请填写文件标题");
      if (/(订单号|护照号|身份证号|银行卡号|CVV|密码)\s*[:：]?\s*[A-Z0-9-]{4,}/i.test(title)) throw new Error("标题不能包含证件、订单或支付号码");
      const relatedItemId = String(input.relatedItemId || "").trim().slice(0, 120) || null;
      return { file, category, title, relatedItemId };
    }

    async function removeStoragePath(path) {
      const response = await request(`${config.supabaseUrl}/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: await authHeaders("application/json"),
        body: JSON.stringify({ prefixes: [path] })
      });
      try {
        await jsonResponse(response);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }

    async function signIn(email, password) {
      if (!config.configured || typeof request !== "function") throw new Error("私人资料服务尚未配置");
      const response = await request(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: publicHeaders(),
        body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") })
      });
      const data = await jsonResponse(response);
      if (!data?.access_token || !data?.user?.id) throw new Error("登录响应不完整");
      membershipRole = null;
      saveSession(sessionPayload(data), true);
      return session.user;
    }

    async function getSession() {
      if (!session) return null;
      try {
        await refreshIfNeeded();
        const response = await request(`${config.supabaseUrl}/auth/v1/user`, {
          method: "GET",
          headers: { ...publicHeaders(), Authorization: `Bearer ${session.access_token}` }
        });
        const user = await jsonResponse(response);
        if (!user?.id) throw new Error("登录会话无效");
        if (session.user?.id !== user.id) membershipRole = null;
        session.user = { id: user.id, email: user.email || session.user?.email || "" };
        saveSession(session, true);
        return { access_token: session.access_token, user: session.user };
      } catch (error) {
        if (session) await invalidate("登录已失效，请重新登录");
        throw error;
      }
    }

    function signOut() {
      return invalidate("SIGNED_OUT");
    }

    async function loadMembership() {
      if (membershipRole) return membershipRole;
      const query = `?trip_id=eq.${encodeURIComponent(config.tripId)}&user_id=eq.${encodeURIComponent(session.user.id)}&select=role&limit=1`;
      const response = await request(`${config.supabaseUrl}/rest/v1/trip_members${query}`, {
        method: "GET",
        headers: await authHeaders("application/json")
      });
      const rows = await jsonResponse(response);
      const role = Array.isArray(rows) ? rows[0]?.role : null;
      if (!["owner", "member"].includes(role)) throw new Error("当前账号不属于此行程");
      membershipRole = role;
      return role;
    }

    async function list() {
      await loadMembership();
      const query = `?trip_id=eq.${encodeURIComponent(config.tripId)}&select=id,trip_id,category,title,storage_path,status,uploaded_by,related_item_id,created_at&order=created_at.desc`;
      const response = await request(`${config.supabaseUrl}/rest/v1/travel_documents${query}`, {
        method: "GET",
        headers: await authHeaders("application/json")
      });
      const rows = await jsonResponse(response);
      return Array.isArray(rows) ? rows : [];
    }

    async function upload(input) {
      const value = validateUpload(input);
      await loadMembership();
      const id = newId();
      const path = `${config.tripId}/${session.user.id}/${id}.${MIME_EXTENSIONS[value.file.type]}`;
      const storageResponse = await request(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodePath(path)}`, {
        method: "POST",
        headers: { ...(await authHeaders(value.file.type)), "x-upsert": "false", "cache-control": "max-age=0" },
        body: value.file
      });
      await jsonResponse(storageResponse);

      try {
        const metadataResponse = await request(`${config.supabaseUrl}/rest/v1/travel_documents`, {
          method: "POST",
          headers: { ...(await authHeaders("application/json")), Prefer: "return=representation" },
          body: JSON.stringify({
            id,
            trip_id: config.tripId,
            category: value.category,
            title: value.title,
            storage_path: path,
            status: "verified",
            uploaded_by: session.user.id,
            related_item_id: value.relatedItemId
          })
        });
        const rows = await jsonResponse(metadataResponse);
        return Array.isArray(rows) ? rows[0] : rows;
      } catch (error) {
        try { await removeStoragePath(path); } catch (_) { /* Keep the original metadata error. */ }
        throw error;
      }
    }

    async function signedUrl(document) {
      if (!document?.storage_path) throw new Error("文件路径无效");
      await loadMembership();
      const response = await request(`${config.supabaseUrl}/storage/v1/object/sign/${BUCKET}/${encodePath(document.storage_path)}`, {
        method: "POST",
        headers: await authHeaders("application/json"),
        body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS })
      });
      const data = await jsonResponse(response);
      const signedPath = data?.signedURL || data?.signedUrl;
      if (!signedPath) throw new Error("无法生成临时查看地址");
      const url = signedPath.startsWith("http") ? signedPath : `${config.supabaseUrl}/storage/v1${signedPath}`;
      signedUrls.add(url);
      return url;
    }

    async function removeDocument(document) {
      if (!document?.id) throw new Error("文件记录无效");
      await loadMembership();
      const query = `?id=eq.${encodeURIComponent(document.id)}&trip_id=eq.${encodeURIComponent(config.tripId)}`;
      const metadataResponse = await request(`${config.supabaseUrl}/rest/v1/travel_documents${query}&select=id,storage_path`, {
        method: "GET",
        headers: await authHeaders("application/json")
      });
      const rows = await jsonResponse(metadataResponse);
      if (!Array.isArray(rows) || !rows.length) return true;
      await removeStoragePath(rows[0].storage_path);
      try {
        const response = await request(`${config.supabaseUrl}/rest/v1/travel_documents${query}`, {
          method: "DELETE",
          headers: await authHeaders("application/json")
        });
        await jsonResponse(response);
      } catch (error) {
        if (error.status === 401) throw error;
        const incomplete = new Error("删除未完成，可重试", { cause: error });
        incomplete.code = "metadata-delete-failed";
        incomplete.storageRemoved = true;
        throw incomplete;
      }
      return true;
    }

    if (supabase?.auth?.onAuthStateChange) {
      supabase.auth.onAuthStateChange((event, nextSession) => {
        if (event === "SIGNED_OUT" || (!nextSession && sessionVerified)) invalidate("登录已失效，请重新登录");
      });
    }

    return {
      configured: config.configured,
      categories: CATEGORIES,
      get authenticated() { return Boolean(sessionVerified && session?.access_token && session?.user?.id); },
      get hasSession() { return Boolean(session?.access_token && session?.user?.id); },
      get user() { return sessionVerified ? session?.user || null : null; },
      get role() { return membershipRole; },
      get signedUrlCount() { return signedUrls.size; },
      canDelete(document) {
        return membershipRole === "owner" || (membershipRole === "member" && document?.uploaded_by === session?.user?.id);
      },
      onInvalid(listener) { invalidHandler = typeof listener === "function" ? listener : null; },
      reset,
      getSession,
      clearSignedUrls() { signedUrls.clear(); },
      signIn,
      signOut,
      list,
      upload,
      signedUrl,
      remove: removeDocument
    };
  }

  root.TravelDocuments = { create, normalizeConfig, categories: CATEGORIES, maxFileSize: MAX_FILE_SIZE, signedUrlSeconds: SIGNED_URL_SECONDS };
})(typeof window !== "undefined" ? window : globalThis);
