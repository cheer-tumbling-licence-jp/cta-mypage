/* =====================================================================
 * Service Worker — Web Push 受信とバッジ更新
 * ---------------------------------------------------------------------
 * アプリが閉じていても、この Service Worker がバックグラウンドで動き、
 * 協会からのプッシュ通知を受け取ってロック画面にバナーを出す。
 * 同時にホーム画面アイコンの数字バッジも更新する。
 * ===================================================================== */
var CACHE_NAME = "cta-mypage-v1";

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

/* ---- プッシュ受信 ---------------------------------------------------- */
self.addEventListener("push", function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "チアタンブリング協会", body: event.data ? event.data.text() : "新しいお知らせがあります" };
  }

  var title = payload.title || "チアタンブリング協会";
  var options = {
    body: payload.body || "新しいお知らせがあります",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: payload.tag || "cta-notice",
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || "./mypage.html",
      ts: Date.now(),
    },
  };

  var tasks = [self.registration.showNotification(title, options)];

  // アイコンの数字バッジも更新（通知に count が乗っていれば使う）
  if ("setAppBadge" in self.navigator) {
    var count = typeof payload.badge_count === "number" ? payload.badge_count : 1;
    tasks.push(
      count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge()
    );
  }

  event.waitUntil(Promise.all(tasks));
});

/* ---- 通知タップ ------------------------------------------------------ */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || "./mypage.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      // 既に開いているタブがあればそれをフォーカス
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf("mypage") !== -1 && "focus" in client) {
          return client.focus();
        }
      }
      // なければ新しく開く
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }).then(function () {
      // 開いたのでバッジをクリア
      if ("clearAppBadge" in self.navigator) {
        return self.navigator.clearAppBadge().catch(function () {});
      }
    })
  );
});

/* ---- 購読が期限切れになった時の自動更新 ------------------------------ */
self.addEventListener("pushsubscriptionchange", function (event) {
  // 新しい購読情報でサーバーに再登録させるため、
  // 次回アプリを開いた時に push-subscribe.js が再購読する。
  // ここでは古い購読を無効化する通知だけ出す（任意）。
});
