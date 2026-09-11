/* =====================================================================
 * ホーム画面アイコンの数字バッジ（PWA App Badge API）
 * ---------------------------------------------------------------------
 * iOS 16.4+ / Chrome / Edge / macOS Safari 16.4+ で動作。
 * ホーム画面に追加された PWA のアイコンに、未読件数を表示する。
 *
 * ルール:
 *   - 前回この端末で「開いた瞬間」の時刻を localStorage に記録
 *   - その時刻より後に追加された「新着お知らせ」と「合否の更新」を数える
 *   - 数が >0 なら setAppBadge(N)、0 なら clearAppBadge()
 *   - ページを閉じる / 別画面に切り替えた瞬間に「今開いた時刻」を保存
 *     → 次に開いた時は、その後の新着だけをカウント
 *   - 初回訪問時はカウントせず、その時点を基準として保存（過去分でバッジを爆発させない）
 * ===================================================================== */
(function () {
  var KEY_LAST_VIEWED = "cta_last_viewed_ms";

  function supported() {
    return typeof navigator !== "undefined" && "setAppBadge" in navigator;
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function toEpoch(dateStr) {
    if (!dateStr) return 0;
    // ISO 8601 or "YYYY-MM-DD" どちらでも通す
    var t = Date.parse(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
    return isNaN(t) ? 0 : t;
  }

  async function computeUnread() {
    var D = window.CTA && window.CTA.data;
    if (!D) return 0;
    var lastViewed = parseInt(safeGet(KEY_LAST_VIEWED) || "0", 10);

    // 初回訪問なら「今」を基準にして、今回はバッジを出さない
    if (!lastViewed) {
      safeSet(KEY_LAST_VIEWED, String(Date.now()));
      return 0;
    }

    var count = 0;
    try {
      var news = await D.getMyNews();
      (news || []).forEach(function (n) {
        if (toEpoch(n.publishedAt) > lastViewed) count++;
      });
    } catch (e) {}
    try {
      var results = await D.getMyResults();
      (results || []).forEach(function (r) {
        // updatedAt があればそちら、無ければ examDate（合否更新の目安）
        var t = toEpoch(r.updatedAt || r.examDate);
        if (t > lastViewed) count++;
      });
    } catch (e) {}
    return count;
  }

  async function applyBadge() {
    if (!supported()) return;
    var n = await computeUnread();
    try {
      if (n > 0) await navigator.setAppBadge(n);
      else await navigator.clearAppBadge();
    } catch (e) {}
  }

  // ページが非表示になる瞬間に「今見た」として記録し、バッジをクリア
  function markAsSeen() {
    safeSet(KEY_LAST_VIEWED, String(Date.now()));
    if (supported()) {
      try { navigator.clearAppBadge(); } catch (e) {}
    }
  }

  // マイページのデータ読み込みが終わってから動かしたいので、少し遅延
  function run() {
    setTimeout(applyBadge, 800);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // タブ切替・アプリを閉じる時に「読んだ」扱い
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") markAsSeen();
  });
  window.addEventListener("pagehide", markAsSeen);

  // デバッグ用（サポート状況・現在の未読数を返す）
  window.CTA = window.CTA || {};
  window.CTA.badge = {
    supported: supported,
    apply: applyBadge,
    clear: function () { markAsSeen(); },
    reset: function () { try { localStorage.removeItem(KEY_LAST_VIEWED); } catch (e) {} },
  };
})();
