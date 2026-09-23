/* =====================================================================
 * Web Push の購読登録（受講者側）
 * ---------------------------------------------------------------------
 * ・Service Worker を登録
 * ・通知の許可をユーザーに求める（初回のみ・押しつけない）
 * ・許可されたら購読情報を Supabase の push_subscriptions に保存
 * ・以降、協会が新着を出すと閉じていても通知が届く
 *
 * iOS の制約：
 *   ホーム画面に追加した PWA からでないと通知許可を出せない。
 *   Safari のタブで開いているだけの人には、追加を先に促す。
 * ===================================================================== */
(function () {
  var VAPID_PUBLIC_KEY = "BK8vtiqa04eenjybQJ6hLYF2vFwuMEGdnBTothwT2uPnzxRY-ol1NATET7mXdoZ3BJif1ktnih6IAgOSZSQ7vds";
  var KEY_ASKED = "cta_push_asked";

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }
  function isStandalone() {
    var mq = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    return !!mq || window.navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = window.atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }
  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  async function registerSW() {
    try {
      var reg = await navigator.serviceWorker.register("sw.js");
      await navigator.serviceWorker.ready;
      return reg;
    } catch (e) {
      return null;
    }
  }

  // 購読情報を Supabase に保存
  async function saveSubscription(sub) {
    var D = window.CTA && window.CTA.data;
    if (!D || !D.savePushSubscription) return false;
    var json = sub.toJSON();
    try {
      await D.savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 200),
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function subscribe() {
    var reg = await registerSW();
    if (!reg) return { ok: false, reason: "sw_failed" };

    var perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") return { ok: false, reason: "denied" };

    var existing = await reg.pushManager.getSubscription();
    if (existing) {
      await saveSubscription(existing);
      return { ok: true, reason: "already" };
    }

    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    var saved = await saveSubscription(sub);
    return { ok: saved, reason: saved ? "subscribed" : "save_failed" };
  }

  // 通知を有効にするカードを表示（押しつけず、任意で有効化してもらう）
  function showEnableCard() {
    if (document.getElementById("pushEnableCard")) return;
    var main = document.querySelector("main.wrap");
    if (!main) return;

    var card = document.createElement("section");
    card.className = "card push-card";
    card.id = "pushEnableCard";
    card.innerHTML =
      '<div class="push-head">' +
        '<div class="push-icon">🔔</div>' +
        '<div class="push-headtext">' +
          '<div class="push-title">大切なお知らせを見逃さないために</div>' +
          '<div class="push-sub">このマイページは毎日開くものではありません。<br>' +
            '通知をオンにしておくと、<b>開いていなくても</b>スマホにお知らせが届きます。</div>' +
        '</div>' +
      '</div>' +
      '<ul class="push-benefits">' +
        '<li><span class="pb-ic">📋</span>合否が発表されたとき</li>' +
        '<li><span class="pb-ic">📢</span>協会から新しいお知らせが出たとき</li>' +
        '<li><span class="pb-ic">📚</span>新しい指導資料が追加されたとき</li>' +
      '</ul>' +
      '<button type="button" class="btn push-btn-lg" id="pushEnableBtn">🔔 通知をオンにする</button>' +
      '<div class="push-note">タップすると「通知を許可しますか？」と表示されます。' +
        '<b>「許可」</b>を選んでください。</div>' +
      '<div class="push-msg" id="pushMsg"></div>';
    // 「新着情報」カードの直後に差し込む（見つからなければ先頭）
    var firstCard = main.querySelector("section.card");
    if (firstCard) main.insertBefore(card, firstCard.nextElementSibling || null);
    else main.appendChild(card);

    document.getElementById("pushEnableBtn").addEventListener("click", async function () {
      var btn = this, msg = document.getElementById("pushMsg");
      btn.disabled = true; btn.textContent = "設定中…";
      msg.className = "push-msg";
      try {
        var r = await subscribe();
        if (r.ok) {
          msg.className = "push-msg ok";
          msg.innerHTML = "<b>✓ 通知をオンにしました</b><br>" +
            "これから合否の発表や新しいお知らせが届くと、スマホにお知らせします。";
          safeSet(KEY_ASKED, "granted");
          btn.textContent = "✓ 設定できました";
          setTimeout(function () { card.remove(); }, 4000);
        } else if (r.reason === "denied") {
          msg.className = "push-msg err";
          msg.innerHTML = "<b>通知が許可されませんでした</b><br>" +
            "iPhone の <b>設定</b> アプリ →「<b>通知</b>」→「<b>CTAマイページ</b>」→" +
            "「<b>通知を許可</b>」をオンにしてから、このページを開き直してください。";
          btn.disabled = false; btn.textContent = "🔔 通知をオンにする";
        } else {
          msg.className = "push-msg err";
          msg.innerHTML = "<b>設定に失敗しました</b><br>" +
            "お手数ですが、一度アプリを閉じて開き直してからもう一度お試しください。";
          btn.disabled = false; btn.textContent = "🔔 通知をオンにする";
        }
      } catch (e) {
        msg.className = "push-msg err";
        msg.innerHTML = "<b>エラーが発生しました</b><br><small>" + (e.message || "") + "</small>";
        btn.disabled = false; btn.textContent = "🔔 通知をオンにする";
      }
    });
  }

  // ホーム画面追加を先に促すカード（iOS でタブ表示の人向け）
  function showAddToHomeHint() {
    if (document.getElementById("pushEnableCard")) return;
    var main = document.querySelector("main.wrap");
    if (!main) return;
    var card = document.createElement("section");
    card.className = "card push-card";
    card.id = "pushEnableCard";
    card.innerHTML =
      '<div class="push-head">' +
        '<div class="push-icon">🔔</div>' +
        '<div class="push-headtext">' +
          '<div class="push-title">大切なお知らせを見逃さないために</div>' +
          '<div class="push-sub">合否の発表や新しいお知らせを、' +
            '<b>このページを開いていなくても</b>スマホにお届けできます。<br>' +
            'ご利用には、先に<b>ホーム画面への追加</b>が必要です（iPhone の仕様です）。</div>' +
        '</div>' +
      '</div>' +
      '<div class="push-steps">' +
        '<div class="ps"><span class="ps-n">1</span>画面下の <b>共有ボタン</b>（□に↑）をタップ</div>' +
        '<div class="ps"><span class="ps-n">2</span>「<b>ホーム画面に追加</b>」をタップ</div>' +
        '<div class="ps"><span class="ps-n">3</span>ホーム画面の<b>アイコンから開く</b>と通知をオンにできます</div>' +
      '</div>' +
      '<button type="button" class="btn push-btn-lg" id="pushHowtoBtn">📱 くわしい追加方法を見る</button>';
    // 「新着情報」カードの直後に差し込む（見つからなければ先頭）
    var firstCard = main.querySelector("section.card");
    if (firstCard) main.insertBefore(card, firstCard.nextElementSibling || null);
    else main.appendChild(card);
    document.getElementById("pushHowtoBtn").addEventListener("click", function () {
      if (window.CTA && window.CTA.showInstallGuide) window.CTA.showInstallGuide();
    });
  }

  // 環境の状態を1行で返す（デバッグ表示にも使う）
  function envInfo() {
    return {
      supported: supported(),
      hasServiceWorker: "serviceWorker" in navigator,
      hasPushManager: "PushManager" in window,
      hasNotification: "Notification" in window,
      permission: ("Notification" in window) ? Notification.permission : "n/a",
      standalone: isStandalone(),
      ios: isIOS(),
    };
  }

  // 未対応環境向けの説明カード（なぜ通知が使えないかを必ず伝える）
  function showUnsupportedCard(reason) {
    if (document.getElementById("pushEnableCard")) return;
    var main = document.querySelector("main.wrap");
    if (!main) return;
    var card = document.createElement("section");
    card.className = "card push-card";
    card.id = "pushEnableCard";
    card.innerHTML =
      '<div class="push-inner">' +
        '<div class="push-icon">🔕</div>' +
        '<div class="push-text">' +
          '<div class="push-title">この端末では通知をお使いいただけません</div>' +
          '<div class="push-sub">' + reason + '</div>' +
        '</div>' +
      '</div>';
    main.appendChild(card);
  }

  async function run() {
    if (!supported()) {
      // iOS 16.3 以前など、Push 非対応の環境
      showUnsupportedCard(
        "お使いのブラウザ／OSがプッシュ通知に対応していません。" +
        "iPhoneの場合は iOS 16.4 以降にアップデートいただくとご利用いただけます。");
      return;
    }

    // Service Worker は常に登録しておく（バッジ更新にも使う）
    await registerSW();

    if (Notification.permission === "granted") {
      // 既に許可済み → 購読が生きているか確認して保存し直す
      try {
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription();
        if (sub) { await saveSubscription(sub); }
        else { await subscribe(); }
      } catch (e) {}
      return;
    }
    if (Notification.permission === "denied") {
      showUnsupportedCard(
        "通知がブロックされています。<br>" +
        "<small>iPhone：設定 →「通知」→「CTAマイページ」→「通知を許可」をオンにしてから、" +
        "このページを開き直してください。</small>");
      return;
    }

    // iOS でホーム画面に追加していない場合は、まず追加を促す
    if (isIOS() && !isStandalone()) { showAddToHomeHint(); return; }

    showEnableCard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(run, 1200); });
  } else {
    setTimeout(run, 1200);
  }

  window.CTA = window.CTA || {};
  window.CTA.push = {
    subscribe: subscribe,
    supported: supported,
    isStandalone: isStandalone,
    env: envInfo,            // 状態を確認したい時：CTA.push.env()
    showCard: showEnableCard, // 手動でカードを出す：CTA.push.showCard()
  };
})();
