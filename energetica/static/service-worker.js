// src/service-worker.ts
var sw = self;
function getNotificationText(data) {
  const p = data.payload;
  switch (data.type) {
    case "construction_finished":
      return { title: "Construction finished", body: `${p.project_name} is now operational.` };
    case "technology_researched":
      return { title: "Research complete", body: `${p.technology_name} level ${p.new_level}.` };
    case "facility_decommissioned":
      return { title: "Facility decommissioned", body: `The following facility arrived at the end of its lifetime and was decommissioned: ${p.facility_name}.` };
    case "facility_destroyed":
      return { title: "Facility destroyed", body: `A ${p.event_name} occurred and destroyed the following facility: ${p.facility_name}.` };
    case "emergency_facility_created":
      return { title: "Emergency facility", body: "Your last power facility has been decommissioned. An emergency steam engine has been deployed to restart your operations." };
    case "climate_event":
      return { title: "Climate event", body: `${p.event_name} is affecting your facilities.` };
    case "resource_sold":
      return { title: "Resource sold", body: `${p.buyer_username} purchased your ${p.resource} for a total cost of ${p.total_price}.` };
    case "shipment_arrived": {
      const base = `Your shipment of ${p.quantity_kg} kg of ${p.resource} arrived.`;
      const overflow = p.warehouse_full ? ` Only ${p.stored_kg} kg could be stored in your warehouse due to its limited capacity.` : "";
      return { title: "Shipment arrived", body: base + overflow };
    }
    case "credit_limit_exceeded":
      return { title: "Credit limit exceeded", body: "Not enough money for market participation." };
    case "achievement_unlocked":
      return { title: "Achievement", body: `${p.achievement_name}` };
    default:
      return { title: "New notification", body: "" };
  }
}
function getNotificationUrl(type, _payload) {
  switch (type) {
    case "construction_finished":
    case "facility_decommissioned":
    case "facility_destroyed":
    case "emergency_facility_created":
      return "/app/facilities/manage";
    case "technology_researched":
      return "/app/facilities/technology";
    case "climate_event":
      return "/app/overview";
    case "resource_sold":
      return "/app/community/resource-market";
    case "shipment_arrived":
      return "/app/overviews/resources";
    case "credit_limit_exceeded":
      return "/app/overviews/cash-flow";
    case "achievement_unlocked":
      return "/app/dashboard";
    default:
      return "/app/dashboard";
  }
}
sw.addEventListener("push", (event) => {
  if (!event.data)
    return;
  const data = event.data.json();
  const { title, body } = getNotificationText(data);
  const url = getNotificationUrl(data.type, data.payload);
  event.waitUntil(sw.registration.showNotification(title, {
    body,
    icon: "/static/images/icon_green.png",
    data: { url }
  }));
});
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url ?? "/app/overview";
  event.waitUntil(sw.clients.openWindow(sw.location.origin + path));
});
