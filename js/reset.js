/* パスワード再設定（メールのリンクから来た時に使う） */
(function () {
  const cfg = window.CTA.SUPABASE;
  const client = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { detectSessionInUrl: true, flowType: "implicit", persistSession: true }
  });
  const alertBox = document.getElementById("alert");
  const form = document.getElementById("form");
  const btn = document.getElementById("btn");

  function show(cls, msg) { alertBox.innerHTML = '<div class="alert ' + cls + '">' + msg + "</div>"; }
  function disableForm() { form.style.opacity = "0.5"; form.style.pointerEvents = "none"; btn.disabled = true; }
  function enableForm() { form.style.opacity = "1"; form.style.pointerEvents = "auto"; btn.disabled = false; }

  // ---- 起動時：URLフラグメントを解析し、セッション状態を確認 ----
  (async function bootstrap() {
    // Supabase JS が URL の #access_token=... を検出するまで少し待つ
    await new Promise(r => setTimeout(r, 300));

    // エラーが URL に返ってきていないか
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(location.search);
    const errCode = hash.get("error_code") || query.get("error_code");
    const errDesc = hash.get("error_description") || query.get("error_description");

    if (errCode || errDesc) {
      disableForm();
      const msg = /expired|invalid/i.test(errDesc || errCode || "")
        ? "リンクの有効期限が切れています。恐れ入りますが、ログイン画面の「パスワードを忘れた方」からもう一度お試しください。"
        : "リンクが正しくありません。もう一度メールから開き直してください。（" + (errDesc || errCode) + "）";
      show("error", msg);
      return;
    }

    // セッション取得
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      // ハッシュに token_hash 形式（新しいフロー）で来た場合は明示的に verify を試みる
      const tokenHash = hash.get("token_hash") || query.get("token_hash");
      const tokenType = hash.get("type") || query.get("type") || "recovery";
      if (tokenHash) {
        try {
          const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
          if (error) throw error;
        } catch (err) {
          disableForm();
          show("error",
            "リンクの読み込みに失敗しました。恐れ入りますが、ログイン画面の「パスワードを忘れた方」から再度お試しください。（" + (err.message || "") + "）");
          return;
        }
      } else {
        // URLに何もない = 直接 reset.html に来た or メール本文外から来た
        disableForm();
        show("error",
          '<b>このページはメールのリンクから開いてください。</b><br>' +
          '「パスワードを忘れた方」からメール送信 → 届いたメール内のボタンをタップ → このページに戻ってきます。<br><br>' +
          '<a href="index.html">ログイン画面に戻る</a>');
        return;
      }
    }
    // OK：フォーム操作可能
    show("ok", "新しいパスワードを設定できます。");
    setTimeout(function () { alertBox.innerHTML = ""; }, 1800);
  })();

  // ---- フォーム送信 ----
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const pw = document.getElementById("pw").value;
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
      show("error", "パスワードは8文字以上・英字と数字を含めてください");
      return;
    }
    btn.disabled = true; btn.textContent = "設定中…";
    try {
      const { error } = await client.auth.updateUser({ password: pw });
      if (error) throw error;
      show("ok", "パスワードを変更しました。3秒後にログイン画面に戻ります。");
      setTimeout(function () { location.href = "index.html"; }, 3000);
    } catch (err) {
      const m = /Auth session missing|not authenticated/i.test(err.message || "")
        ? "セッションが切れています。恐れ入りますが、もう一度メール内のリンクをタップし直してください（リンクは 24時間 有効です）。"
        : (err.message || "エラーが発生しました");
      show("error", m);
      btn.disabled = false; btn.textContent = "パスワードを設定する";
    }
  });
})();
