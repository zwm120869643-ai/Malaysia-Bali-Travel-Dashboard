(function (root) {
  "use strict";

  const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

  function create(requestImpl) {
    const request = requestImpl || root.fetch?.bind(root);

    async function get(location) {
      if (!location || typeof request !== "function") return null;
      const url = new URL(ENDPOINT);
      url.searchParams.set("latitude", location.latitude);
      url.searchParams.set("longitude", location.longitude);
      url.searchParams.set("current", "temperature_2m");
      url.searchParams.set("daily", "precipitation_probability_max,sunset");
      url.searchParams.set("forecast_days", "7");
      url.searchParams.set("timezone", location.timezone || "auto");

      try {
        const response = await request(url);
        if (!response.ok) throw new Error(`weather http ${response.status || "error"}`);
        const data = await response.json();
        const today = String(data.current?.time || "").slice(0, 10);
        const dayIndex = Math.max(0, (data.daily?.time || []).indexOf(today));
        if (!Number.isFinite(data.current?.temperature_2m)) throw new Error("invalid weather response");
        return {
          id: location.id,
          name: location.name,
          temperature: data.current.temperature_2m,
          rainProbability: data.daily?.precipitation_probability_max?.[dayIndex] ?? "TBD",
          sunset: data.daily?.sunset?.[dayIndex] || "TBD",
          seaCondition: location.sea_condition?.status || "TBD",
          forecast: (data.daily?.time || []).map((date, index) => ({ date, rainProbability: data.daily?.precipitation_probability_max?.[index] ?? "TBD", sunset: data.daily?.sunset?.[index] || "TBD", seaCondition: location.sea_condition?.status || "TBD" })),
          updatedAt: data.current.time
        };
      } catch (_) {
        return null;
      }
    }

    async function load(locations) {
      return (await Promise.all((locations || []).map(get))).filter(Boolean);
    }

    return { get, load };
  }

  root.TravelWeather = { create };
})(typeof window !== "undefined" ? window : globalThis);
