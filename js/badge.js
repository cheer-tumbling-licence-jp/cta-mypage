/* =====================================================================
 * ホーム画面アイコンの数字バッジ（PWA App Badge API）
 * ---------------------------------------------------------------------
 * iOS 16.4+ / Chrome / Edge / macOS Safari 16.4+ で動作。
 * ホーム画面に追加された PWA のアイコンに、未読件数を表示する。
 *
 * 【重要】バッジは「アプリを閉じた後も残る」必要がある。
 *   開いている間だけ立てて閉じる時にクリアすると、ホーム画面では
 *   何も見えない（過去の実装ミス）。正しい流れは下記：
 *
 *   1. アプリを開く
 *        → 前回開いた時刻(lastViewed)より後の news/results を数える
 *        → 数えた直後に「今読んだ」として lastViewed を「今」に更新
 *        → バッジは 0 にクリア（＝画面で見たので未読ではない）
 *   2. アプリを閉じる（※ここでは何もしない）
 *   3. その後、協会が新しいお知らせを投稿する
 *   4. 次にアプリを開くと、3 の分がカウントされバッジに乗る
 *        → ただしこれでは「開かないと数字が出ない」ので、
 *          閉じる直前に「サーバー側の最新件数」を取り直して
 *          バッジを立て直しておく（＝閉じた後も数字が残る）
 *
 *   つまり「閉じる時に、今後の新着を先読みしてバッジを立てておく」ことはできない。
 *   App Badge API は端末側 API なので、アプリが動いている間しか更新できない。
 *   → 完全にリアルタイムで出すには Web Push が必要（今後の課題）。
 *   → 現状は「アプリを開いた時、前回以降の新着数をバッジに立てて、
 *      その数字が閉じた後もホーム画面に残る」仕様とする。
 * ===================================================================== */
(function () {
  var KEY_LAST_VIEWED = "cta_last_viewed_ms";
  var KEY_PENDING = "cta_badge_pending";  // 直近で表示したバッジ数

  function supported() {
    return typeof navigator !== "undefined" && "setAppBadge" in navigator;
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function toEpoch(dateStr) {
    if (!dateStr) return 0;
    var t = Date.parse(String(dateStr).length === 10 ? dateStr + "T00:00:00" : dateStr);
    return isNaN(t) ? 0 : t;
  }

  // 前回アプリを開いた時刻より後に追加された新着を数える
  async function countNewSince(sinceMs) {
    var D = window.CTA && window.CTA.data;
    if (!D) return 0;
    var count = 0;
    try {
      var news = await D.getMyNews();
      (news || []).forEach(function (n) {
        if (toEpoch(n.publishedAt) > sinceMs) count++;
      });
    } catch (e) {}
    try {
      var results = await D.getMyResults();
      (results || []).forEach(function (r) {
        var t = toEpoch(r.updatedAt || r.examDate);
        if (t > sinceMs) count++;
      });
    } catch (e) {}
    return count;
  }

  async function setBadge(n) {
    if (!supported()) return;
    try {
      if (n > 0) await navigator.setAppBadge(n);
      else await navigator.clearAppBadge();
    } catch (e) {}
    safeSet(KEY_PENDING, String(n));
  }

  // 起動時：前回以降の新着を数えてバッジに反映し、
  // 「今開いた」として基準時刻を更新する。
  // バッジの数字は次に開くまでホーム画面に残る。
  async function onOpen() {
    var lastViewed = parseInt(safeGet(KEY_LAST_VIEWED) || "0", 10);

    // 初回訪問：過去の全件でバッジが爆発しないよう、基準だけ記録
    if (!lastViewed) {
      safeSet(KEY_LAST_VIEWED, String(Date.now()));
      await setBadge(0);
      return;
    }

    var n = await countNewSince(lastViewed);
    // 画面で見えているので、いま開いた時点を新しい基準にする
    safeSet(KEY_LAST_VIEWED, String(Date.now()));
    // バッジには「前回以降に届いていた件数」を立てる（閉じても残る）
    await setBadge(n);
  }

  // 閉じる直前：サーバーの最新状態を取り直し、
  // 「今この瞬間の未読（＝開いている間に届いた分）」をバッジに残す
  async function onClose() {
    var lastViewed = parseInt(safeGet(KEY_LAST_VIEWED) || "0", 10);
    if (!lastViewed) return;
    try {
      var n = await countNewSince(lastViewed);
      await setBadge(n);
    } catch (e) {}
  }

  function run() { setTimeout(onOpen, 900); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") onClose();
    else if (document.visibilityState === "visible") onOpen();
  });

  // デバッグ・手動確認用
  window.CTA = window.CTA || {};
  window.CTA.badge = {
    supported: supported,
    // 現在の未読数を返す（開かずに確認したい時）
    peek: async function () {
      var lv = parseInt(safeGet(KEY_LAST_VIEWED) || "0", 10);
      return { lastViewed: lv ? new Date(lv).toISOString() : null,
               unread: await countNewSince(lv), pending: safeGet(KEY_PENDING) };
    },
    // 手動でバッジを N に設定（テスト用）
    set: setBadge,
    // 基準時刻をリセット（次に開いた時に全件が未読扱いになる）
    reset: function () { try { localStorage.removeItem(KEY_LAST_VIEWED); } catch (e) {} },
    // 強制的に「1日前に見た」ことにする（テスト用）
    rewind: function (hours) {
      safeSet(KEY_LAST_VIEWED, String(Date.now() - (hours || 24) * 3600 * 1000));
    },
  };
})();
