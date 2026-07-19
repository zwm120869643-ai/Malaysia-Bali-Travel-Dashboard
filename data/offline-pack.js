(function (root) {
  "use strict";

  const data = root.TRIP_DATA;
  if (!data) throw new Error("TRIP_DATA is required before OFFLINE_PACK");
  const checklist = data.tasks || [];

  // ponytail: copy only the public fields needed when the network is unavailable.
  root.OFFLINE_PACK = Object.freeze({
    version: "1.4.1",
    generatedAt: data.meta.lastUpdated,
    offlineReady: true,
    contents: ["flights", "hotels", "emergency", "itinerary", "checklist summary"],
    flights: data.flightRegistry.map(({ id, flight_number, departure, arrival, status }) => ({ id, flight_number, departure, arrival, status })),
    hotels: data.hotelRegistry.map(({ id, hotel_name, check_in, check_out, address, status }) => ({ id, hotel_name, check_in, check_out, address, status })),
    emergency: data.emergency.map(({ id, region, label, phone }) => ({ id, region, label, phone })),
    itinerary: data.itinerary.map(({ id, date, city, theme, transport }) => ({ id, date, city, theme, transport })),
    checklistSummary: {
      total: checklist.length,
      completed: checklist.filter((item) => item.completed).length,
      pending: checklist.filter((item) => !item.completed).length,
      highPriorityPending: checklist.filter((item) => item.priority === "high" && !item.completed).length
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
