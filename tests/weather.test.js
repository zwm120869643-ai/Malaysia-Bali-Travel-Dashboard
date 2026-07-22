const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = { window: {}, URL };
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/weather.js", "utf8"), context);

const location = {
  id: "bali",
  name: "巴厘岛",
  latitude: -8.65,
  longitude: 115.2167,
  timezone: "Asia/Makassar",
  sea_condition: { status: "TBD" }
};

(async () => {
  const service = context.window.TravelWeather.create(async (url) => {
    assert.equal(url.hostname, "api.open-meteo.com", "天气API地址错误");
    assert.equal(url.searchParams.get("current"), "temperature_2m", "缺少当前温度参数");
    assert.match(url.searchParams.get("daily"), /precipitation_probability_max/, "缺少降雨概率参数");
    assert.match(url.searchParams.get("daily"), /sunset/, "缺少日落参数");
    return {
      ok: true,
      async json() {
        return {
          current: { time: "2026-07-20T10:00", temperature_2m: 28.4 },
          daily: { time: ["2026-07-20", "2026-07-21"], precipitation_probability_max: [65, 20], sunset: ["2026-07-20T18:18", "2026-07-21T18:18"] }
        };
      }
    };
  });
  const weather = await service.get(location);
  assert.equal(weather.temperature, 28.4, "温度解析错误");
  assert.equal(weather.rainProbability, 65, "降雨概率解析错误");
  assert.equal(weather.sunset, "2026-07-20T18:18", "日落时间解析错误");
  assert.equal(weather.seaCondition, "TBD", "海况预留字段错误");
  assert.deepEqual(JSON.parse(JSON.stringify(weather.forecast[1])), { date: "2026-07-21", rainProbability: 20, sunset: "2026-07-21T18:18", seaCondition: "TBD" }, "七天天气未提供给智能层");

  const offline = context.window.TravelWeather.create(async () => { throw new Error("offline"); });
  assert.equal(await offline.get(location), null, "天气失败时未安全降级");
  console.log("weather data layer: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
