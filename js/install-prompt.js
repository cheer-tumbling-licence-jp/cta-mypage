/* =====================================================================
 * ホーム画面追加を促す UI（初回：モーダル必須／2回目以降：バナー）
 * ---------------------------------------------------------------------
 * - 既に PWA として起動されている場合は何も表示しない
 * - 「追加しました」ボタンで自己申告 → 以降表示しない
 * - バナーの ✕ で個別に閉じられる（閉じたら再表示しない）
 * ===================================================================== */
(function () {
  var KEYS = {
    firstShown: "cta_install_first_shown",
    bannerDismissed: "cta_install_banner_dismissed",
    installConfirmed: "cta_install_confirmed",
  };

  function isStandalone() {
    var mq = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    return !!mq || window.navigator.standalone === true;
  }

  function detectPlatform() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "ios";
    if (/Android/.test(ua)) return "android";
    return "desktop";
  }

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function iosInstructionsHTML() {
    return (
      '<div class="ins-title">iPhone / iPad の追加方法（Safariで開いてください）</div>' +
      '<ol class="ins-list">' +
        '<li>画面下（または右上）の <b>共有ボタン</b>（<span class="ins-key">□↑</span>）をタップ</li>' +
        '<li>メニューを下にスクロールして <b>「ホーム画面に追加」</b> をタップ</li>' +
        '<li>右上の <b>「追加」</b> をタップ</li>' +
      '</ol>' +
      '<div class="ins-note">※ Safari 以外（Chrome アプリなど）では「ホーム画面に追加」が出ないことがあります。</div>'
    );
  }

  function androidInstructionsHTML() {
    return (
      '<div class="ins-title">Android の追加方法（Chromeで開くと簡単です）</div>' +
      '<ol class="ins-list">' +
        '<li>画面右上の <b>メニュー</b>（<span class="ins-key">⋮</span>）をタップ</li>' +
        '<li>メニューから <b>「ホーム画面に追加」</b> または <b>「アプリをインストール」</b> をタップ</li>' +
        '<li>確認画面で <b>「追加」</b>／<b>「インストール」</b> をタップ</li>' +
      '</ol>' +
      '<div class="ins-note">※ 「開くたびに毎回ログインが必要」と感じる方は、この方法で追加するとログイン状態が保たれます。</div>'
    );
  }

  function desktopInstructionsHTML() {
    return (
      '<div class="ins-title">パソコンの追加方法（Chrome / Edge）</div>' +
      '<ol class="ins-list">' +
        '<li>アドレスバーの右にある <b>インストールアイコン</b>（<span class="ins-key">⤓</span>）をクリック</li>' +
        '<li>ダイアログの <b>「インストール」</b> をクリック</li>' +
      '</ol>' +
      '<div class="ins-note">※ 見当たらない場合は、ブラウザメニューから「CTAマイページ をインストール」を選んでください。</div>'
    );
  }

  function instructionsHTMLFor(platform) {
    if (platform === "ios") return iosInstructionsHTML();
    if (platform === "android") return androidInstructionsHTML();
    return desktopInstructionsHTML();
  }

  function showModal(platform, opts) {
    opts = opts || {};
    var canClose = !!opts.canClose;
    var overlay = document.createElement("div");
    overlay.className = "install-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<div class="install-modal">' +
        '<div class="install-head">' +
          '<div class="install-icon">📱</div>' +
          '<h2 class="install-title">マイページを<br>ホーム画面に追加しましょう</h2>' +
          '<p class="install-sub">アプリのようにワンタップで開けるようになります。<br>合否発表・お知らせもすぐ確認できます。</p>' +
        '</div>' +
        '<div class="install-body">' + instructionsHTMLFor(platform) + '</div>' +
        '<div class="install-actions">' +
          '<button type="button" class="btn install-done">✅ 追加しました</button>' +
          '<button type="button" class="btn ghost install-later">' + (canClose ? '閉じる' : 'あとで設定する') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add("no-scroll");

    function close() {
      overlay.remove();
      document.body.classList.remove("no-scroll");
    }
    overlay.querySelector(".install-done").addEventListener("click", function () {
      safeSet(KEYS.installConfirmed, "1");
      close();
    });
    overlay.querySelector(".install-later").addEventListener("click", close);
  }

  function showBanner(platform) {
    var bar = document.createElement("div");
    bar.className = "install-banner";
    bar.innerHTML =
      '<button type="button" class="install-banner-body" aria-label="ホーム画面に追加する手順を表示">' +
        '<span class="install-banner-icon">📱</span>' +
        '<span class="install-banner-text">' +
          '<b>ホーム画面に追加すると便利です</b>' +
          '<span class="install-banner-sub">タップして手順を表示</span>' +
        '</span>' +
      '</button>' +
      '<button type="button" class="install-banner-close" aria-label="閉じる">✕</button>';
    document.body.appendChild(bar);

    bar.querySelector(".install-banner-body").addEventListener("click", function () {
      showModal(platform, { canClose: true });
    });
    bar.querySelector(".install-banner-close").addEventListener("click", function (e) {
      e.stopPropagation();
      safeSet(KEYS.bannerDismissed, "1");
      bar.remove();
    });
  }

  function run() {
    if (isStandalone()) return;
    if (safeGet(KEYS.installConfirmed) === "1") return;

    var platform = detectPlatform();
    var firstShown = safeGet(KEYS.firstShown) === "1";

    if (!firstShown) {
      safeSet(KEYS.firstShown, "1");
      setTimeout(function () { showModal(platform, { canClose: false }); }, 700);
      return;
    }
    if (safeGet(KEYS.bannerDismissed) === "1") return;
    setTimeout(function () { showBanner(platform); }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // 手動再表示用（デバッグ・お問い合わせ対応）
  window.CTA = window.CTA || {};
  window.CTA.showInstallGuide = function () {
    showModal(detectPlatform(), { canClose: true });
  };
})();
