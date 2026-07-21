const CACHE_TTL_MS = 5 * 60 * 1000;
const FLIGHT_NUMBER = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CARRIER_ALIASES: Record<string, string> = { OD: "MXD", "3U": "CSC" };
const cache = new Map<string, { expiresAt: number; value: FlightStatus }>();

type FlightLeg = {
  airport: string;
  scheduledTime: string;
  estimatedTime: string;
  estimatedAt: string | null;
  terminal: string | null;
  gate: string | null;
};

type FlightStatus = {
  flightNumber: string;
  date: string;
  status: "scheduled" | "delayed" | "en_route" | "arrived" | "cancelled" | "unknown";
  statusLabel: string;
  statusDetail: string;
  departure: FlightLeg;
  arrival: FlightLeg;
  fetchedAt: string;
  source: "FlightStats public tracker";
  cached: boolean;
};

function cors(origin: string | null) {
  const allowed = origin === "https://zwm120869643-ai.github.io" || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "https://zwm120869643-ai.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin"
  };
}

function json(body: unknown, status: number, origin: string | null, cacheHit = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Flight-Cache": cacheHit ? "HIT" : "MISS"
    }
  });
}

function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function authenticatedUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return claims.role === "authenticated" && UUID.test(String(claims.sub || "")) && Number(claims.exp) > Date.now() / 1000;
  } catch (_) {
    return false;
  }
}

function extractFlight(html: string) {
  const match = html.match(/__NEXT_DATA__\s*=\s*({.*?});__NEXT_LOADED_PAGES__/s);
  if (!match) throw new Error("公开航班页面格式已变化");
  const data = JSON.parse(match[1]);
  return data?.props?.initialState?.flightTracker?.flight || null;
}

function flightState(flight: any): FlightStatus["status"] {
  const status = String(flight?.status?.status || "").toLowerCase();
  const detail = String(flight?.status?.statusDescription || "").toLowerCase();
  if (/cancel/.test(status) || flight?.flightNote?.canceled) return "cancelled";
  if (/arriv|landed/.test(status) || flight?.flightNote?.landed) return "arrived";
  if (/active|en route|departed/.test(status) || (flight?.flightNote?.hasDepartedGate && !flight?.flightNote?.landed)) return "en_route";
  if (/delay/.test(status) || /delay/.test(detail) || Number(flight?.status?.delayStatus?.minutes) > 0) return "delayed";
  if (/schedul|on time/.test(status) || flight?.isScheduled) return "scheduled";
  return "unknown";
}

function statusLabel(status: FlightStatus["status"]) {
  return ({ scheduled: "正常", delayed: "延误", en_route: "飞行中", arrived: "已抵达", cancelled: "已取消", unknown: "等待确认" })[status];
}

function leg(airport: any, schedule: any, kind: "Departure" | "Arrival"): FlightLeg {
  const scheduledTime = String(airport?.times?.scheduled?.time24 || "");
  const estimatedTime = String(airport?.times?.estimatedActual?.time24 || scheduledTime);
  const estimatedAt = schedule?.[`estimatedActual${kind}UTC`] || schedule?.[`scheduled${kind}UTC`] || null;
  return {
    airport: String(airport?.iata || airport?.fs || ""),
    scheduledTime,
    estimatedTime,
    estimatedAt: estimatedAt && Number.isFinite(Date.parse(estimatedAt)) ? estimatedAt : null,
    terminal: airport?.terminal ? String(airport.terminal) : null,
    gate: airport?.gate ? String(airport.gate) : null
  };
}

async function lookup(flightNumber: string, date: string): Promise<FlightStatus> {
  const match = flightNumber.match(FLIGHT_NUMBER)!;
  const carrier = CARRIER_ALIASES[match[1]] || match[1];
  const [year, month, day] = date.split("-").map(Number);
  const sourceUrl = `https://www.flightstats.com/v2/flight-tracker/${encodeURIComponent(carrier)}/${encodeURIComponent(match[2])}?year=${year}&month=${month}&date=${day}`;
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Malaysia-Bali-Flight-Watcher/1.5.6)" },
    signal: AbortSignal.timeout(6500)
  });
  if (!response.ok) throw new Error(`公开航班查询 HTTP ${response.status}`);
  const flight = extractFlight(await response.text());
  if (!flight) throw new Error("未找到该日期的航班状态");
  const status = flightState(flight);
  return {
    flightNumber,
    date,
    status,
    statusLabel: statusLabel(status),
    statusDetail: String(flight?.status?.statusDescription || flight?.flightNote?.message || ""),
    departure: leg(flight.departureAirport, flight.schedule, "Departure"),
    arrival: leg(flight.arrivalAirport, flight.schedule, "Arrival"),
    fetchedAt: new Date().toISOString(),
    source: "FlightStats public tracker",
    cached: false
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (request.method !== "POST") return json({ message: "只支持 POST" }, 405, origin);
  if (!authenticatedUser(request)) return json({ message: "请先登录后查询航班" }, 401, origin);
  try {
    const body = await request.json();
    const flightNumber = String(body?.flightNumber || "").toUpperCase().replace(/[\s-]+/g, "");
    const date = String(body?.date || "");
    if (!FLIGHT_NUMBER.test(flightNumber) || !validDate(date)) return json({ message: "航班号或日期格式不正确" }, 400, origin);
    const key = `${flightNumber}:${date}`;
    const existing = cache.get(key);
    if (existing && existing.expiresAt > Date.now()) return json({ ...existing.value, cached: true }, 200, origin, true);
    const value = await lookup(flightNumber, date);
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return json(value, 200, origin);
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "航班网络查询失败，请继续使用手动状态" }, 502, origin);
  }
});
