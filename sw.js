/* 앱 설치(바탕화면 아이콘) + 채점 알림 푸시용 서비스워커 — 캐시 없이 항상 최신 화면을 불러와요 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    /* 화면이 켜져 있으면 화면이 직접 소리·알림을 내므로 중복으로 띄우지 않아요 (테스트 알림은 항상 띄워요) */
    const cl = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (d.tag !== "test" && cl.some(c => c.visibilityState === "visible")) return;
    await self.registration.showNotification(d.title || "심쿵문법", { body: d.body || "", tag: d.tag || "review", renotify: true, icon: "icon-192.png", badge: "icon-192.png", data: { url: d.url || "./" } });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const cl = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cl) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
  })());
});
