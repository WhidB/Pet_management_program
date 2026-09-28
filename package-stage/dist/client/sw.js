async function deliver() {
  const response = await fetch("/api/notifications", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return;
  const { items } = await response.json();
  const cache = await caches.open("pawday-preferences");
  const preference = await cache.match("/__language");
  const english = preference && (await preference.text()) === "en-US";
  const active = new Set(items.map((x) => x.id));
  for (const n of await self.registration.getNotifications())
    if (!active.has(n.tag) && n.tag !== "pawday-test") n.close();
  for (const item of items.filter(
    (x) =>
      x.state === "pending" &&
      !x.device_claim &&
      Date.now() - Date.parse(x.due) < 15 * 60000,
  )) {
    const r = await fetch("/api/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "claim" }),
    });
    if (!r.ok) continue;
    const data = await r.json();
    if (data.claimed)
      await self.registration.showNotification(data.item.title, {
        body: english
          ? "Time to check your pet’s care."
          : "지금 돌봄을 확인해주세요.",
        tag: data.item.id,
        icon: "/favicon.svg",
        data: { url: "/" },
      });
  }
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (e) => {
  if (e.data?.type === "CHECK_NOTIFICATIONS")
    e.waitUntil(
      (async () => {
        const cache = await caches.open("pawday-preferences");
        await cache.put(
          "/__language",
          new Response(e.data.language || "ko-KR"),
        );
        await deliver();
      })(),
    );
});
self.addEventListener("push", (e) => e.waitUntil(deliver()));
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: "window" })
      .then((w) => (w[0] ? w[0].focus() : self.clients.openWindow("/"))),
  );
});
